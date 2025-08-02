import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { config } from '../config/config';
import { SwapTester } from '../services/swap-tester';

export const swapCommand = new Command('swap')
  .description('Test end-to-end swap functionality');

// Test a complete swap flow
swapCommand
  .command('test')
  .description('Run end-to-end swap test')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-f, --from <token>', 'source token address or symbol')
  .option('-t, --to <token>', 'target token address or symbol')
  .option('-a, --amount <amount>', 'amount to swap')
  .option('--skip-claim', 'skip gasless claim test')
  .option('--timeout <seconds>', 'timeout for test', '300')
  .action(async (options) => {
    logger.heading('🔄 End-to-End Swap Test');
    
    const swapTester = new SwapTester(options.network);
    
    try {
      // Interactive setup if parameters not provided
      let swapParams = {
        from: options.from,
        to: options.to,
        amount: options.amount
      };

      if (!swapParams.from || !swapParams.to || !swapParams.amount) {
        logger.info('Setting up swap test parameters...');
        
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'from',
            message: 'Source token (address or symbol):',
            default: 'USDC',
            when: !swapParams.from
          },
          {
            type: 'input',
            name: 'to',
            message: 'Target token (address or symbol):',
            default: 'USDT',
            when: !swapParams.to
          },
          {
            type: 'input',
            name: 'amount',
            message: 'Amount to swap:',
            default: '10',
            when: !swapParams.amount,
            validate: (input) => {
              const num = parseFloat(input);
              return num > 0 ? true : 'Amount must be greater than 0';
            }
          }
        ]);

        swapParams = { ...swapParams, ...answers };
      }

      // Run the complete swap test
      const result = await swapTester.runCompleteSwapTest({
        sourceToken: swapParams.from,
        targetToken: swapParams.to,
        amount: swapParams.amount,
        skipClaim: options.skipClaim,
        timeout: parseInt(options.timeout) * 1000
      });

      // Display results
      logger.separator();
      logger.heading('📊 Swap Test Results');
      
      if (result.success) {
        logger.success(`✅ Swap test completed successfully in ${result.totalTime}ms`);
        logger.info(`Swap ID: ${result.swapId}`);
        logger.info(`User HTLC: ${result.userHTLC}`);
        logger.info(`Pool HTLC: ${result.poolHTLC}`);
        
        if (result.phases) {
          logger.table(result.phases.map(phase => ({
            Phase: phase.name,
            Status: phase.success ? '✅' : '❌',
            Duration: `${phase.duration}ms`,
            'Gas Used': phase.gasUsed || 'N/A'
          })));
        }
      } else {
        logger.error(`❌ Swap test failed: ${result.error}`);
        if (result.phases) {
          logger.table(result.phases.map(phase => ({
            Phase: phase.name,
            Status: phase.success ? '✅' : '❌',
            Duration: `${phase.duration}ms`,
            Error: phase.error || 'N/A'
          })));
        }
        process.exit(1);
      }

    } catch (error) {
      spinner.stopAll();
      logger.error('Swap test failed:', error);
      process.exit(1);
    }
  });

// Simulate multiple swaps for load testing
swapCommand
  .command('load-test')
  .description('Run multiple concurrent swap tests')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --count <number>', 'number of swaps to test', '5')
  .option('--concurrent <number>', 'concurrent swaps', '2')
  .option('--delay <seconds>', 'delay between swaps', '5')
  .action(async (options) => {
    logger.heading('⚡ Swap Load Test');
    
    const swapTester = new SwapTester(options.network);
    const count = parseInt(options.count);
    const concurrent = parseInt(options.concurrent);
    const delay = parseInt(options.delay) * 1000;

    try {
      const results = await swapTester.runLoadTest({
        count,
        concurrent,
        delay,
        swapParams: {
          sourceToken: 'USDC',
          targetToken: 'USDT',
          amount: '1'
        }
      });

      logger.separator();
      logger.heading('📊 Load Test Results');
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      logger.info(`Total Swaps: ${results.length}`);
      logger.success(`Successful: ${successful}`);
      logger.error(`Failed: ${failed}`);
      logger.info(`Success Rate: ${((successful / results.length) * 100).toFixed(1)}%`);
      
      const times = results.filter(r => r.success).map(r => r.totalTime);
      if (times.length > 0) {
        logger.info(`Average Time: ${Math.round(times.reduce((a, b) => a + b) / times.length)}ms`);
        logger.info(`Min Time: ${Math.min(...times)}ms`);
        logger.info(`Max Time: ${Math.max(...times)}ms`);
      }

      // Show failed swaps
      const failedSwaps = results.filter(r => !r.success);
      if (failedSwaps.length > 0) {
        logger.separator();
        logger.heading('❌ Failed Swaps');
        failedSwaps.forEach((swap, index) => {
          logger.error(`${index + 1}. ${swap.error}`);
        });
      }

    } catch (error) {
      logger.error('Load test failed:', error);
      process.exit(1);
    }
  });

// Monitor ongoing swaps
swapCommand
  .command('monitor')
  .description('Monitor active swaps in real-time')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-u, --user <address>', 'filter by user address')
  .option('-s, --status <status>', 'filter by status (PENDING, POOL_FULFILLED, etc.)')
  .option('--refresh <seconds>', 'refresh interval', '10')
  .action(async (options) => {
    logger.heading('👁️ Swap Monitor');
    
    const swapTester = new SwapTester(options.network);
    const refreshInterval = parseInt(options.refresh) * 1000;

    const monitor = async () => {
      try {
        const swaps = await swapTester.getActiveSwaps({
          userAddress: options.user,
          status: options.status
        });

        console.clear();
        logger.heading(`👁️ Active Swaps (${new Date().toLocaleTimeString()})`);
        
        if (swaps.length === 0) {
          logger.info('No active swaps found');
        } else {
          logger.table(swaps.map(swap => ({
            ID: swap.id.substring(0, 8) + '...',
            User: swap.user_address.substring(0, 8) + '...',
            From: swap.source_token,
            To: swap.target_token,
            Amount: swap.source_amount,
            Status: swap.status,
            Age: swap.age
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
      logger.info('\nMonitor stopped');
      process.exit(0);
    });
  });

// Clean up expired swaps
swapCommand
  .command('cleanup')
  .description('Clean up expired or failed swaps')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('--dry-run', 'show what would be cleaned up without doing it')
  .option('--older-than <hours>', 'clean swaps older than X hours', '24')
  .action(async (options) => {
    logger.heading('🧹 Swap Cleanup');
    
    const swapTester = new SwapTester(options.network);
    const olderThanMs = parseInt(options.olderThan) * 60 * 60 * 1000;

    try {
      const result = await swapTester.cleanupSwaps({
        olderThanMs,
        dryRun: options.dryRun
      });

      if (options.dryRun) {
        logger.info(`Found ${result.expiredSwaps} expired swaps to clean up`);
        logger.info(`Found ${result.failedSwaps} failed swaps to clean up`);
        logger.info('Run without --dry-run to perform cleanup');
      } else {
        logger.success(`Cleaned up ${result.cleanedCount} swaps`);
        logger.info(`Recovered ${result.recoveredFunds} in stuck funds`);
      }

    } catch (error) {
      logger.error('Cleanup failed:', error);
      process.exit(1);
    }
  });