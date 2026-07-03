import { Client } from 'pg';
import { BaseConnector } from './BaseConnector';
import { DatabaseSchema, TableSchema, ColumnSchema, GeneratedData } from '../schemas';

export class PostgreSQLConnector implements BaseConnector {
  private connectionUri: string;
  private client: Client | null = null;
  private dbName: string = '';

  constructor(connectionUri: string) {
    this.connectionUri = connectionUri;
  }

  async connect(): Promise<void> {
    // Add ssl config for Supabase if needed, usually required for remote postgres.
    // We can infer it from the connection string or just enable it with rejectUnauthorized: false
    const sslConfig = this.connectionUri.includes('supabase.com') || this.connectionUri.includes('render.com') || this.connectionUri.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : false;

    this.client = new Client({ 
      connectionString: this.connectionUri,
      ssl: sslConfig
    });
    
    await this.client.connect();
    this.dbName = this.client.database || 'public';
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.client) throw new Error("Not connected");

    // Fetch tables in public schema
    const tablesRes = await this.client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tables = tablesRes.rows as { table_name: string }[];
    const tableSchemas: TableSchema[] = [];

    for (const t of tables) {
      const tableName = t.table_name;
      
      const colsRes = await this.client.query(`
        SELECT column_name, data_type, is_nullable, character_maximum_length, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      // Primary keys
      const pkRes = await this.client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
      `, [tableName]);
      const primaryKeys = pkRes.rows.map((r: any) => r.column_name);

      const columns: ColumnSchema[] = colsRes.rows.map((c: any) => ({
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: primaryKeys.includes(c.column_name),
        isUnique: false, // For brevity
        defaultValue: c.column_default,
        maxLength: c.character_maximum_length
      }));

      for (const pkCol of primaryKeys) {
        try {
          const maxRes = await this.client.query(`SELECT MAX("${pkCol}") as m FROM "${tableName}"`);
          if (maxRes.rows[0].m !== null) {
            const val = parseInt(maxRes.rows[0].m, 10);
            if (!isNaN(val)) {
              const col = columns.find(c => c.name === pkCol);
              if (col) col.maxId = val;
            }
          }
        } catch(e) {}
      }

      // Foreign keys
      const fkRes = await this.client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
      `, [tableName]);

      const foreignKeys: any[] = [];
      for (const fk of fkRes.rows) {
        foreignKeys.push({ table: fk.foreign_table_name, column: fk.foreign_column_name });
        const col = columns.find(c => c.name === fk.column_name);
        if (col) {
          col.foreignKey = { table: fk.foreign_table_name, column: fk.foreign_column_name };
        }
      }

      tableSchemas.push({
        name: tableName,
        columns,
        primaryKeys,
        foreignKeys
      });
    }

    return {
      motor: 'postgres',
      databaseName: this.dbName,
      tables: tableSchemas
    };
  }

  async insertData(data: Record<string, GeneratedData>, sortedTables: string[]): Promise<void> {
    if (!this.client) throw new Error("Not connected");

    // Start transaction
    await this.client.query('BEGIN');
    try {
      for (const tableName of sortedTables) {
        if (!data[tableName] || data[tableName].rows.length === 0) continue;
        
        const tableData = data[tableName];
        const columns = tableData.columns;
        const rows = tableData.rows;

        const colPlaceholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
        const quotedTableName = `"${tableName}"`;
        const quotedColumns = columns.map(c => `"${c}"`).join(', ');
        const sql = `INSERT INTO ${quotedTableName} (${quotedColumns}) VALUES (${colPlaceholders}) ON CONFLICT DO NOTHING`;

        for (const row of rows) {
          await this.client.query(sql, row);
        }
      }
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }
}
