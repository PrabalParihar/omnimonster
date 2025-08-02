import { Command } from 'commander';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { config } from '../config/config';
import { HealthChecker } from '../services/health-checker';

export const healthCommand = new Command('health')
  .description('Check health of all Fusion Swap backend systems')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-v, --verbose', 'verbose output')
  .option('--skip-contracts', 'skip contract health checks')
  .option('--skip-db', 'skip database health checks')
  .option('--skip-api', 'skip API health checks')
  .action(async (options) => {
    logger.heading('🔍 Fusion Swap Health Check');
    
    if (options.verbose) {
      logger.setLevel(0); // DEBUG level
    }

    const healthChecker = new HealthChecker(options.network);
    const results: any = {};

    try {
      // Configuration validation
      spinner.start('config', 'Validating configuration...');
      const configErrors = config.validateConfig();
      if (configErrors.length > 0) {
        spinner.fail('config', 'Configuration validation failed');
        logger.error('Configuration errors:');
        configErrors.forEach(error => logger.error(`  - ${error}`));
        results.config = { status: 'error', errors: configErrors };
      } else {
        spinner.succeed('config', 'Configuration validated');
        results.config = { status: 'healthy' };
      }

      // Database health check
      if (!options.skipDb) {
        spinner.start('database', 'Checking database connection...');
        try {
          const dbHealth = await healthChecker.checkDatabase();
          if (dbHealth.status === 'healthy') {
            spinner.succeed('database', `Database connected (${dbHealth.responseTime}ms)`);
          } else {
            spinner.fail('database', 'Database connection failed');
          }
          results.database = dbHealth;
        } catch (error) {
          spinner.fail('database', 'Database health check failed');
          logger.error('Database error:', error);
          results.database = { status: 'error', error: error.message };
        }
      }

      // API health check
      if (!options.skipApi) {
        spinner.start('api', 'Checking API endpoints...');
        try {
          const apiHealth = await healthChecker.checkAPI();
          if (apiHealth.status === 'healthy') {
            spinner.succeed('api', `API healthy (${apiHealth.endpoints.healthy}/${apiHealth.endpoints.total} endpoints up)`);
          } else {
            spinner.fail('api', 'API health check failed');
          }
          results.api = apiHealth;
        } catch (error) {
          spinner.fail('api', 'API health check failed');
          logger.error('API error:', error);
          results.api = { status: 'error', error: error.message };
        }
      }

      // Contract health check
      if (!options.skipContracts) {
        spinner.start('contracts', 'Checking smart contracts...');
        try {
          const contractHealth = await healthChecker.checkContracts();
          if (contractHealth.status === 'healthy') {
            spinner.succeed('contracts', `Contracts healthy (${contractHealth.deployed}/${contractHealth.total} deployed)`);
          } else {
            spinner.fail('contracts', 'Contract health check failed');
          }
          results.contracts = contractHealth;
        } catch (error) {
          spinner.fail('contracts', 'Contract health check failed');
          logger.error('Contract error:', error);
          results.contracts = { status: 'error', error: error.message };
        }
      }

      // Services health check
      spinner.start('services', 'Checking backend services...');
      try {
        const servicesHealth = await healthChecker.checkServices();
        if (servicesHealth.status === 'healthy') {
          spinner.succeed('services', `Services healthy (${servicesHealth.healthy}/${servicesHealth.total} services up)`);
        } else {
          spinner.fail('services', 'Services health check failed');
        }
        results.services = servicesHealth;
      } catch (error) {
        spinner.fail('services', 'Services health check failed');
        logger.error('Services error:', error);
        results.services = { status: 'error', error: error.message };
      }

      // Overall health summary
      logger.separator();
      logger.heading('📊 Health Summary');
      
      const overallHealth = healthChecker.calculateOverallHealth(results);
      
      if (overallHealth.status === 'healthy') {
        logger.success(`🟢 System Status: HEALTHY (${overallHealth.score}% healthy)`);
      } else if (overallHealth.status === 'degraded') {
        logger.warn(`🟡 System Status: DEGRADED (${overallHealth.score}% healthy)`);
      } else {
        logger.error(`🔴 System Status: UNHEALTHY (${overallHealth.score}% healthy)`);
      }

      if (options.verbose) {
        logger.json(results, 'Detailed Results');
      }

      // Exit with appropriate code
      process.exit(overallHealth.status === 'healthy' ? 0 : 1);

    } catch (error) {
      spinner.stopAll();
      logger.error('Health check failed:', error);
      process.exit(1);
    }
  });