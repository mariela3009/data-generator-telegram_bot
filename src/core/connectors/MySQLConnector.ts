import * as mysql from 'mysql2/promise';
import { BaseConnector } from './BaseConnector';
import { DatabaseSchema, TableSchema, ColumnSchema, GeneratedData } from '../schemas';

export class MySQLConnector implements BaseConnector {
  private connectionUri: string;
  private connection: mysql.Connection | null = null;
  private dbName: string = '';

  constructor(connectionUri: string) {
    this.connectionUri = connectionUri;
  }

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection(this.connectionUri);
    const dbMatch = this.connectionUri.match(/:\/\/[^/]+\/([^?]+)/);
    if (dbMatch) {
      this.dbName = dbMatch[1];
    } else {
      // fallback to querying current db
      const [rows] = await this.connection.execute('SELECT DATABASE() as db');
      this.dbName = (rows as any)[0].db;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) throw new Error("Not connected");

    const [tablesRow] = await this.connection.execute(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
      [this.dbName]
    );

    const tables = tablesRow as { table_name: string }[];
    const tableSchemas: TableSchema[] = [];

    for (const t of tables) {
      const tableName = t.table_name;
      
      const [colsRow] = await this.connection.execute(`
        SELECT column_name, data_type, is_nullable, character_maximum_length, column_default, column_key
        FROM information_schema.columns 
        WHERE table_schema = ? AND table_name = ?
      `, [this.dbName, tableName]);

      const columns: ColumnSchema[] = (colsRow as any[]).map(c => ({
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: c.column_key === 'PRI',
        isUnique: c.column_key === 'UNI',
        defaultValue: c.column_default,
        maxLength: c.character_maximum_length
      }));

      // Find primary keys
      const primaryKeys = columns.filter(c => c.isPrimaryKey).map(c => c.name);

      // Foreign keys
      const [fkRows] = await this.connection.execute(`
        SELECT column_name, referenced_table_name, referenced_column_name 
        FROM information_schema.key_column_usage 
        WHERE table_schema = ? AND table_name = ? AND referenced_table_name IS NOT NULL
      `, [this.dbName, tableName]);

      const foreignKeys: any[] = [];
      for (const fk of (fkRows as any[])) {
        foreignKeys.push({ table: fk.referenced_table_name, column: fk.referenced_column_name });
        const col = columns.find(c => c.name === fk.column_name);
        if (col) {
          col.foreignKey = { table: fk.referenced_table_name, column: fk.referenced_column_name };
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
      motor: 'mysql',
      databaseName: this.dbName,
      tables: tableSchemas
    };
  }

  async insertData(data: Record<string, GeneratedData>, sortedTables: string[]): Promise<void> {
    if (!this.connection) throw new Error("Not connected");

    await this.connection.execute('SET FOREIGN_KEY_CHECKS=0;');
    
    try {
      for (const tableName of sortedTables) {
        if (!data[tableName] || data[tableName].rows.length === 0) continue;
        
        const tableData = data[tableName];
        const columns = tableData.columns;
        const rows = tableData.rows;

        // Batch inserts in chunks of 1000
        const CHUNK_SIZE = 1000;
        const colPlaceholders = columns.map(() => '?').join(', ');
        const sql = `INSERT IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${colPlaceholders})`;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          // execute is better for prepared statements but for batching multiple rows, format is often needed
          // but here we just loop prepared statements or use a multi-insert.
          // For simplicity, we loop with execute. In production, we'd build a bulk insert string.
          for (const row of chunk) {
            await this.connection.execute(sql, row);
          }
        }
      }
    } finally {
      await this.connection.execute('SET FOREIGN_KEY_CHECKS=1;');
    }
  }
}
