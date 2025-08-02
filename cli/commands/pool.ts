import { Command } from 'commander';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { PoolManager } from '../services/pool-manager';

export const poolCommand = new Command('pool')
  .description('Manage and monitor pool liquidity');

// Check pool status
poolCommand
  .command('status')
  .description('Check current pool status and liquidity')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('--detailed', 'show detailed token information')
  .action(async (options) => {
    logger.heading('💰 Pool Status');
    
    const poolManager = new PoolManager(options.network);

    try {
      spinner.start('status', 'Fetching pool status...');
      const status = await poolManager.getPoolStatus();
      spinner.succeed('status', 'Pool status retrieved');

      logger.info(`Pool Health: ${status.health === 'healthy' ? '🟢' : status.health === 'warning' ? '🟡' : '🔴'} ${status.health.toUpperCase()}`);
      logger.info(`Total Tokens: ${status.totalTokens}`);
      logger.info(`Active Reserves: ${status.activeReserves}`);
      logger.info(`Total Value Locked: $${status.totalValueUSD.toFixed(2)}`);

      if (status.tokens.length > 0) {
        logger.separator();
        logger.heading('Token Balances');
        
        logger.table(status.tokens.map(token => ({
          Symbol: token.symbol,
          Address: options.detailed ? token.address : token.address.substring(0, 10) + '...',
          'Total Balance': token.totalBalance,
          'Available': token.availableBalance,
          'Reserved': token.reservedBalance,
          'USD Value': `$${token.usdValue.toFixed(2)}`,
          Status: token.status === 'healthy' ? '🟢' : token.status === 'low' ? '🟡' : '🔴'
        })));
      }

      if (status.recentActivity.length > 0) {
        logger.separator();
        logger.heading('Recent Activity');
        
        logger.table(status.recentActivity.map(activity => ({
          Time: new Date(activity.timestamp).toLocaleTimeString(),
          Type: activity.type,
          Token: activity.token,
          Amount: activity.amount,
          'Tx Hash': activity.txHash?.substring(0, 10) + '...'
        })));
      }

    } catch (error) {
      spinner.fail('status', 'Failed to fetch pool status');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Add liquidity to pool
poolCommand
  .command('add')
  .description('Add liquidity to the pool')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-t, --token <address>', 'token address to add')
  .option('-a, --amount <amount>', 'amount to add')
  .option('--dry-run', 'simulate without executing')
  .action(async (options) => {
    logger.heading('➕ Add Pool Liquidity');
    
    const poolManager = new PoolManager(options.network);

    try {
      if (!options.token || !options.amount) {
        logger.error('Token address and amount are required');
        process.exit(1);
      }

      if (options.dryRun) {
        spinner.start('simulate', 'Simulating liquidity addition...');
        const simulation = await poolManager.simulateAddLiquidity(options.token, options.amount);
        spinner.succeed('simulate', 'Simulation completed');
        
        logger.info('Simulation Results:');
        logger.json(simulation);
      } else {
        spinner.start('add', 'Adding liquidity to pool...');
        const result = await poolManager.addLiquidity(options.token, options.amount);
        spinner.succeed('add', 'Liquidity added successfully');
        
        logger.success(`Added ${options.amount} tokens to pool`);
        logger.info(`Transaction: ${result.txHash}`);
        logger.info(`Gas Used: ${result.gasUsed}`);
      }

    } catch (error) {
      spinner.fail('add', 'Failed to add liquidity');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Remove liquidity from pool
poolCommand
  .command('remove')
  .description('Remove liquidity from the pool')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-t, --token <address>', 'token address to remove')
  .option('-a, --amount <amount>', 'amount to remove')
  .option('--emergency', 'emergency drain (removes all)')
  .action(async (options) => {
    logger.heading('➖ Remove Pool Liquidity');
    
    const poolManager = new PoolManager(options.network);

    try {
      if (!options.token) {
        logger.error('Token address is required');
        process.exit(1);
      }

      if (options.emergency) {
        logger.warn('⚠️  EMERGENCY DRAIN MODE');
        logger.warn('This will remove ALL liquidity for the token');
        
        spinner.start('drain', 'Performing emergency drain...');
        const result = await poolManager.emergencyDrain(options.token);
        spinner.succeed('drain', 'Emergency drain completed');
        
        logger.success(`Drained ${result.amount} tokens from pool`);
        logger.info(`Transaction: ${result.txHash}`);
      } else {
        if (!options.amount) {
          logger.error('Amount is required (or use --emergency)');
          process.exit(1);
        }

        spinner.start('remove', 'Removing liquidity from pool...');
        const result = await poolManager.removeLiquidity(options.token, options.amount);
        spinner.succeed('remove', 'Liquidity removed successfully');
        
        logger.success(`Removed ${options.amount} tokens from pool`);
        logger.info(`Transaction: ${result.txHash}`);
      }

    } catch (error) {
      spinner.fail('remove', 'Failed to remove liquidity');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Rebalance pool
poolCommand
  .command('rebalance')
  .description('Rebalance pool liquidity')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('--auto', 'automatic rebalancing based on current needs')
  .option('--dry-run', 'simulate rebalancing without executing')
  .action(async (options) => {
    logger.heading('⚖️ Pool Rebalancing');
    
    const poolManager = new PoolManager(options.network);

    try {
      spinner.start('analyze', 'Analyzing pool balance...');
      const analysis = await poolManager.analyzeRebalancing();
      spinner.succeed('analyze', 'Analysis completed');

      logger.info('Rebalancing Analysis:');
      analysis.recommendations.forEach((rec, index) => {
        logger.info(`${index + 1}. ${rec.action}: ${rec.amount} ${rec.token} (${rec.reason})`);
      });

      if (analysis.recommendations.length === 0) {
        logger.success('Pool is well balanced, no rebalancing needed');
        return;
      }

      if (options.dryRun) {
        logger.info('Dry run completed - no changes made');
        return;
      }

      if (options.auto) {
        spinner.start('rebalance', 'Executing rebalancing...');
        const result = await poolManager.executeRebalancing(analysis.recommendations);
        spinner.succeed('rebalance', 'Rebalancing completed');
        
        logger.success(`Executed ${result.actions.length} rebalancing actions`);
        result.actions.forEach(action => {
          logger.info(`✅ ${action.action}: ${action.amount} ${action.token} (${action.txHash.substring(0, 10)}...)`);
        });
      } else {
        logger.warn('Use --auto to execute rebalancing or --dry-run to simulate');
      }

    } catch (error) {
      spinner.fail('rebalance', 'Rebalancing failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Monitor pool in real-time
poolCommand
  .command('monitor')
  .description('Monitor pool activity in real-time')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('--refresh <seconds>', 'refresh interval', '15')
  .option('--alerts', 'enable low liquidity alerts')
  .action(async (options) => {
    logger.heading('📊 Pool Monitor');
    
    const poolManager = new PoolManager(options.network);
    const refreshInterval = parseInt(options.refresh) * 1000;

    const monitor = async () => {
      try {
        const status = await poolManager.getPoolStatus();
        const metrics = await poolManager.getPoolMetrics();

        console.clear();
        logger.heading(`📊 Pool Monitor (${new Date().toLocaleTimeString()})`);
        
        // Overall health
        logger.info(`Health: ${status.health === 'healthy' ? '🟢' : status.health === 'warning' ? '🟡' : '🔴'} ${status.health.toUpperCase()}`);
        logger.info(`TVL: $${status.totalValueUSD.toFixed(2)}`);
        logger.info(`24h Volume: $${metrics.volume24h.toFixed(2)}`);
        logger.info(`Active Swaps: ${metrics.activeSwaps}`);

        // Token status
        logger.separator();
        logger.table(status.tokens.map(token => ({
          Token: token.symbol,
          Available: token.availableBalance,
          Reserved: token.reservedBalance,
          Utilization: `${((parseFloat(token.reservedBalance) / parseFloat(token.totalBalance)) * 100).toFixed(1)}%`,
          Status: token.status === 'healthy' ? '🟢' : token.status === 'low' ? '🟡' : '🔴'
        })));

        // Alerts
        if (options.alerts) {
          const lowLiquidityTokens = status.tokens.filter(t => t.status === 'low' || t.status === 'critical');
          if (lowLiquidityTokens.length > 0) {
            logger.separator();
            logger.warn('🚨 LOW LIQUIDITY ALERTS:');
            lowLiquidityTokens.forEach(token => {
              logger.warn(`  ${token.symbol}: ${token.availableBalance} available (${token.status})`);
            });
          }
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
      logger.info('\nPool monitor stopped');
      process.exit(0);
    });
  });