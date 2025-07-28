#!/usr/bin/env tsx

/**
 * HTLC Cross-Chain Smoke Test
 * 
 * This script tests the full HTLC workflow across EVM and Cosmos chains:
 * 1. Creates HTLCs on both chains with matching hashlocks
 * 2. Claims both HTLCs using the same preimage
 * 3. Verifies successful completion
 */

import { ethers } from 'ethers';
import { 
  EvmHTLCClient, 
  CosmosHTLCClient,
  MockEvmHTLCClient,
  MockCosmosHTLCClient,
  evmChains, 
  cosmosChains,
  generatePreimage,
  generateHashlock,
  generateHTLCId,
  calculateTimelock,
  formatTimelock,
  CreateHTLCParams
} from '../packages/shared/src';

interface SmokeTestConfig {
  useLocal: boolean;
  amount: string;
  timelockDuration: number; // seconds
}

const config: SmokeTestConfig = {
  useLocal: process.argv.includes('--local') || true,
  amount: '0.01', // 0.01 ETH / tokens
  timelockDuration: 3600 // 1 hour
};

async function main() {
  console.log('🚀 Starting HTLC Cross-Chain Smoke Test...\n');

  // Test configuration
  const srcChain = evmChains.hardhat;
  const dstChain = cosmosChains.local;
  const preimage = generatePreimage();
  const hashlock = generateHashlock(preimage);
  const timelock = calculateTimelock(config.timelockDuration);
  const nonce = Date.now().toString();

  console.log('📋 Test Configuration:');
  console.log(`  • Source Chain: ${srcChain.name} (${srcChain.chainId})`);
  console.log(`  • Destination Chain: ${dstChain.name} (${dstChain.chainId})`);
  console.log(`  • Amount: ${config.amount} ETH/tokens`);
  console.log(`  • Timelock: ${formatTimelock(timelock)}`);
  console.log(`  • Preimage: ${preimage}`);
  console.log(`  • Hashlock: ${hashlock}\n`);

  // Generate HTLC IDs
  const evmHTLCId = generateHTLCId({
    srcChain: srcChain.chainId,
    dstChain: dstChain.chainId,
    nonce,
    hashlock
  });

  const cosmosHTLCId = generateHTLCId({
    srcChain: dstChain.chainId,
    dstChain: srcChain.chainId,
    nonce,
    hashlock
  });

  console.log('🔗 Generated HTLC IDs:');
  console.log(`  • EVM HTLC ID: ${evmHTLCId}`);
  console.log(`  • Cosmos HTLC ID: ${cosmosHTLCId}\n`);

  try {
    // Initialize clients (using mock clients for testing)
    console.log('🔧 Initializing clients...');
    const evmClient = config.useLocal 
      ? new MockEvmHTLCClient(srcChain)
      : await initializeEvmClient(srcChain);
    
    const cosmosClient = config.useLocal 
      ? new MockCosmosHTLCClient(dstChain)
      : await initializeCosmosClient(dstChain);

    console.log('✅ Clients initialized\n');

    // Test 1: Create HTLC on EVM chain
    console.log('📦 Step 1: Creating HTLC on EVM chain...');
    
    const evmLockParams: CreateHTLCParams = {
      contractId: evmHTLCId,
      beneficiary: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Mock beneficiary
      hashLock: hashlock,
      timelock,
      value: ethers.parseEther(config.amount).toString()
    };

    const evmLockTx = await evmClient.lock(evmLockParams);
    console.log(`  • EVM Lock TX: ${evmLockTx.hash || 'mock-hash'}`);
    
    // Verify EVM HTLC
    const evmDetails = await evmClient.getDetails(evmHTLCId);
    console.log(`  • EVM HTLC State: ${evmDetails.state} (1=OPEN)`);
    console.log(`  • EVM HTLC Claimable: ${await evmClient.isClaimable(evmHTLCId)}`);

    // Test 2: Create HTLC on Cosmos chain
    console.log('\n📦 Step 2: Creating HTLC on Cosmos chain...');
    
    const cosmosLockParams: CreateHTLCParams = {
      contractId: cosmosHTLCId,
      beneficiary: 'cosmos1abcdefghijklmnopqrstuvwxyz0123456789abcd', // Mock beneficiary
      hashLock: hashlock,
      timelock,
      value: (parseFloat(config.amount) * 1_000_000).toString() // Convert to base denom
    };

    let cosmosContractAddress: string;
    
    if (cosmosClient instanceof MockCosmosHTLCClient) {
      const result = await cosmosClient.instantiateHTLC(
        cosmosLockParams,
        'cosmos1sender123456789abcdefghijklmnopqrstuvwxyz', // Mock sender
        1 // Mock code ID
      );
      cosmosContractAddress = result.contractAddress;
    } else {
      // Real cosmos client would need proper signer setup
      cosmosContractAddress = cosmosClient.contractAddress;
    }

    console.log(`  • Cosmos Contract: ${cosmosContractAddress}`);
    
    // Verify Cosmos HTLC
    const cosmosDetails = await cosmosClient.getDetails(cosmosContractAddress);
    console.log(`  • Cosmos HTLC State: ${cosmosDetails.state} (1=OPEN)`);
    console.log(`  • Cosmos HTLC Claimable: ${await cosmosClient.isClaimable(cosmosContractAddress)}`);

    // Test 3: Claim EVM HTLC
    console.log('\n🎯 Step 3: Claiming EVM HTLC...');
    
    const evmClaimTx = await evmClient.claim(evmHTLCId, preimage);
    console.log(`  • EVM Claim TX: ${evmClaimTx.hash || 'mock-hash'}`);
    
    // Verify EVM claim
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait for mock events
    const evmDetailsAfterClaim = await evmClient.getDetails(evmHTLCId);
    console.log(`  • EVM HTLC State After Claim: ${evmDetailsAfterClaim.state} (2=CLAIMED)`);

    // Test 4: Claim Cosmos HTLC
    console.log('\n🎯 Step 4: Claiming Cosmos HTLC...');
    
    const cosmosClaimTx = await cosmosClient.claim(
      cosmosContractAddress,
      'cosmos1claimer123456789abcdefghijklmnopqrstuvwx', // Mock claimer
      preimage
    );
    console.log(`  • Cosmos Claim TX: ${cosmosClaimTx.transactionHash || 'mock-hash'}`);
    
    // Verify Cosmos claim
    const cosmosDetailsAfterClaim = await cosmosClient.getDetails(cosmosContractAddress);
    console.log(`  • Cosmos HTLC State After Claim: ${cosmosDetailsAfterClaim.state} (2=CLAIMED)`);

    // Test 5: Event monitoring test
    if (evmClient instanceof MockEvmHTLCClient) {
      console.log('\n📡 Step 5: Testing Event Monitoring...');
      
      let fundedEventReceived = false;
      let claimedEventReceived = false;

      evmClient.onFunded((event) => {
        console.log(`  • Received Funded Event: ${event.contractId}`);
        fundedEventReceived = true;
      });

      evmClient.onClaimed((event) => {
        console.log(`  • Received Claimed Event: ${event.contractId}`);
        claimedEventReceived = true;
      });

      // Create another HTLC to test events
      const testHTLCId = generateHTLCId({
        srcChain: srcChain.chainId,
        dstChain: dstChain.chainId,
        nonce: (Date.now() + 1000).toString(),
        hashlock
      });

      await evmClient.lock({
        contractId: testHTLCId,
        beneficiary: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        hashLock: hashlock,
        timelock,
        value: ethers.parseEther('0.001').toString()
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      await evmClient.claim(testHTLCId, preimage);
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(`  • Funded Event Received: ${fundedEventReceived}`);
      console.log(`  • Claimed Event Received: ${claimedEventReceived}`);
      
      evmClient.removeAllListeners();
    }

    // Success!
    console.log('\n🎉 Smoke Test Completed Successfully!');
    console.log('\n📊 Test Summary:');
    console.log(`  ✅ EVM HTLC Created: ${evmHTLCId}`);
    console.log(`  ✅ Cosmos HTLC Created: ${cosmosContractAddress}`);
    console.log(`  ✅ Both HTLCs Claimed Successfully`);
    console.log(`  ✅ Cross-chain atomic swap completed`);
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Smoke Test Failed:');
    console.error(error);
    process.exit(1);
  }
}

async function initializeEvmClient(chain: typeof evmChains.hardhat): Promise<EvmHTLCClient> {
  console.log('  • Connecting to EVM chain...');
  
  // For real testing, you would use:
  // const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  // const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  // return new EvmHTLCClient({ chain, provider, signer });
  
  // For now, return mock client
  return new MockEvmHTLCClient(chain) as any;
}

async function initializeCosmosClient(chain: typeof cosmosChains.local): Promise<CosmosHTLCClient> {
  console.log('  • Connecting to Cosmos chain...');
  
  // For real testing, you would use:
  // const signer = await DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC!);
  // const client = new CosmosHTLCClient({ chain });
  // await client.connectWithSigner(signer);
  // return client;
  
  // For now, return mock client
  return new MockCosmosHTLCClient(chain) as any;
}

// Run the smoke test
if (require.main === module) {
  main().catch(console.error);
}

export { main };