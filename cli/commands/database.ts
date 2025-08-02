import { Command } from 'commander';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { DatabaseManager } from '../services/database-manager';

export const dbCommand = new Command('db')
  .description('Database management and operations');

// Initialize database
dbCommand
  .command('init')
  .description('Initialize database schema')
  .option('--drop-existing', 'drop existing tables first')
  .option('--seed', 'seed with test data')
  .action(async (options) => {
    logger.heading('🗄️ Database Initialization');
    
    const dbManager = new DatabaseManager();

    try {
      if (options.dropExisting) {
        spinner.start('drop', 'Dropping existing tables...');
        await dbManager.dropTables();
        spinner.succeed('drop', 'Existing tables dropped');
      }

      spinner.start('init', 'Creating database schema...');
      await dbManager.initializeSchema();
      spinner.succeed('init', 'Database schema created');

      if (options.seed) {
        spinner.start('seed', 'Seeding test data...');
        await dbManager.seedTestData();
        spinner.succeed('seed', 'Test data seeded');
      }

      logger.success('Database initialization completed');

    } catch (error) {
      spinner.fail('init', 'Database initialization failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Database status
dbCommand
  .command('status')
  .description('Check database status and statistics')
  .option('--detailed', 'show detailed table information')
  .action(async (options) => {
    logger.heading('📊 Database Status');
    
    const dbManager = new DatabaseManager();

    try {
      spinner.start('status', 'Checking database status...');
      const status = await dbManager.getStatus();
      spinner.succeed('status', 'Database status retrieved');

      logger.info(`Database: ${status.database}`);
      logger.info(`Connection Status: ${status.connected ? '🟢 Connected' : '🔴 Disconnected'}`);
      logger.info(`Version: ${status.version}`);
      logger.info(`Total Tables: ${status.tables.length}`);
      logger.info(`Total Size: ${status.totalSize}`);

      if (options.detailed && status.tables.length > 0) {
        logger.separator();
        logger.heading('Table Details');
        
        logger.table(status.tables.map(table => ({
          Table: table.name,
          Rows: table.rowCount.toLocaleString(),
          Size: table.size,
          'Created': table.created,
          'Last Modified': table.lastModified
        })));
      }

      // Connection pool info
      if (status.connectionPool) {
        logger.separator();
        logger.heading('Connection Pool');
        logger.info(`Total Connections: ${status.connectionPool.total}`);
        logger.info(`Active Connections: ${status.connectionPool.active}`);
        logger.info(`Idle Connections: ${status.connectionPool.idle}`);
      }

    } catch (error) {
      spinner.fail('status', 'Failed to check database status');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Query database
dbCommand
  .command('query')
  .description('Execute SQL query')
  .option('-q, --query <sql>', 'SQL query to execute')
  .option('-f, --file <path>', 'SQL file to execute')
  .option('--format <format>', 'output format (table|json|csv)', 'table')
  .action(async (options) => {
    logger.heading('🔍 Database Query');
    
    const dbManager = new DatabaseManager();

    try {
      let query = options.query;
      
      if (options.file) {
        query = await dbManager.readSQLFile(options.file);
      }

      if (!query) {
        logger.error('Query or file is required');
        process.exit(1);
      }

      spinner.start('query', 'Executing query...');
      const result = await dbManager.executeQuery(query);
      spinner.succeed('query', `Query executed (${result.rowCount} rows)`);

      if (result.rows.length > 0) {
        switch (options.format) {
          case 'json':
            logger.json(result.rows);
            break;
          case 'csv':
            logger.info(dbManager.formatAsCSV(result.rows));
            break;
          default:
            logger.table(result.rows);
        }
      } else {
        logger.info('No results returned');
      }

    } catch (error) {
      spinner.fail('query', 'Query execution failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Backup database
dbCommand
  .command('backup')
  .description('Create database backup')
  .option('-o, --output <path>', 'backup file path')
  .option('--tables <tables>', 'comma-separated list of tables to backup')
  .option('--compress', 'compress backup file')
  .action(async (options) => {
    logger.heading('💾 Database Backup');
    
    const dbManager = new DatabaseManager();

    try {
      const backupPath = options.output || `fusion_backup_${Date.now()}.sql`;
      const tables = options.tables ? options.tables.split(',') : undefined;

      spinner.start('backup', 'Creating database backup...');
      const result = await dbManager.createBackup({
        outputPath: backupPath,
        tables,
        compress: options.compress
      });
      spinner.succeed('backup', 'Backup created successfully');

      logger.success(`Backup saved to: ${result.path}`);
      logger.info(`Size: ${result.size}`);
      logger.info(`Tables: ${result.tableCount}`);
      logger.info(`Rows: ${result.totalRows.toLocaleString()}`);

    } catch (error) {
      spinner.fail('backup', 'Backup failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Restore database
dbCommand
  .command('restore')
  .description('Restore database from backup')
  .option('-i, --input <path>', 'backup file path')
  .option('--drop-existing', 'drop existing data before restore')
  .action(async (options) => {
    logger.heading('🔄 Database Restore');
    
    const dbManager = new DatabaseManager();

    try {
      if (!options.input) {
        logger.error('Input backup file is required');
        process.exit(1);
      }

      if (options.dropExisting) {
        logger.warn('⚠️  This will drop all existing data!');
        spinner.start('drop', 'Dropping existing data...');
        await dbManager.dropTables();
        spinner.succeed('drop', 'Existing data dropped');
      }

      spinner.start('restore', 'Restoring database from backup...');
      const result = await dbManager.restoreBackup(options.input);
      spinner.succeed('restore', 'Database restored successfully');

      logger.success(`Restored ${result.tableCount} tables`);
      logger.info(`Total rows: ${result.totalRows.toLocaleString()}`);

    } catch (error) {
      spinner.fail('restore', 'Restore failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Clean up database
dbCommand
  .command('cleanup')
  .description('Clean up old data and optimize database')
  .option('--older-than <days>', 'delete records older than X days', '30')
  .option('--dry-run', 'show what would be cleaned without doing it')
  .option('--vacuum', 'run vacuum after cleanup')
  .action(async (options) => {
    logger.heading('🧹 Database Cleanup');
    
    const dbManager = new DatabaseManager();

    try {
      const olderThanDays = parseInt(options.olderThan);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      spinner.start('cleanup', 'Analyzing data for cleanup...');
      const analysis = await dbManager.analyzeCleanup(cutoffDate);
      spinner.succeed('cleanup', 'Cleanup analysis completed');

      logger.info('Cleanup Analysis:');
      logger.table(analysis.tables.map(table => ({
        Table: table.name,
        'Total Rows': table.totalRows.toLocaleString(),
        'Old Rows': table.oldRows.toLocaleString(),
        'Size Saved': table.sizeSaved,
        Status: table.oldRows > 0 ? '🗑️ Can Clean' : '✅ Clean'
      })));

      if (options.dryRun) {
        logger.info(`Total rows to delete: ${analysis.totalOldRows.toLocaleString()}`);
        logger.info(`Total size to free: ${analysis.totalSizeSaved}`);
        logger.info('Run without --dry-run to perform cleanup');
        return;
      }

      if (analysis.totalOldRows > 0) {
        spinner.start('delete', 'Deleting old records...');
        const result = await dbManager.performCleanup(cutoffDate);
        spinner.succeed('delete', 'Old records deleted');

        logger.success(`Deleted ${result.deletedRows.toLocaleString()} rows`);
        logger.info(`Freed ${result.freedSpace} of space`);

        if (options.vacuum) {
          spinner.start('vacuum', 'Optimizing database...');
          await dbManager.vacuum();
          spinner.succeed('vacuum', 'Database optimized');
        }
      } else {
        logger.success('No old data to clean up');
      }

    } catch (error) {
      spinner.fail('cleanup', 'Cleanup failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Monitor database
dbCommand
  .command('monitor')
  .description('Monitor database activity in real-time')
  .option('--refresh <seconds>', 'refresh interval', '5')
  .option('--show-queries', 'show active queries')
  .action(async (options) => {
    logger.heading('📈 Database Monitor');
    
    const dbManager = new DatabaseManager();
    const refreshInterval = parseInt(options.refresh) * 1000;

    const monitor = async () => {
      try {
        const metrics = await dbManager.getMetrics();

        console.clear();
        logger.heading(`📈 Database Monitor (${new Date().toLocaleTimeString()})`);
        
        logger.info(`Connections: ${metrics.activeConnections}/${metrics.maxConnections}`);
        logger.info(`Queries/sec: ${metrics.queriesPerSecond}`);
        logger.info(`Cache Hit Ratio: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`);
        logger.info(`Database Size: ${metrics.databaseSize}`);

        // Recent activity
        if (metrics.recentActivity.length > 0) {
          logger.separator();
          logger.heading('Recent Activity');
          
          logger.table(metrics.recentActivity.map(activity => ({
            Time: new Date(activity.timestamp).toLocaleTimeString(),
            Type: activity.type,
            Table: activity.table,
            Duration: `${activity.duration}ms`,
            Rows: activity.rowsAffected || 'N/A'
          })));
        }

        // Active queries
        if (options.showQueries && metrics.activeQueries.length > 0) {
          logger.separator();
          logger.heading('Active Queries');
          
          logger.table(metrics.activeQueries.map(query => ({
            ID: query.id,
            Duration: `${query.duration}ms`,
            State: query.state,
            Query: query.query.substring(0, 50) + '...'
          })));
        }

        logger.info(`\nRefreshing in ${options.refresh}s... (Press Ctrl+C to exit)`);
        
      } catch (error) {
        logger.error('Monitor error:', error);
      }
    };

    // Initial load
    await monitor();
    
    // Set up refresh interval
    const interval = setInterval(monitor, refreshInterval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      logger.info('\nDatabase monitor stopped');
      process.exit(0);
    });
  });