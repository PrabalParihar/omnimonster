#!/usr/bin/env tsx

import { ethers } from 'ethers';

async function verifyPoolHTLC() {
  const contractId = '0x76a70eb4cad65a0236a6abf42895a7c72697bebabe3b9232a5ff69ed822b737a';
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  console.log('🔍 Verifying Pool HTLC...\n');
  console.log('Contract ID:', contractId);
  console.log('HTLC Address:', htlcAddress);
  
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  
  // First, let's search for the HTLC creation event
  const eventTopic = ethers.id('HTLCCreated(bytes32,address,address,address,uint256,bytes32,uint256)');
  
  try {
    console.log('\n📊 Checking HTLC state directly...');
    const htlcABI = [
      'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
    ];
    
    const htlc = new ethers.Contract(htlcAddress, htlcABI, provider);
    const details = await htlc.getDetails(contractId);
    
    console.log('State:', details.state.toString());
    
    if (details.state.toString() === '0') {
      console.log('\n❌ HTLC shows INVALID state');
      console.log('This means either:');
      console.log('1. The contract ID is wrong');
      console.log('2. The HTLC was never created');
      console.log('3. The HTLC has been refunded or claimed');
      
      // Let's search for recent HTLC creations
      console.log('\n🔍 Searching for recent HTLC creations...');
      const currentBlock = await provider.getBlockNumber();
      const searchRange = 100;
      
      for (let i = 0; i < 10; i++) {
        const toBlock = currentBlock - (i * searchRange);
        const fromBlock = toBlock - searchRange + 1;
        
        if (toBlock < 0) break;
        
        try {
          const filter = {
            address: htlcAddress,
            topics: [eventTopic],
            fromBlock: Math.max(0, fromBlock),
            toBlock: toBlock
          };
          
          const logs = await provider.getLogs(filter);
          
          if (logs.length > 0) {
            console.log(`\nFound ${logs.length} HTLC creation(s) in blocks ${fromBlock}-${toBlock}`);
            
            const iface = new ethers.Interface([
              'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
            ]);
            
            for (const log of logs.slice(0, 3)) { // Show first 3
              const decoded = iface.parseLog(log);
              console.log('\nHTLC Created:');
              console.log('- Contract ID:', decoded.args.contractId);
              console.log('- Beneficiary:', decoded.args.beneficiary);
              console.log('- Amount:', ethers.formatUnits(decoded.args.value, 18), 'tokens');
              console.log('- Block:', log.blockNumber);
              console.log('- Tx:', log.transactionHash);
              
              if (decoded.args.contractId === contractId) {
                console.log('✅ FOUND OUR CONTRACT!');
              }
            }
          }
        } catch (error) {
          // Continue
        }
      }
    } else {
      console.log('\n✅ HTLC is valid');
      console.log('Beneficiary:', details.beneficiary);
      console.log('Amount:', ethers.formatUnits(details.value, 18), 'tokens');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

verifyPoolHTLC();