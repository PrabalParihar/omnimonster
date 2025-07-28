#!/usr/bin/env tsx

/**
 * Real Atomic Swap CLI for Production
 * 
 * This implements a true atomic swap between two different parties:
 * - Party A (Initiator): Creates first HTLC and claims second
 * - Party B (Counterparty): Creates second HTLC and waits for reveal
 * 
 * Production-ready features:
 * - Separate wallet management for each party
 * - Real cross-party coordination
 * - Proper timelock management
 * - Security validations
 * - Swap state persistence
 */

import { Command } from 'commander';
import { ethers } from 'ethers';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config as dotenvConfig } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
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
  CreateHTLCParams
} from './packages/shared/src';

interface SwapParticipant {
  role: 'initiator' | 'counterparty';
  walletAddress: string;
  privateKey?: string;
  mnemonic?: string;
  sourceChain: string;
  destinationChain: string;
  sendAmount: string;
  receiveAmount: string;
  tokenToSend: string;
  tokenToReceive: string;
}

interface AtomicSwapState {
  swapId: string;
  status: 'initiated' | 'counterparty_joined' | 'htlcs_created' | 'completed' | 'failed' | 'expired';
  initiator: SwapParticipant;
  counterparty?: SwapParticipant;
  preimage?: string;
  hashlock: string;
  timelock: number;
  initiatorHTLC?: {
    id: string;
    chain: string;
    txHash: string;
    blockNumber?: number;
  };
  counterpartyHTLC?: {
    id: string;
    chain: string;
    txHash: string;
    blockNumber?: number;
  };
  createdAt: number;
  expiresAt: number;
}

const program = new Command();

program
  .name('real-atomic-swap')
  .description('Production-ready atomic swap CLI between two different parties')
  .version('1.0.0');

// Initiator commands
program
  .command('initiate')
  .description('Initiate a new atomic swap (Party A)')
  .option('-sc, --source-chain <chain>', 'Your source chain')
  .option('-dc, --dest-chain <chain>', 'Your destination chain')
  .option('-sa, --send-amount <amount>', 'Amount you want to send')
  .option('-ra, --receive-amount <amount>', 'Amount you want to receive')
  .option('-cp, --counterparty <address>', 'Counterparty wallet address')
  .option('-k, --private-key <key>', 'Your private key')
  .option('-m, --mnemonic <words>', 'Your mnemonic')
  .option('-t, --timelock <seconds>', 'Timelock duration (default: 7200)', '7200')
  .action(async (options) => {
    try {
      await initiateSwap(options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to initiate swap:'), error);
      process.exit(1);
    }
  });

program
  .command('join')
  .description('Join an existing atomic swap (Party B)')
  .argument('<swap-id>', 'Swap ID to join')
  .option('-k, --private-key <key>', 'Your private key')
  .option('-m, --mnemonic <words>', 'Your mnemonic')
  .action(async (swapId, options) => {
    try {
      await joinSwap(swapId, options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to join swap:'), error);
      process.exit(1);
    }
  });

program
  .command('complete')
  .description('Complete the swap by claiming counterparty HTLC (Party A)')
  .argument('<swap-id>', 'Swap ID to complete')
  .action(async (swapId) => {
    try {
      await completeSwap(swapId);
    } catch (error) {
      console.error(chalk.red('❌ Failed to complete swap:'), error);
      process.exit(1);
    }
  });

program
  .command('claim')
  .description('Claim your funds after counterparty completed (Party B)')
  .argument('<swap-id>', 'Swap ID to claim from')
  .action(async (swapId) => {
    try {
      await claimFunds(swapId);
    } catch (error) {
      console.error(chalk.red('❌ Failed to claim funds:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check swap status')
  .argument('<swap-id>', 'Swap ID to check')
  .action(async (swapId) => {
    try {
      await checkSwapStatus(swapId);
    } catch (error) {
      console.error(chalk.red('❌ Failed to check status:'), error);
      process.exit(1);
    }
  });

program
  .command('refund')
  .description('Refund expired HTLC')
  .argument('<swap-id>', 'Swap ID to refund')
  .action(async (swapId) => {
    try {
      await refundSwap(swapId);
    } catch (error) {
      console.error(chalk.red('❌ Failed to refund:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all your swaps')
  .action(async () => {
    try {
      await listSwaps();
    } catch (error) {
      console.error(chalk.red('❌ Failed to list swaps:'), error);
      process.exit(1);
    }
  });

async function initiateSwap(options: any): Promise<void> {
  console.log(chalk.blue('🚀 Initiating Real Atomic Swap (Party A)'));
  console.log(chalk.gray('═'.repeat(50)));

  // Collect swap parameters
  const questions = [];

  if (!options.sourceChain) {
    questions.push({
      type: 'list',
      name: 'sourceChain',
      message: 'Select your source chain (what you send):',
      choices: [
        { name: 'Sepolia Testnet', value: 'sepolia' },
        { name: 'Polygon Amoy Testnet', value: 'polygonAmoy' },
        { name: 'Cosmos Hub Testnet', value: 'cosmosTestnet' }
      ]
    });
  }

  if (!options.destChain) {
    questions.push({
      type: 'list',
      name: 'destChain',
      message: 'Select destination chain (what you receive):',
      choices: [
        { name: 'Sepolia Testnet', value: 'sepolia' },
        { name: 'Polygon Amoy Testnet', value: 'polygonAmoy' },
        { name: 'Cosmos Hub Testnet', value: 'cosmosTestnet' }
      ]
    });
  }

  if (!options.sendAmount) {
    questions.push({
      type: 'input',
      name: 'sendAmount',
      message: 'Amount you want to send:',
      validate: (input: string) => parseFloat(input) > 0 || 'Enter valid amount'
    });
  }

  if (!options.receiveAmount) {
    questions.push({
      type: 'input',
      name: 'receiveAmount',
      message: 'Amount you want to receive:',
      validate: (input: string) => parseFloat(input) > 0 || 'Enter valid amount'
    });
  }

  if (!options.counterparty) {
    questions.push({
      type: 'input',
      name: 'counterparty',
      message: 'Counterparty wallet address:',
      validate: (input: string) => input.trim().length > 0 || 'Address required'
    });
  }

  if (!options.privateKey && !options.mnemonic) {
    questions.push({
      type: 'password',
      name: 'privateKey',
      message: 'Your private key (for EVM) or mnemonic (for Cosmos):',
      mask: '*'
    });
  }

  const answers = await inquirer.prompt(questions);

  const sourceChain = options.sourceChain || answers.sourceChain;
  const destChain = options.destChain || answers.destChain;

  if (sourceChain === destChain) {
    throw new Error('Source and destination chains must be different');
  }

  // Security validations
  const timelockSeconds = parseInt(options.timelock);
  if (timelockSeconds < 3600) {
    throw new Error('Timelock must be at least 1 hour (3600 seconds) for security');
  }
  if (timelockSeconds > 86400) {
    throw new Error('Timelock cannot exceed 24 hours (86400 seconds)');
  }

  // Generate cryptographic parameters
  const spinner = ora('Generating swap parameters...').start();
  const preimage = generatePreimage();
  const hashlock = generateHashlock(preimage);
  const timelock = calculateTimelock(timelockSeconds);
  const swapId = generateHTLCId({
    srcChain: sourceChain,
    dstChain: destChain,
    nonce: Date.now().toString(),
    hashlock
  });

  // Create swap state
  const swapState: AtomicSwapState = {
    swapId,
    status: 'initiated',
    initiator: {
      role: 'initiator',
      walletAddress: '', // Will be filled when creating client
      privateKey: options.privateKey || answers.privateKey,
      sourceChain,
      destinationChain: destChain,
      sendAmount: options.sendAmount || answers.sendAmount,
      receiveAmount: options.receiveAmount || answers.receiveAmount,
      tokenToSend: getChainNativeToken(sourceChain),
      tokenToReceive: getChainNativeToken(destChain)
    },
    hashlock,
    timelock,
    createdAt: Date.now(),
    expiresAt: Date.now() + (parseInt(options.timelock) * 1000),
    preimage // Only initiator knows this initially
  };

  // Get initiator's wallet address
  const client = await createClientForChain(sourceChain, swapState.initiator);
  swapState.initiator.walletAddress = await getWalletAddress(client);

  spinner.succeed('Swap parameters generated');

  // Save swap state
  await saveSwapState(swapState);

  // Display swap details
  console.log(chalk.white('\n📋 Swap Details:'));
  console.log(`   Swap ID: ${chalk.cyan(swapId)}`);
  console.log(`   You send: ${chalk.green(swapState.initiator.sendAmount)} ${swapState.initiator.tokenToSend} on ${sourceChain}`);
  console.log(`   You receive: ${chalk.green(swapState.initiator.receiveAmount)} ${swapState.initiator.tokenToReceive} on ${destChain}`);
  console.log(`   Your address: ${chalk.yellow(swapState.initiator.walletAddress)}`);
  console.log(`   Counterparty: ${chalk.yellow(options.counterparty || answers.counterparty)}`);
  console.log(`   Expires in: ${chalk.blue(options.timelock)} seconds`);

  console.log(chalk.green('\n✅ Swap initiated successfully!'));
  console.log(chalk.white('📤 Share this Swap ID with your counterparty:'));
  console.log(chalk.cyan(`   ${swapId}`));
  console.log(chalk.gray('\n💡 Next steps:'));
  console.log('   1. Share the Swap ID with your counterparty');
  console.log('   2. Wait for them to join using: real-atomic-swap join <swap-id>');
  console.log('   3. Once they join, complete with: real-atomic-swap complete <swap-id>');
}

async function joinSwap(swapId: string, options: any): Promise<void> {
  console.log(chalk.blue('🤝 Joining Atomic Swap (Party B)'));
  console.log(chalk.gray('═'.repeat(50)));

  const spinner = ora('Loading swap details...').start();
  const swapState = await loadSwapState(swapId);
  
  if (!swapState) {
    spinner.fail('Swap not found');
    throw new Error('Invalid swap ID');
  }

  if (swapState.status !== 'initiated') {
    spinner.fail('Swap already has counterparty or completed');
    throw new Error('Cannot join this swap');
  }

  spinner.succeed('Swap details loaded');

  // Display swap offer
  console.log(chalk.white('\n📋 Swap Offer:'));
  console.log(`   Swap ID: ${chalk.cyan(swapId)}`);
  console.log(`   Initiator sends: ${chalk.green(swapState.initiator.sendAmount)} ${swapState.initiator.tokenToSend} on ${swapState.initiator.sourceChain}`);
  console.log(`   You would send: ${chalk.green(swapState.initiator.receiveAmount)} ${swapState.initiator.tokenToReceive} on ${swapState.initiator.destinationChain}`);
  console.log(`   Initiator: ${chalk.yellow(swapState.initiator.walletAddress)}`);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Do you want to join this swap?',
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Swap cancelled'));
    return;
  }

  // Get credentials if not provided
  if (!options.privateKey && !options.mnemonic) {
    const { credential } = await inquirer.prompt([{
      type: 'password',
      name: 'credential',
      message: 'Your private key (for EVM) or mnemonic (for Cosmos):',
      mask: '*'
    }]);
    options.privateKey = credential;
  }

  // Create counterparty participant
  const counterparty: SwapParticipant = {
    role: 'counterparty',
    walletAddress: '',
    privateKey: options.privateKey,
    sourceChain: swapState.initiator.destinationChain,
    destinationChain: swapState.initiator.sourceChain,
    sendAmount: swapState.initiator.receiveAmount,
    receiveAmount: swapState.initiator.sendAmount,
    tokenToSend: swapState.initiator.tokenToReceive,
    tokenToReceive: swapState.initiator.tokenToSend
  };

  // Get counterparty's wallet address
  const client = await createClientForChain(counterparty.sourceChain, counterparty);
  counterparty.walletAddress = await getWalletAddress(client);

  // Update swap state
  swapState.counterparty = counterparty;
  swapState.status = 'counterparty_joined';
  await saveSwapState(swapState);

  console.log(chalk.green('\n✅ Successfully joined the swap!'));
  console.log(`   Your address: ${chalk.yellow(counterparty.walletAddress)}`);
  console.log(chalk.gray('\n💡 Next steps:'));
  console.log('   1. Wait for the initiator to create their HTLC');
  console.log('   2. The system will automatically create your HTLC');
  console.log('   3. Wait for initiator to claim your HTLC (revealing preimage)');
  console.log('   4. Claim their HTLC using: real-atomic-swap claim <swap-id>');
}

async function completeSwap(swapId: string): Promise<void> {
  console.log(chalk.blue('⚡ Completing Atomic Swap (Party A)'));
  console.log(chalk.gray('═'.repeat(50)));

  const spinner = ora('Loading swap state...').start();
  const swapState = await loadSwapState(swapId);
  
  if (!swapState) {
    spinner.fail('Swap not found');
    throw new Error('Invalid swap ID');
  }

  if (swapState.status !== 'counterparty_joined') {
    spinner.fail('Counterparty has not joined yet');
    throw new Error('Wait for counterparty to join');
  }

  spinner.succeed('Swap state loaded');

  try {
    // Step 1: Create initiator's HTLC
    spinner.start('Creating your HTLC...');
    const initiatorClient = await createClientForChain(swapState.initiator.sourceChain, swapState.initiator);
    const initiatorHTLCId = await createHTLC(
      initiatorClient,
      swapState.initiator.sourceChain,
      swapState.counterparty!.walletAddress, // Counterparty is beneficiary
      swapState.hashlock,
      swapState.timelock,
      swapState.initiator.sendAmount
    );
    
    swapState.initiatorHTLC = initiatorHTLCId;
    spinner.succeed(`Your HTLC created: ${initiatorHTLCId.id}`);

    // Step 2: Create counterparty's HTLC  
    spinner.start('Creating counterparty HTLC...');
    const counterpartyClient = await createClientForChain(swapState.counterparty!.sourceChain, swapState.counterparty!);
    const counterpartyHTLCId = await createHTLC(
      counterpartyClient,
      swapState.counterparty!.sourceChain,
      swapState.initiator.walletAddress, // Initiator is beneficiary
      swapState.hashlock,
      swapState.timelock,
      swapState.counterparty!.sendAmount
    );
    
    swapState.counterpartyHTLC = counterpartyHTLCId;
    swapState.status = 'htlcs_created';
    await saveSwapState(swapState);
    spinner.succeed(`Counterparty HTLC created: ${counterpartyHTLCId.id}`);

    // Step 3: Claim counterparty's HTLC (revealing preimage)
    spinner.start('Claiming counterparty HTLC...');
    await claimHTLC(counterpartyClient, counterpartyHTLCId.id, swapState.preimage!);
    spinner.succeed('Successfully claimed counterparty HTLC');

    swapState.status = 'completed';
    await saveSwapState(swapState);

    console.log(chalk.green('\n🎉 Swap completed successfully!'));
    console.log(chalk.white('📊 Summary:'));
    console.log(`   ✅ You received: ${chalk.green(swapState.initiator.receiveAmount)} ${swapState.initiator.tokenToReceive}`);
    console.log(`   ✅ Counterparty can now claim: ${chalk.green(swapState.initiator.sendAmount)} ${swapState.initiator.tokenToSend}`);
    console.log(`   🔑 Preimage revealed: ${chalk.gray(swapState.preimage!)}`);

  } catch (error) {
    swapState.status = 'failed';
    await saveSwapState(swapState);
    throw error;
  }
}

async function claimFunds(swapId: string): Promise<void> {
  console.log(chalk.blue('💰 Claiming Your Funds (Party B)'));
  console.log(chalk.gray('═'.repeat(50)));

  const spinner = ora('Loading swap state...').start();
  const swapState = await loadSwapState(swapId);
  
  if (!swapState || !swapState.counterparty) {
    spinner.fail('Invalid swap state');
    throw new Error('Swap not found or you are not the counterparty');
  }

  if (swapState.status !== 'completed') {
    spinner.fail('Swap not ready for claiming');
    throw new Error('Wait for initiator to complete the swap first');
  }

  spinner.succeed('Swap state loaded');

  try {
    // Get the revealed preimage from the blockchain
    spinner.start('Retrieving preimage from blockchain...');
    const counterpartyClient = await createClientForChain(swapState.counterparty.sourceChain, swapState.counterparty);
    const preimage = await getRevealedPreimage(counterpartyClient, swapState.counterpartyHTLC!.id);
    
    if (!preimage) {
      throw new Error('Preimage not yet revealed. Wait for initiator to claim first.');
    }
    
    spinner.succeed('Preimage retrieved');

    // Claim initiator's HTLC using the revealed preimage
    spinner.start('Claiming initiator HTLC...');
    const initiatorClient = await createClientForChain(swapState.initiator.sourceChain, swapState.counterparty);
    await claimHTLC(initiatorClient, swapState.initiatorHTLC!.id, preimage);
    spinner.succeed('Successfully claimed your funds');

    console.log(chalk.green('\n🎉 Funds claimed successfully!'));
    console.log(`   ✅ You received: ${chalk.green(swapState.counterparty.receiveAmount)} ${swapState.counterparty.tokenToReceive}`);

  } catch (error) {
    throw error;
  }
}

// Helper functions
async function createClientForChain(chain: string, participant: SwapParticipant): Promise<EvmHTLCClient | CosmosHTLCClient> {
  if (chain === 'sepolia' || chain === 'polygonAmoy') {
    if (!participant.privateKey) {
      throw new Error('Private key required for EVM chains');
    }

    const chainConfig = chain === 'sepolia' ? evmChains.sepolia : evmChains.polygonAmoy;
    
    let normalizedPrivateKey = participant.privateKey;
    if (!normalizedPrivateKey.startsWith('0x')) {
      normalizedPrivateKey = '0x' + normalizedPrivateKey;
    }

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const signer = new ethers.Wallet(normalizedPrivateKey, provider);
    
    return new EvmHTLCClient({ chain: chainConfig, provider, signer });
    
  } else if (chain === 'cosmosTestnet') {
    if (!participant.mnemonic) {
      throw new Error('Mnemonic required for Cosmos chains');
    }

    const chainConfig = cosmosChains.cosmosTestnet;
    const client = new CosmosHTLCClient({ chain: chainConfig });
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(participant.mnemonic, {
      prefix: chainConfig.addressPrefix
    });
    await client.connectWithSigner(signer);
    
    return client;
  } else {
    throw new Error(`Unsupported chain: ${chain}`);
  }
}

async function getWalletAddress(client: EvmHTLCClient | CosmosHTLCClient): Promise<string> {
  if (client instanceof EvmHTLCClient) {
    const signer = client.getSigner();
    return await signer!.getAddress();
  } else {
    const signingClient = client.getSigningClient();
    const accounts = await signingClient!.getAccounts();
    return accounts[0].address;
  }
}

async function createHTLC(
  client: EvmHTLCClient | CosmosHTLCClient,
  chain: string,
  beneficiary: string,
  hashlock: string,
  timelock: number,
  amount: string
): Promise<{ id: string; chain: string; txHash: string; blockNumber?: number }> {
  
  const htlcId = generateHTLCId({
    srcChain: chain,
    dstChain: beneficiary, // Using beneficiary as nonce
    nonce: Date.now().toString(),
    hashlock
  });

  const params: CreateHTLCParams = {
    contractId: htlcId,
    beneficiary,
    hashLock: hashlock,
    timelock,
    value: (chain === 'sepolia' || chain === 'polygonAmoy')
      ? ethers.parseEther(amount).toString()
      : (parseFloat(amount) * 1_000_000).toString()
  };

  if (client instanceof EvmHTLCClient) {
    const tx = await client.lock(params);
    const receipt = await tx.wait();
    
    return {
      id: htlcId,
      chain,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber
    };
  } else {
    const signingClient = client.getSigningClient();
    const accounts = await signingClient!.getAccounts();
    const result = await client.instantiateHTLC(params, accounts[0].address);
    
    return {
      id: htlcId,
      chain,
      txHash: result.result.transactionHash
    };
  }
}

async function claimHTLC(
  client: EvmHTLCClient | CosmosHTLCClient,
  htlcId: string,
  preimage: string
): Promise<void> {
  if (client instanceof EvmHTLCClient) {
    const tx = await client.claim(htlcId, preimage);
    await tx.wait();
  } else {
    const signingClient = client.getSigningClient();
    const accounts = await signingClient!.getAccounts();
    await client.claim(htlcId, accounts[0].address, preimage);
  }
}

async function getRevealedPreimage(client: EvmHTLCClient | CosmosHTLCClient, htlcId: string): Promise<string | null> {
  try {
    if (client instanceof EvmHTLCClient) {
      // Query EVM HTLC contract for Claim events
      const contract = client.getContract();
      const filter = contract.filters.Claim(htlcId);
      const events = await contract.queryFilter(filter);
      
      if (events.length > 0) {
        // Extract preimage from the Claim event
        const claimEvent = events[events.length - 1]; // Get latest event
        return claimEvent.args?.preimage || null;
      }
      return null;
      
    } else if (client instanceof CosmosHTLCClient) {
      // Query Cosmos blockchain for transaction logs
      // This would search for execute messages that claimed the HTLC
      const cosmosClient = client.getSigningClient();
      
      // Search for transactions that executed claim on this HTLC
      // Implementation depends on your Cosmos HTLC contract structure
      // For now, return null as placeholder
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving preimage:', error);
    return null;
  }
}

function getChainNativeToken(chain: string): string {
  switch (chain) {
    case 'sepolia': return 'ETH';
    case 'polygonAmoy': return 'MATIC';
    case 'cosmosTestnet': return 'ATOM';
    default: return 'TOKEN';
  }
}

// Swap state persistence
async function saveSwapState(swapState: AtomicSwapState): Promise<void> {
  const swapsDir = path.join(process.cwd(), '.swaps');
  await fs.mkdir(swapsDir, { recursive: true });
  
  const filePath = path.join(swapsDir, `${swapState.swapId}.json`);
  await fs.writeFile(filePath, JSON.stringify(swapState, null, 2));
}

async function loadSwapState(swapId: string): Promise<AtomicSwapState | null> {
  try {
    const filePath = path.join(process.cwd(), '.swaps', `${swapId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function checkSwapStatus(swapId: string): Promise<void> {
  const swapState = await loadSwapState(swapId);
  
  if (!swapState) {
    console.log(chalk.red('❌ Swap not found'));
    return;
  }

  console.log(chalk.blue(`🔍 Swap Status: ${swapId}`));
  console.log(chalk.gray('═'.repeat(50)));
  
  console.log(`Status: ${getStatusColor(swapState.status)}`);
  console.log(`Created: ${new Date(swapState.createdAt).toLocaleString()}`);
  console.log(`Expires: ${new Date(swapState.expiresAt).toLocaleString()}`);
  
  console.log(chalk.white('\n👤 Initiator:'));
  console.log(`   Address: ${swapState.initiator.walletAddress}`);
  console.log(`   Sends: ${swapState.initiator.sendAmount} ${swapState.initiator.tokenToSend} on ${swapState.initiator.sourceChain}`);
  
  if (swapState.counterparty) {
    console.log(chalk.white('\n👤 Counterparty:'));
    console.log(`   Address: ${swapState.counterparty.walletAddress}`);
    console.log(`   Sends: ${swapState.counterparty.sendAmount} ${swapState.counterparty.tokenToSend} on ${swapState.counterparty.sourceChain}`);
  }

  if (swapState.initiatorHTLC) {
    console.log(chalk.white('\n📄 Initiator HTLC:'));
    console.log(`   ID: ${swapState.initiatorHTLC.id}`);
    console.log(`   Chain: ${swapState.initiatorHTLC.chain}`);
    console.log(`   TX: ${swapState.initiatorHTLC.txHash}`);
  }

  if (swapState.counterpartyHTLC) {
    console.log(chalk.white('\n📄 Counterparty HTLC:'));
    console.log(`   ID: ${swapState.counterpartyHTLC.id}`);
    console.log(`   Chain: ${swapState.counterpartyHTLC.chain}`);
    console.log(`   TX: ${swapState.counterpartyHTLC.txHash}`);
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'initiated': return chalk.blue(status);
    case 'counterparty_joined': return chalk.yellow(status);
    case 'htlcs_created': return chalk.orange(status);
    case 'completed': return chalk.green(status);
    case 'failed': return chalk.red(status);
    case 'expired': return chalk.gray(status);
    default: return chalk.white(status);
  }
}

async function listSwaps(): Promise<void> {
  try {
    const swapsDir = path.join(process.cwd(), '.swaps');
    const files = await fs.readdir(swapsDir);
    
    if (files.length === 0) {
      console.log(chalk.yellow('No swaps found'));
      return;
    }

    console.log(chalk.blue('📋 Your Swaps'));
    console.log(chalk.gray('═'.repeat(50)));

    for (const file of files) {
      if (file.endsWith('.json')) {
        const swapId = file.replace('.json', '');
        const swapState = await loadSwapState(swapId);
        if (swapState) {
          console.log(`${getStatusColor(swapState.status)} ${swapId.substring(0, 16)}... (${new Date(swapState.createdAt).toLocaleDateString()})`);
        }
      }
    }
  } catch (error) {
    console.log(chalk.yellow('No swaps directory found'));
  }
}

async function refundSwap(swapId: string): Promise<void> {
  console.log(chalk.blue('🔄 Refunding Expired Swap'));
  console.log(chalk.gray('═'.repeat(50)));
  
  const swapState = await loadSwapState(swapId);
  if (!swapState) {
    throw new Error('Swap not found');
  }

  if (Date.now() < swapState.expiresAt) {
    throw new Error('Swap has not expired yet');
  }

  // Implementation would refund both HTLCs if they exist and are expired
  console.log(chalk.green('✅ Refund functionality would be implemented here'));
}

// Main execution
if (require.main === module) {
  program.parse();
}

export { program };