#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

// This script helps the user claim their HTLC directly
// Since gasless claim is not possible when the beneficiary is the user's wallet

async function generateClaimInstructions() {
  const contractId = '0xdd1e89d0084c3c5e87030b528e09cc547cf4384a3d2b92e4cc3dcc6634abee13';
  const beneficiary = '0x2BCc053BB6915F28aC2041855D2292dDca406903';
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  console.log('📋 HTLC Claim Instructions\n');
  console.log('Since the HTLC beneficiary is your wallet address, you need to claim directly.');
  console.log('Gasless claiming is not possible in this case.\n');
  
  console.log('🔍 HTLC Details:');
  console.log('- Contract ID:', contractId);
  console.log('- HTLC Address:', htlcAddress);
  console.log('- Beneficiary:', beneficiary);
  console.log('- Network: Monad Testnet');
  console.log('- Amount: 3.944 OMNIMONSTER');
  
  console.log('\n❌ Problem:');
  console.log('The preimage for this HTLC was not properly stored in the database.');
  console.log('Without the preimage, the HTLC cannot be claimed.');
  
  console.log('\n🔧 Solutions:');
  console.log('\n1. If you have the preimage:');
  console.log('   - Use MetaMask or any wallet to call the claim() function');
  console.log('   - Contract:', htlcAddress);
  console.log('   - Function: claim(bytes32 contractId, bytes32 preimage)');
  console.log('   - Parameters:');
  console.log('     - contractId:', contractId);
  console.log('     - preimage: [YOUR_PREIMAGE_HERE]');
  
  console.log('\n2. Find the preimage:');
  console.log('   - Check the transaction that created this HTLC');
  console.log('   - The preimage should have been generated when creating the swap');
  console.log('   - Look for it in the frontend logs or browser console');
  
  console.log('\n3. Use the direct claim API (if you have the preimage):');
  console.log('   ```');
  console.log('   POST http://localhost:3000/api/fusion/claims/direct');
  console.log('   {');
  console.log('     "swapId": "249068be-d9d0-49fd-b94d-3a1b0089f45c",');
  console.log('     "contractId": "' + contractId + '",');
  console.log('     "preimage": "[YOUR_PREIMAGE_HERE]",');
  console.log('     "privateKey": "[YOUR_WALLET_PRIVATE_KEY]"');
  console.log('   }');
  console.log('   ```');
  
  console.log('\n📝 Note:');
  console.log('The preimage is a 32-byte value (64 hex characters) that when hashed');
  console.log('produces the hash lock: 0x66c2a9b7bc84bc558d0650b2abc5037e5bdefa2ab4ff95442f7006c874792b58');
  
  // Check current HTLC state
  console.log('\n🔗 Checking current HTLC state...');
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  const htlcABI = [
    'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
  ];
  
  const htlc = new ethers.Contract(htlcAddress, htlcABI, provider);
  
  try {
    const details = await htlc.getDetails(contractId);
    console.log('\nCurrent state:', details.state.toString());
    console.log('Time lock:', new Date(Number(details.timelock) * 1000).toLocaleString());
    
    if (details.state.toString() === '1') {
      console.log('✅ HTLC is still claimable');
    } else if (details.state.toString() === '2') {
      console.log('❌ HTLC has already been claimed');
    } else if (details.state.toString() === '3') {
      console.log('❌ HTLC has been refunded');
    }
  } catch (error) {
    console.error('Error checking HTLC:', error);
  }
}

generateClaimInstructions();