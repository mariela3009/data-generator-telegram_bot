import { BaseConnector } from './BaseConnector';
import { MySQLConnector } from './MySQLConnector';
import { PostgreSQLConnector } from './PostgreSQLConnector';

export class ConnectorFactory {
  static getConnector(uri: string): BaseConnector {
    if (uri.startsWith('mysql://')) {
      return new MySQLConnector(uri);
    }
    if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
      return new PostgreSQLConnector(uri);
    }
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
      throw new Error('MongoDB connector not implemented yet in VS Code extension.');
    }
    
    throw new Error('Unsupported database protocol or invalid URI');
  }
}
