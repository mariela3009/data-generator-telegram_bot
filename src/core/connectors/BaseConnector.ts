import { DatabaseSchema, GeneratedData } from '../schemas';

export interface BaseConnector {
  /**
   * Connects to the database. Throws error if fails.
   */
  connect(): Promise<void>;

  /**
   * Disconnects from the database.
   */
  disconnect(): Promise<void>;

  /**
   * Analyzes the database and returns the structured schema.
   */
  getSchema(): Promise<DatabaseSchema>;

  /**
   * Inserts the generated data into the database in the correct order.
   */
  insertData(data: Record<string, GeneratedData>, sortedTables: string[]): Promise<void>;
}
