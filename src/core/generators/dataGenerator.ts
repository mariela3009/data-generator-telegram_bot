import { Faker, faker as fakerEn } from '@faker-js/faker';
import { DatabaseSchema, TableGenerationConfig, GeneratedData, TableSchema } from '../schemas';
import { getFakerMethodForColumn } from './fakerMappings';
import { generateSeedDataForDatabase } from './aiGenerator';
import { multiplyData } from './hybridMultiplier';

export class DataGenerator {
  private fake: Faker;
  private locale: string;

  constructor(locale: string = 'es_ES') {
    this.locale = locale;
    // In a real app we'd load the specific locale faker, but we'll use base faker here
    // or assume faker is globally localized.
    this.fake = fakerEn; 
  }

  public setLocale(locale: string) {
    this.locale = locale;
    // this.fake = ...
  }

  public async generate(
    schema: DatabaseSchema,
    configs: TableGenerationConfig[],
    useAi: boolean = false,
    prompt: string = ""
  ): Promise<Record<string, GeneratedData>> {
    const results: Record<string, GeneratedData> = {};
    const selectedConfigs = configs.filter(c => c.selected && c.recordCount > 0);
    
    if (selectedConfigs.length === 0) return results;

    const tableNames = selectedConfigs.map(c => c.tableName);
    
    // Sort tables by dependencies
    const sortedTableNames = this.topologicalSort(schema, tableNames);

    let aiSeeds: Record<string, any[]> | null = null;

    if (useAi) {
      try {
        console.log("Generating AI Seeds...");
        aiSeeds = await generateSeedDataForDatabase(schema, sortedTableNames, prompt);
      } catch (error) {
        console.warn("AI Generation failed, falling back to Faker", error);
        aiSeeds = null;
      }
    }

    const primaryKeyCaches: Record<string, any[]> = {}; // table -> ids

    for (const tableName of sortedTableNames) {
      const config = selectedConfigs.find(c => c.tableName === tableName)!;
      const tableSchema = schema.tables.find(t => t.name === tableName)!;
      
      let rows: any[][] = [];

      if (aiSeeds && aiSeeds[tableName] && aiSeeds[tableName].length > 0) {
        console.log(`Scaling ${tableName} using Hybrid Multiplier...`);
        rows = multiplyData(aiSeeds[tableName], config.recordCount, tableSchema, this.fake);
      } else {
        console.log(`Generating ${tableName} using Faker...`);
        rows = this.generateWithFaker(config.recordCount, tableSchema, primaryKeyCaches);
      }

      // Cache PKs for foreign keys later
      const pkNames = tableSchema.primaryKeys || [];
      if (pkNames.length > 0) {
        const pkCol = pkNames[0];
        const colIndex = tableSchema.columns.findIndex(c => c.name === pkCol);
        if (colIndex !== -1) {
          primaryKeyCaches[tableName] = rows.map(r => r[colIndex]);
        }
      }

      results[tableName] = {
        tableName,
        columns: tableSchema.columns.map(c => c.name),
        rows,
        totalRows: rows.length
      };
    }

    return results;
  }

  private generateWithFaker(
    count: number,
    tableSchema: TableSchema,
    pkCaches: Record<string, any[]>
  ): any[][] {
    const rows: any[][] = [];
    const pkGenCounters: Record<string, number> = {};

    const colGenerators = tableSchema.columns.map(col => {
      if (col.isPrimaryKey) {
        if (col.dataType && col.dataType.toLowerCase().includes('uuid')) {
          return () => this.fake.string.uuid();
        }
        pkGenCounters[col.name] = (col.maxId || 0) + 1;
        return (i: number) => pkGenCounters[col.name] + i;
      }
      if (col.foreignKey) {
        const fkTable = col.foreignKey.table;
        if (pkCaches[fkTable] && pkCaches[fkTable].length > 0) {
          return () => this.fake.helpers.arrayElement(pkCaches[fkTable]);
        }
        if (col.dataType && col.dataType.toLowerCase().includes('uuid')) {
          return () => this.fake.string.uuid();
        }
        return () => 1; // Fallback
      }
      return getFakerMethodForColumn(this.fake, col.name, col.dataType, tableSchema.name);
    });

    for (let i = 0; i < count; i++) {
      const row = colGenerators.map(gen => {
        try {
          return gen(i);
        } catch (e) {
          return null;
        }
      });
      rows.push(row);
    }

    return rows;
  }

  private topologicalSort(schema: DatabaseSchema, tablesToGenerate: string[]): string[] {
    const graph: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    for (const t of tablesToGenerate) {
      graph[t] = [];
      inDegree[t] = 0;
    }

    for (const t of tablesToGenerate) {
      const ts = schema.tables.find(x => x.name === t);
      if (ts && ts.foreignKeys) {
        for (const fk of ts.foreignKeys) {
          const parent = fk.table;
          if (tablesToGenerate.includes(parent) && parent !== t) {
            graph[parent].push(t);
            inDegree[t] = (inDegree[t] || 0) + 1;
          }
        }
      }
    }

    const queue: string[] = [];
    for (const t of tablesToGenerate) {
      if (inDegree[t] === 0) queue.push(t);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of graph[current]) {
        inDegree[neighbor] -= 1;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    const remaining = tablesToGenerate.filter(t => !sorted.includes(t));
    return [...sorted, ...remaining];
  }
}
