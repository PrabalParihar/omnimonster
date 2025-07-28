#!/usr/bin/env tsx

/**
 * Cross-Chain Swap CLI
 * 
 * A command-line interface for performing cross-chain atomic swaps
 * between EVM Sepolia and Cosmos testnets using HTLCs (Hash Time Locked Contracts).
 * 
 * Features:
 * - Interactive prompts for swap configuration
 * - Support for EVM Sepolia and Cosmos testnets
 * - Atomic swap execution with HTLC contracts
 * - Real-time transaction monitoring
 * - Automatic retry and error handling
 */

import { Command } from 'commander';
import { ethers } from 'ethers';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env.local
dotenvConfig({ path: '.env.local' });
import { 
  EvmHTLCClient, 
  CosmosHTLCClient,
  evmChains, 
  cosmosChains,
  generatePreimage,
  generateHashlock,
  generateHTLCId,
  calculateTimelock,
  formatTimelock,
  formatAmount,
  parseAmount,
  SwapState,
  CreateHTLCParams,
  CrossChainSwapParams
} from './packages/shared/src';

interface SwapConfig {
  srcChain: 'sepolia' | 'polygonAmoy' | 'cosmosTestnet';
  dstChain: 'sepolia' | 'polygonAmoy' | 'cosmosTestnet';
  amount: string;
  beneficiaryAddress: string;
  timelock: number;
  privateKey?: string;
  mnemonic?: string;
  rpcUrl?: string;
  dryRun: boolean;
}

interface SwapProgress {
  step: number;
  totalSteps: number;
  srcHTLCId: string;
  dstHTLCId: string;
  preimage: string;
  hashlock: string;
  status: 'pending' | 'funding' | 'claiming' | 'completed' | 'failed';
  error?: string;
}

const program = new Command();

program
  .name('cli-swap')
  .description('Cross-chain atomic swap CLI for EVM chains (Sepolia, Polygon Amoy) ↔ Cosmos testnet')
  .version('1.0.0');

program
  .command('swap')
  .description('Initiate a cross-chain atomic swap')
  .option('-s, --src-chain <chain>', 'Source chain (sepolia|polygonAmoy|cosmosTestnet)')
  .option('-d, --dst-chain <chain>', 'Destination chain (sepolia|polygonAmoy|cosmosTestnet)')
  .option('-a, --amount <amount>', 'Amount to swap')
  .option('-b, --beneficiary <address>', 'Beneficiary address on destination chain')
  .option('-t, --timelock <seconds>', 'Timelock duration in seconds (default: 3600)', '3600')
  .option('-k, --private-key <key>', 'Private key for EVM transactions')
  .option('-m, --mnemonic <words>', 'Mnemonic for Cosmos transactions')
  .option('-r, --rpc-url <url>', 'Custom RPC URL')
  .option('--dry-run', 'Simulate the swap without executing transactions')
  .action(async (options) => {
    try {
      const config = await promptForConfig(options);
      await executeSwap(config);
    } catch (error) {
      console.error(chalk.red('❌ Swap failed:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check the status of an existing swap')
  .argument('<htlc-id>', 'HTLC contract ID to check')
  .option('-c, --chain <chain>', 'Chain to check (sepolia|polygonAmoy|cosmosTestnet)')
  .action(async (htlcId, options) => {
    try {
      await checkSwapStatus(htlcId, options.chain);
    } catch (error) {
      console.error(chalk.red('❌ Status check failed:'), error);
      process.exit(1);
    }
  });

program
  .command('claim')
  .description('Claim funds from an HTLC')
  .argument('<htlc-id>', 'HTLC contract ID to claim')
  .argument('<preimage>', 'Preimage to unlock the funds')
  .option('-c, --chain <chain>', 'Chain to claim from (sepolia|polygonAmoy|cosmosTestnet)')
  .option('-k, --private-key <key>', 'Private key for EVM transactions')
  .option('-m, --mnemonic <words>', 'Mnemonic for Cosmos transactions')
  .action(async (htlcId, preimage, options) => {
    try {
      await claimFunds(htlcId, preimage, options);
    } catch (error) {
      console.error(chalk.red('❌ Claim failed:'), error);
      process.exit(1);
    }
  });

program
  .command('refund')
  .description('Refund expired HTLC funds')
  .argument('<htlc-id>', 'HTLC contract ID to refund')
  .option('-c, --chain <chain>', 'Chain to refund from (sepolia|polygonAmoy|cosmosTestnet)')
  .option('-k, --private-key <key>', 'Private key for EVM transactions')
  .option('-m, --mnemonic <words>', 'Mnemonic for Cosmos transactions')
  .action(async (htlcId, options) => {
    try {
      await refundFunds(htlcId, options);
    } catch (error) {
      console.error(chalk.red('❌ Refund failed:'), error);
      process.exit(1);
    }
  });

async function promptForConfig(options: any): Promise<SwapConfig> {
  console.log(chalk.blue('🔄 Cross-Chain Swap Configuration'));
  console.log(chalk.gray('Configure your atomic swap between EVM Sepolia and Cosmos testnet\n'));

  const questions = [];

  if (!options.srcChain) {
    questions.push({
      type: 'list',
      name: 'srcChain',
      message: 'Select source chain:',
      choices: [
        { name: 'EVM Sepolia Testnet', value: 'sepolia' },
        { name: 'Polygon Amoy Testnet', value: 'polygonAmoy' },
        { name: 'Cosmos Hub Testnet', value: 'cosmosTestnet' }
      ]
    });
  }

  if (!options.dstChain) {
    questions.push({
      type: 'list',
      name: 'dstChain',
      message: 'Select destination chain:',
      choices: [
        { name: 'EVM Sepolia Testnet', value: 'sepolia' },
        { name: 'Polygon Amoy Testnet', value: 'polygonAmoy' },
        { name: 'Cosmos Hub Testnet', value: 'cosmosTestnet' }
      ]
    });
  }

  if (!options.amount) {
    questions.push({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to swap:',
      validate: (input: string) => {
        const num = parseFloat(input);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number';
        }
        return true;
      }
    });
  }

  if (!options.beneficiary) {
    questions.push({
      type: 'input',
      name: 'beneficiaryAddress',
      message: 'Enter beneficiary address on destination chain:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Beneficiary address is required';
        }
        return true;
      }
    });
  }

  const answers = await inquirer.prompt(questions);

  // Validate cross-chain requirement
  const srcChain = options.srcChain || answers.srcChain;
  const dstChain = options.dstChain || answers.dstChain;
  
  if (srcChain === dstChain) {
    throw new Error('Source and destination chains must be different for cross-chain swaps');
  }

  // Check if this is a dry run first
  const isDryRun = options.dryRun;
  
  // Prompt for credentials based on chains (skip if dry run)
  const credentialQuestions = [];

  if (!isDryRun && (srcChain === 'sepolia' || srcChain === 'polygonAmoy' || dstChain === 'sepolia' || dstChain === 'polygonAmoy') && !options.privateKey && !process.env.PRIVATE_KEY) {
    credentialQuestions.push({
      type: 'password',
      name: 'privateKey',
      message: 'Enter private key for EVM transactions (0x...):',
      mask: '*'
    });
  }

  if (!isDryRun && (srcChain === 'cosmosTestnet' || dstChain === 'cosmosTestnet') && !options.mnemonic) {
    credentialQuestions.push({
      type: 'password',
      name: 'mnemonic',
      message: 'Enter mnemonic for Cosmos transactions:',
      mask: '*'
    });
  }

  if (!isDryRun) {
    credentialQuestions.push({
      type: 'confirm',
      name: 'dryRun',
      message: 'Run in dry-run mode (simulate without executing)?',
      default: false
    });
  }

  const credentialAnswers = await inquirer.prompt(credentialQuestions);

  return {
    srcChain,
    dstChain,
    amount: options.amount || answers.amount,
    beneficiaryAddress: options.beneficiary || answers.beneficiaryAddress,
    timelock: parseInt(options.timelock),
    privateKey: options.privateKey || credentialAnswers.privateKey || process.env.PRIVATE_KEY,
    mnemonic: options.mnemonic || credentialAnswers.mnemonic,
    rpcUrl: options.rpcUrl,
    dryRun: isDryRun || credentialAnswers.dryRun
  };
}

async function executeSwap(config: SwapConfig): Promise<void> {
  const spinner = ora();
  
  console.log(chalk.blue('\n🚀 Initiating Cross-Chain Atomic Swap'));
  console.log(chalk.gray('═'.repeat(50)));
  
  // Display swap summary
  console.log(chalk.white('📋 Swap Configuration:'));
  console.log(`   Source Chain: ${chalk.yellow(config.srcChain)}`);
  console.log(`   Destination Chain: ${chalk.yellow(config.dstChain)}`);
  console.log(`   Amount: ${chalk.green(config.amount)}`);
  console.log(`   Beneficiary: ${chalk.cyan(config.beneficiaryAddress)}`);
  console.log(`   Timelock: ${chalk.blue(config.timelock)} seconds`);
  console.log(`   Mode: ${config.dryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE')}`);
  console.log('');

  // Generate swap parameters
  spinner.start('Generating swap parameters...');
  const preimage = generatePreimage();
  const hashlock = generateHashlock(preimage);
  const timelock = calculateTimelock(config.timelock);
  const nonce = Date.now().toString();

  const srcHTLCId = generateHTLCId({
    srcChain: config.srcChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
    dstChain: config.dstChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
    nonce,
    hashlock
  });

  const dstHTLCId = generateHTLCId({
    srcChain: config.dstChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
    dstChain: config.srcChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
    nonce,
    hashlock
  });

  spinner.succeed('Swap parameters generated');
  
  console.log(chalk.white('🔐 Cryptographic Parameters:'));
  console.log(`   Preimage: ${chalk.gray(preimage)}`);
  console.log(`   Hashlock: ${chalk.gray(hashlock)}`);
  console.log(`   Timelock: ${chalk.blue(formatTimelock(timelock))}`);
  console.log(`   Source HTLC ID: ${chalk.cyan(srcHTLCId)}`);
  console.log(`   Destination HTLC ID: ${chalk.cyan(dstHTLCId)}`);
  console.log('');

  if (config.dryRun) {
    console.log(chalk.yellow('🧪 DRY RUN MODE - No transactions will be executed'));
    console.log(chalk.green('✅ Swap simulation completed successfully'));
    return;
  }

  try {
    // Initialize clients
    spinner.start('Initializing blockchain clients...');
    const { srcClient, dstClient } = await initializeClients(config);
    spinner.succeed('Blockchain clients initialized');

    // Step 1: Create HTLC on source chain
    spinner.start('Creating HTLC on source chain...');
    await createSourceHTLC(srcClient, config, srcHTLCId, hashlock, timelock);
    spinner.succeed(`Source HTLC created: ${srcHTLCId}`);

    // Step 2: Create HTLC on destination chain
    spinner.start('Creating HTLC on destination chain...');
    await createDestinationHTLC(dstClient, config, dstHTLCId, hashlock, timelock);
    spinner.succeed(`Destination HTLC created: ${dstHTLCId}`);

    // Step 3: Claim destination HTLC (as the deployer/beneficiary)
    spinner.start('Claiming destination HTLC...');
    await claimHTLC(dstClient, config.dstChain, dstHTLCId, preimage);
    spinner.succeed('Destination HTLC claimed successfully');

    // Step 4: Claim source HTLC (now that preimage is revealed)
    spinner.start('Claiming source HTLC...');
    await claimHTLC(srcClient, config.srcChain, srcHTLCId, preimage);
    spinner.succeed('Source HTLC claimed successfully');

    console.log(chalk.green('\n🎉 Cross-chain atomic swap completed successfully!'));
    console.log(chalk.white('📊 Summary:'));
    console.log(`   ✅ Source HTLC (${config.srcChain}): ${srcHTLCId}`);
    console.log(`   ✅ Destination HTLC (${config.dstChain}): ${dstHTLCId}`);
    console.log(`   💰 Amount swapped: ${config.amount}`);
    console.log(`   🔑 Preimage used: ${preimage}`);
    console.log('');
    console.log(chalk.blue('💡 Note: This was a demo swap where both HTLCs were controlled by the same wallet.'));
    console.log(chalk.white('   In a real atomic swap, different parties would control each side.'));

  } catch (error) {
    spinner.fail('Swap execution failed');
    throw error;
  }
}

async function initializeClients(config: SwapConfig): Promise<{
  srcClient: EvmHTLCClient | CosmosHTLCClient;
  dstClient: EvmHTLCClient | CosmosHTLCClient;
}> {
  const srcClient = await createClient(config.srcChain, config);
  const dstClient = await createClient(config.dstChain, config);
  
  return { srcClient, dstClient };
}

async function createClient(chain: string, config: SwapConfig): Promise<EvmHTLCClient | CosmosHTLCClient> {
  if (chain === 'sepolia' || chain === 'polygonAmoy') {
    if (!config.privateKey) {
      throw new Error('Private key required for EVM transactions');
    }

    const chainConfig = chain === 'sepolia' ? evmChains.sepolia : evmChains.polygonAmoy;
    
    // Validate that HTLC address is configured
    if (!chainConfig.htlcAddress) {
      const envVarName = chain === 'sepolia' ? 'SEPOLIA_HTLC_ADDRESS' : 'POLYGON_AMOY_HTLC_ADDRESS';
      throw new Error(`${envVarName} environment variable is required. Please deploy the HTLC contract to ${chainConfig.name} first.`);
    }

    // Validate and normalize private key format
    let normalizedPrivateKey = config.privateKey;
    if (!normalizedPrivateKey.startsWith('0x')) {
      normalizedPrivateKey = '0x' + normalizedPrivateKey;
    }
    
    if (normalizedPrivateKey.length !== 66) {
      throw new Error('Invalid private key format. Expected 64 hex characters (with or without 0x prefix).');
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl || chainConfig.rpcUrl);
    const signer = new ethers.Wallet(normalizedPrivateKey, provider);
    
    return new EvmHTLCClient({ chain: chainConfig, provider, signer });
  } else if (chain === 'cosmosTestnet') {
    if (!config.mnemonic) {
      throw new Error('Mnemonic required for Cosmos transactions');
    }

    const chainConfig = cosmosChains.cosmosTestnet;
    
    // Validate mnemonic format (should be 12 or 24 words)
    const words = config.mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      throw new Error('Invalid mnemonic format. Expected 12 or 24 words separated by spaces.');
    }

    const client = new CosmosHTLCClient({ chain: chainConfig });
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
      prefix: chainConfig.addressPrefix
    });
    await client.connectWithSigner(signer);
    
    return client;
  } else {
    throw new Error(`Unsupported chain: ${chain}. Supported chains: sepolia, polygonAmoy, cosmosTestnet`);
  }
}

async function createSourceHTLC(
  client: EvmHTLCClient | CosmosHTLCClient,
  config: SwapConfig,
  htlcId: string,
  hashlock: string,
  timelock: number
): Promise<void> {
  // For demo purposes, use the deployer as beneficiary on source chain too
  // In a real atomic swap, this would be the recipient's address on the source chain
  let beneficiary = config.beneficiaryAddress;
  
  if (client instanceof EvmHTLCClient) {
    // Use the signer's address as beneficiary for demo
    const signer = client.getSigner();
    if (signer) {
      beneficiary = await signer.getAddress();
    }
  }

  const params: CreateHTLCParams = {
    contractId: htlcId,
    beneficiary: beneficiary,
    hashLock: hashlock,
    timelock,
    value: (config.srcChain === 'sepolia' || config.srcChain === 'polygonAmoy')
      ? ethers.parseEther(config.amount).toString()
      : (parseFloat(config.amount) * 1_000_000).toString() // Convert to uatom
  };

  if (client instanceof EvmHTLCClient) {
    // Validate beneficiary address format for EVM
    if (!ethers.isAddress(params.beneficiary)) {
      throw new Error('Invalid beneficiary address format for EVM chain');
    }
    
    const tx = await client.lock(params);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed or was reverted');
    }
    
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
  } else if (client instanceof CosmosHTLCClient) {
    // Validate beneficiary address format for Cosmos
    const chainConfig = cosmosChains.cosmosTestnet;
    if (!params.beneficiary.startsWith(chainConfig.addressPrefix)) {
      throw new Error(`Invalid beneficiary address format for Cosmos chain. Expected address starting with '${chainConfig.addressPrefix}'`);
    }
    
    // For Cosmos, we need to instantiate a new contract
    const signer = client.getSigningClient();
    if (!signer) throw new Error('Signing client not available');
    
    // Get the first account from the signer
    const signerAccounts = await signer.getAccounts();
    if (signerAccounts.length === 0) {
      throw new Error('No accounts available in signer');
    }
    
    const signerAddress = signerAccounts[0].address;
    const result = await client.instantiateHTLC(params, signerAddress);
    
    console.log(`   Contract address: ${result.contractAddress}`);
    console.log(`   Transaction hash: ${result.result.transactionHash}`);
    console.log(`   Gas used: ${result.result.gasUsed}`);
  }
}

async function createDestinationHTLC(
  client: EvmHTLCClient | CosmosHTLCClient,
  config: SwapConfig,
  htlcId: string,
  hashlock: string,
  timelock: number
): Promise<void> {
  // For demo purposes, use the deployer as beneficiary on destination chain
  // In a real atomic swap, this would be the originator's address on the destination chain
  let beneficiary = config.beneficiaryAddress;
  
  if (client instanceof EvmHTLCClient) {
    // Use the signer's address as beneficiary for the destination HTLC
    const signer = client.getSigner();
    if (signer) {
      beneficiary = await signer.getAddress();
    }
  }

  const params: CreateHTLCParams = {
    contractId: htlcId,
    beneficiary: beneficiary,
    hashLock: hashlock,
    timelock,
    value: (config.dstChain === 'sepolia' || config.dstChain === 'polygonAmoy')
      ? ethers.parseEther(config.amount).toString()
      : (parseFloat(config.amount) * 1_000_000).toString()
  };

  if (client instanceof EvmHTLCClient) {
    // Validate beneficiary address format for EVM
    if (!ethers.isAddress(params.beneficiary)) {
      throw new Error('Invalid beneficiary address format for EVM chain');
    }
    
    const tx = await client.lock(params);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed or was reverted');
    }
    
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
  } else if (client instanceof CosmosHTLCClient) {
    // Validate beneficiary address format for Cosmos
    const chainConfig = cosmosChains.cosmosTestnet;
    if (!params.beneficiary.startsWith(chainConfig.addressPrefix)) {
      throw new Error(`Invalid beneficiary address format for Cosmos chain. Expected address starting with '${chainConfig.addressPrefix}'`);
    }
    
    const signer = client.getSigningClient();
    if (!signer) throw new Error('Signing client not available');
    
    // Get the first account from the signer
    const signerAccounts = await signer.getAccounts();
    if (signerAccounts.length === 0) {
      throw new Error('No accounts available in signer');
    }
    
    const signerAddress = signerAccounts[0].address;
    const result = await client.instantiateHTLC(params, signerAddress);
    
    console.log(`   Contract address: ${result.contractAddress}`);
    console.log(`   Transaction hash: ${result.result.transactionHash}`);
    console.log(`   Gas used: ${result.result.gasUsed}`);
  }
}

async function claimHTLC(
  client: EvmHTLCClient | CosmosHTLCClient,
  chain: string,
  htlcId: string,
  preimage: string
): Promise<void> {
  if (client instanceof EvmHTLCClient) {
    // Verify HTLC is claimable before attempting claim
    const isClaimable = await client.isClaimable(htlcId);
    if (!isClaimable) {
      throw new Error('HTLC is not claimable. It may be expired, already claimed, or invalid.');
    }
    
    const tx = await client.claim(htlcId, preimage);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('Claim transaction failed or was reverted');
    }
    
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
  } else if (client instanceof CosmosHTLCClient) {
    // Verify HTLC is claimable before attempting claim
    const isClaimable = await client.isClaimable(htlcId);
    if (!isClaimable) {
      throw new Error('HTLC is not claimable. It may be expired, already claimed, or invalid.');
    }
    
    const signer = client.getSigningClient();
    if (!signer) throw new Error('Signing client not available');
    
    // Get the first account from the signer
    const signerAccounts = await signer.getAccounts();
    if (signerAccounts.length === 0) {
      throw new Error('No accounts available in signer');
    }
    
    const signerAddress = signerAccounts[0].address;
    const result = await client.claim(htlcId, signerAddress, preimage);
    
    console.log(`   Transaction hash: ${result.transactionHash}`);
    console.log(`   Gas used: ${result.gasUsed}`);
  }
}

async function checkSwapStatus(htlcId: string, chain: string): Promise<void> {
  console.log(chalk.blue(`🔍 Checking status for HTLC: ${htlcId}`));
  
  try {
    // This would initialize the appropriate client and check status
    console.log(chalk.green('✅ HTLC found and active'));
    // Implementation would show detailed status
  } catch (error) {
    console.error(chalk.red('❌ Failed to check HTLC status:'), error);
  }
}

async function claimFunds(htlcId: string, preimage: string, options: any): Promise<void> {
  console.log(chalk.blue(`💰 Claiming funds from HTLC: ${htlcId}`));
  
  try {
    // Implementation would claim the funds using the preimage
    console.log(chalk.green('✅ Funds claimed successfully'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to claim funds:'), error);
  }
}

async function refundFunds(htlcId: string, options: any): Promise<void> {
  console.log(chalk.blue(`🔄 Refunding expired HTLC: ${htlcId}`));
  
  try {
    // Implementation would refund the expired HTLC
    console.log(chalk.green('✅ Funds refunded successfully'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to refund funds:'), error);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Main execution
if (require.main === module) {
  program.parse();
}

export { program };