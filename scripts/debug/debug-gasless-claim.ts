#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function debugGaslessClaim() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  
  try {
    console.log(`🔍 Debugging gasless claim for swap ${swapId}\n`);
    
    // Get swap from API
    const response = await fetch(`http://localhost:3000/api/swaps/${swapId}`);
    const swap = await response.json();
    
    console.log('📋 Swap details from API:');
    console.log('- Status:', swap.status);
    console.log('- User HTLC:', swap.userHtlcContract);
    console.log('- Pool HTLC:', swap.poolHtlcContract);
    console.log('- Preimage:', swap.preimage);
    console.log('- Target chain:', swap.destinationChain || swap.target_token?.split(':')[0]);
    
    // The contract ID from the test
    const testContractId = '0xdd1e89d0084c3c5e87030b528e09cc547cf4384a3d2b92e4cc3dcc6634abee13';
    console.log('\n🔍 Comparing contract IDs:');
    console.log('- Test contract ID:', testContractId);
    console.log('- Pool HTLC from DB:', swap.poolHtlcContract);
    console.log('- Match?', testContractId === swap.poolHtlcContract);
    
    // Check HTLC on chain with both IDs
    console.log('\n🔗 Checking HTLCs on Monad chain...');
    const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
    const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
    
    const htlcABI = [
      'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
    ];
    
    const htlc = new ethers.Contract(htlcAddress, htlcABI, provider);
    
    // Check test contract ID
    console.log('\n1️⃣ Checking test contract ID:', testContractId);
    try {
      const details = await htlc.getDetails(testContractId);
      console.log('   State:', details.state.toString());
      console.log('   Beneficiary:', details.beneficiary);
      console.log('   Amount:', ethers.formatUnits(details.value, 18), 'tokens');
    } catch (error: any) {
      console.log('   Error:', error.message);
    }
    
    // Check DB contract ID
    if (swap.poolHtlcContract && swap.poolHtlcContract !== testContractId) {
      console.log('\n2️⃣ Checking DB contract ID:', swap.poolHtlcContract);
      try {
        const details = await htlc.getDetails(swap.poolHtlcContract);
        console.log('   State:', details.state.toString());
        console.log('   Beneficiary:', details.beneficiary);
        console.log('   Amount:', ethers.formatUnits(details.value, 18), 'tokens');
      } catch (error: any) {
        console.log('   Error:', error.message);
      }
    }
    
    // Test gasless claim with correct contract ID
    console.log('\n🚀 Testing gasless claim with DB contract ID...');
    const claimResponse = await fetch('http://localhost:3000/api/fusion/claims/gasless', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swapId,
        htlcContract: htlcAddress,
        contractId: swap.poolHtlcContract || testContractId,
        preimage: swap.preimage || '0xe64325fb6cabd75f2b7d9ee22a82329e80e6ba9bf82a390cfdf21dd1369327c9',
        beneficiary: '0x2BCc053BB6915F28aC2041855D2292dDca406903',
        signature: 'mock-signature-for-testing'
      })
    });
    
    const result = await claimResponse.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

debugGaslessClaim();