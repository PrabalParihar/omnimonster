import { Command } from 'commander';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { ContractManager } from '../services/contract-manager';

export const contractCommand = new Command('contract')
  .description('Interact with smart contracts');

// Deploy contracts
contractCommand
  .command('deploy')
  .description('Deploy smart contracts')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --contract <name>', 'contract name to deploy')
  .option('--verify', 'verify contract after deployment')
  .action(async (options) => {
    logger.heading('🚀 Contract Deployment');
    
    const contractManager = new ContractManager(options.network);

    try {
      if (options.contract) {
        // Deploy specific contract
        spinner.start('deploy', `Deploying ${options.contract}...`);
        const result = await contractManager.deployContract(options.contract, options.verify);
        spinner.succeed('deploy', `${options.contract} deployed successfully`);
        
        logger.success(`Contract deployed at: ${result.address}`);
        logger.info(`Transaction: ${result.txHash}`);
        logger.info(`Gas Used: ${result.gasUsed}`);
        
        if (options.verify && result.verified) {
          logger.success(`Contract verified on block explorer`);
        }
      } else {
        // Deploy all contracts
        spinner.start('deploy-all', 'Deploying all contracts...');
        const results = await contractManager.deployAllContracts(options.verify);
        spinner.succeed('deploy-all', 'All contracts deployed successfully');
        
        logger.table(results.map(result => ({
          Contract: result.name,
          Address: result.address,
          'Gas Used': result.gasUsed,
          Verified: result.verified ? '✅' : '❌'
        })));
      }

    } catch (error) {
      spinner.fail('deploy', 'Deployment failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Verify contracts
contractCommand
  .command('verify')
  .description('Verify deployed contracts')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --contract <name>', 'contract name to verify')
  .option('-a, --address <address>', 'contract address to verify')
  .action(async (options) => {
    logger.heading('✅ Contract Verification');
    
    const contractManager = new ContractManager(options.network);

    try {
      if (options.contract && options.address) {
        spinner.start('verify', `Verifying ${options.contract}...`);
        const result = await contractManager.verifyContract(options.contract, options.address);
        spinner.succeed('verify', 'Contract verified successfully');
        
        logger.success(`Verification URL: ${result.explorerUrl}`);
      } else {
        spinner.start('verify-all', 'Verifying all deployed contracts...');
        const results = await contractManager.verifyAllContracts();
        spinner.succeed('verify-all', 'All contracts verified');
        
        logger.table(results.map(result => ({
          Contract: result.name,
          Address: result.address,
          Status: result.verified ? '✅ Verified' : '❌ Failed',
          'Explorer URL': result.explorerUrl
        })));
      }

    } catch (error) {
      spinner.fail('verify', 'Verification failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Interact with contracts
contractCommand
  .command('call')
  .description('Call contract function')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --contract <name>', 'contract name')
  .option('-f, --function <name>', 'function name')
  .option('-p, --params <params>', 'function parameters (JSON array)')
  .option('--read-only', 'read-only call (no transaction)')
  .action(async (options) => {
    logger.heading('📞 Contract Function Call');
    
    const contractManager = new ContractManager(options.network);

    try {
      if (!options.contract || !options.function) {
        logger.error('Contract name and function name are required');
        process.exit(1);
      }

      const params = options.params ? JSON.parse(options.params) : [];
      
      if (options.readOnly) {
        spinner.start('call', `Calling ${options.contract}.${options.function}...`);
        const result = await contractManager.callFunction(
          options.contract, 
          options.function, 
          params, 
          true
        );
        spinner.succeed('call', 'Function called successfully');
        
        logger.info('Result:');
        logger.json(result);
      } else {
        spinner.start('call', `Executing ${options.contract}.${options.function}...`);
        const result = await contractManager.callFunction(
          options.contract, 
          options.function, 
          params, 
          false
        );
        spinner.succeed('call', 'Transaction completed successfully');
        
        logger.success(`Transaction: ${result.txHash}`);
        logger.info(`Gas Used: ${result.gasUsed}`);
        if (result.returnValue) {
          logger.info('Return Value:');
          logger.json(result.returnValue);
        }
      }

    } catch (error) {
      spinner.fail('call', 'Function call failed');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Get contract info
contractCommand
  .command('info')
  .description('Get contract information')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --contract <name>', 'contract name')
  .option('-a, --address <address>', 'contract address')
  .action(async (options) => {
    logger.heading('ℹ️ Contract Information');
    
    const contractManager = new ContractManager(options.network);

    try {
      let address = options.address;
      
      if (options.contract && !address) {
        address = contractManager.getContractAddress(options.contract);
      }

      if (!address) {
        logger.error('Contract name or address is required');
        process.exit(1);
      }

      spinner.start('info', 'Fetching contract information...');
      const info = await contractManager.getContractInfo(address);
      spinner.succeed('info', 'Contract information retrieved');

      logger.info(`Address: ${info.address}`);
      logger.info(`Network: ${info.network}`);
      logger.info(`Has Code: ${info.hasCode ? '✅' : '❌'}`);
      logger.info(`Is Contract: ${info.isContract ? '✅' : '❌'}`);
      
      if (info.balance) {
        logger.info(`Balance: ${info.balance} ETH`);
      }

      if (info.verified) {
        logger.success('Contract is verified ✅');
        logger.info(`Contract Name: ${info.contractName}`);
        logger.info(`Compiler Version: ${info.compilerVersion}`);
      }

      if (info.functions && info.functions.length > 0) {
        logger.separator();
        logger.heading('Available Functions');
        
        logger.table(info.functions.map(func => ({
          Name: func.name,
          Type: func.type,
          Inputs: func.inputs?.length || 0,
          Outputs: func.outputs?.length || 0,
          Payable: func.payable ? '💰' : '',
          View: func.view ? '👁️' : ''
        })));
      }

    } catch (error) {
      spinner.fail('info', 'Failed to fetch contract information');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Monitor contract events
contractCommand
  .command('events')
  .description('Monitor contract events')
  .option('-n, --network <network>', 'target network', 'sepolia')
  .option('-c, --contract <name>', 'contract name')
  .option('-e, --event <name>', 'event name to filter')
  .option('--from-block <number>', 'start from block number')
  .option('--live', 'monitor live events')
  .action(async (options) => {
    logger.heading('👀 Contract Events');
    
    const contractManager = new ContractManager(options.network);

    try {
      if (!options.contract) {
        logger.error('Contract name is required');
        process.exit(1);
      }

      if (options.live) {
        logger.info('Monitoring live events... (Press Ctrl+C to stop)');
        
        const subscription = await contractManager.subscribeToEvents(
          options.contract,
          options.event,
          (event) => {
            logger.info(`📡 New Event: ${event.name}`);
            logger.json(event);
            logger.separator();
          }
        );

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          subscription.unsubscribe();
          logger.info('Event monitoring stopped');
          process.exit(0);
        });
      } else {
        spinner.start('events', 'Fetching historical events...');
        const events = await contractManager.getEvents(
          options.contract,
          options.event,
          options.fromBlock ? parseInt(options.fromBlock) : undefined
        );
        spinner.succeed('events', `Found ${events.length} events`);

        if (events.length > 0) {
          logger.table(events.map(event => ({
            Block: event.blockNumber,
            Event: event.name,
            'Tx Hash': event.transactionHash.substring(0, 10) + '...',
            Data: JSON.stringify(event.args).substring(0, 50) + '...'
          })));
        } else {
          logger.info('No events found');
        }
      }

    } catch (error) {
      spinner.fail('events', 'Failed to fetch events');
      logger.error(error.message);
      process.exit(1);
    }
  });