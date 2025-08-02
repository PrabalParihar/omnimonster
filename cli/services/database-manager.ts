import axios from 'axios';
import { config } from '../config/config';

export interface DatabaseStatus {
  database: string;
  connected: boolean;
  version: string;
  tables: TableInfo[];
  totalSize: string;
  connectionPool?: {
    total: number;
    active: number;
    idle: number;
  };
}

export interface TableInfo {
  name: string;
  rowCount: number;
  size: string;
  created: string;
  lastModified: string;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: string[];
}

export class DatabaseManager {
  async getStatus(): Promise<DatabaseStatus> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/test-db`, {
        timeout: 10000
      });

      return {
        database: response.data.database || 'fusion_swap',
        connected: response.data.status === 'connected',
        version: response.data.version || 'Unknown',
        tables: response.data.tables || [],
        totalSize: response.data.totalSize || '0 MB',
        connectionPool: response.data.connectionPool
      };
    } catch (error) {
      throw new Error(`Failed to get database status: ${error.message}`);
    }
  }

  async initializeSchema(): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/init-db`, {
        action: 'initialize'
      }, {
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`Failed to initialize schema: ${error.message}`);
    }
  }

  async dropTables(): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/init-db`, {
        action: 'drop'
      }, {
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`Failed to drop tables: ${error.message}`);
    }
  }

  async seedTestData(): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/init-db`, {
        action: 'seed'
      }, {
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`Failed to seed test data: ${error.message}`);
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/test-db/query`, {
        query
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  async readSQLFile(filePath: string): Promise<string> {
    // In a real implementation, this would read from filesystem
    throw new Error('SQL file reading not implemented');
  }

  formatAsCSV(rows: any[]): string {
    if (rows.length === 0) return '';
    
    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row => headers.map(header => row[header]).join(','))
    ];
    
    return csvRows.join('\n');
  }

  async createBackup(options: {
    outputPath: string;
    tables?: string[];
    compress?: boolean;
  }): Promise<{
    path: string;
    size: string;
    tableCount: number;
    totalRows: number;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/test-db/backup`, options, {
        timeout: 120000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  async restoreBackup(backupPath: string): Promise<{
    tableCount: number;
    totalRows: number;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/test-db/restore`, {
        backupPath
      }, {
        timeout: 120000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  async analyzeCleanup(cutoffDate: Date): Promise<{
    tables: Array<{
      name: string;
      totalRows: number;
      oldRows: number;
      sizeSaved: string;
    }>;
    totalOldRows: number;
    totalSizeSaved: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/test-db/analyze-cleanup`, {
        cutoffDate: cutoffDate.toISOString()
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Cleanup analysis failed: ${error.message}`);
    }
  }

  async performCleanup(cutoffDate: Date): Promise<{
    deletedRows: number;
    freedSpace: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/test-db/cleanup`, {
        cutoffDate: cutoffDate.toISOString()
      }, {
        timeout: 120000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  async vacuum(): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/test-db/vacuum`, {}, {
        timeout: 120000
      });
    } catch (error) {
      throw new Error(`Vacuum failed: ${error.message}`);
    }
  }

  async getMetrics(): Promise<{
    activeConnections: number;
    maxConnections: number;
    queriesPerSecond: number;
    cacheHitRatio: number;
    databaseSize: string;
    recentActivity: Array<{
      timestamp: string;
      type: string;
      table: string;
      duration: number;
      rowsAffected?: number;
    }>;
    activeQueries: Array<{
      id: string;
      duration: number;
      state: string;
      query: string;
    }>;
  }> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/test-db/metrics`, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }
}