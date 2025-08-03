#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function findHTLCCreationTx() {
  const contractId = '0xdd1e89d0084c3c5e87030b528e09cc547cf4384a3d2b92e4cc3dcc6634abee13';
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  console.log('🔍 Looking for HTLC creation transaction...\n');
  
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  
  // Get the HTLC creation event topic
  const eventTopic = ethers.id('HTLCCreated(bytes32,address,address,address,uint256,bytes32,uint256)');
  
  console.log('Event topic:', eventTopic);
  console.log('Contract ID:', contractId);
  
  try {
    // Search for events with this contract ID
    // Note: We need to search in recent blocks since we don't know the exact block
    const currentBlock = await provider.getBlockNumber();
    const searchRange = 100; // RPC limit
    let allLogs: ethers.Log[] = [];
    
    // Search in chunks of 100 blocks
    console.log(`Current block: ${currentBlock}`);
    console.log('Searching for HTLC creation event...\n');
    
    for (let i = 0; i < 50; i++) { // Search up to 5000 blocks back
      const toBlock = currentBlock - (i * searchRange);
      const fromBlock = toBlock - searchRange + 1;
      
      if (toBlock < 0) break;
      
      process.stdout.write(`\rSearching blocks ${fromBlock} to ${toBlock}...`);
      
      const filter = {
        address: htlcAddress,
        topics: [
          eventTopic,
          contractId // contractId is indexed, so it's the second topic
        ],
        fromBlock: Math.max(0, fromBlock),
        toBlock: toBlock
      };
      
      try {
        const logs = await provider.getLogs(filter);
        if (logs.length > 0) {
          allLogs = logs;
          console.log(`\n✅ Found ${logs.length} matching events`);
          break;
        }
      } catch (error) {
        // Continue searching
      }
    }
    
    const logs = allLogs;
    if (logs.length === 0) {
      console.log(`\n❌ No matching events found`);
    }
    
    if (logs.length > 0) {
      const log = logs[0];
      console.log('\n📋 HTLC Creation Event:');
      console.log('- Block:', log.blockNumber);
      console.log('- Transaction:', log.transactionHash);
      
      // Decode the event
      const iface = new ethers.Interface([
        'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
      ]);
      
      const decoded = iface.parseLog(log);
      console.log('\n📊 Event Details:');
      console.log('- Contract ID:', decoded.args.contractId);
      console.log('- Originator:', decoded.args.originator);
      console.log('- Beneficiary:', decoded.args.beneficiary);
      console.log('- Token:', decoded.args.token);
      console.log('- Value:', ethers.formatUnits(decoded.args.value, 18), 'tokens');
      console.log('- Hash Lock:', decoded.args.hashLock);
      console.log('- Timelock:', new Date(Number(decoded.args.timelock) * 1000).toLocaleString());
      
      // Get the transaction to see if we can find the preimage
      console.log('\n🔍 Checking transaction for preimage...');
      const tx = await provider.getTransaction(log.transactionHash);
      if (tx) {
        console.log('From:', tx.from);
        console.log('Data length:', tx.data.length);
        
        // The preimage might be in the transaction data if it was logged
        // But typically it's not included in the fund() call
      }
      
      console.log('\n💡 Hash Lock Analysis:');
      console.log('Hash Lock from event:', decoded.args.hashLock);
      console.log('This is the SHA256 hash of the preimage we need to find.');
      
    } else {
      console.log('\n❌ No HTLC creation events found for this contract ID');
      console.log('The HTLC might have been created more than 10k blocks ago');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findHTLCCreationTx();