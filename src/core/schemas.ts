export interface ColumnSchema {
  name: string;
  dataType: string;
  isNullable?: boolean;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  defaultValue?: string | null;
  foreignKey?: { table: string; column: string } | null;
  maxLength?: number | null;
  maxId?: number;
  enumValues?: string[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys?: string[];
  foreignKeys?: { table: string; column: string }[];
}

export interface DatabaseSchema {
  motor: string;
  databaseName: string;
  tables: TableSchema[];
}

export interface TableGenerationConfig {
  tableName: string;
  recordCount: number;
  selected: boolean;
}

export interface GeneratedData {
  tableName: string;
  columns: string[];
  rows: any[][];
  totalRows: number;
}
