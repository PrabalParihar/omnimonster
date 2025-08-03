#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function executeDirectClaim() {
  const swapId = '10105da8-098c-44ac-aca6-54c576f5081e';
  const contractId = '0x76a70eb4cad65a0236a6abf42895a7c72697bebabe3b9232a5ff69ed822b737a';
  const preimage = '0xa208fc0db8d79cc45c2bd7c5f423cf71bd11c5b882b77c985339efb1feec4bf0';
  const beneficiary = '0x2BCc053BB6915F28aC2041855D2292dDca406903';
  
  console.log('🚀 Executing Direct Claim\n');
  console.log('Swap ID:', swapId);
  console.log('Contract ID:', contractId);
  console.log('Beneficiary:', beneficiary);
  
  // First verify the HTLC
  console.log('\n1️⃣ Verifying HTLC on Monad...');
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  const htlcABI = [
    'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
    'function claim(bytes32 contractId, bytes32 preimage) external'
  ];
  
  const htlc = new ethers.Contract(htlcAddress, htlcABI, provider);
  
  try {
    const details = await htlc.getDetails(contractId);
    console.log('✅ HTLC found');
    console.log('- State:', details.state.toString());
    console.log('- Beneficiary:', details.beneficiary);
    console.log('- Amount:', ethers.formatUnits(details.value, 18), 'OMNIMONSTER');
    console.log('- Token:', details.token);
    
    if (details.state.toString() !== '1') {
      console.log('\n❌ HTLC is not claimable');
      return;
    }
    
    // Verify preimage matches hash lock
    const hashOfPreimage = ethers.solidityPackedSha256(['bytes32'], [preimage]);
    console.log('\n2️⃣ Verifying preimage...');
    console.log('- Preimage:', preimage);
    console.log('- Hash of preimage:', hashOfPreimage);
    console.log('- Expected hash lock:', details.hashLock);
    console.log('- Match?', hashOfPreimage === details.hashLock);
    
    if (hashOfPreimage !== details.hashLock) {
      console.log('\n❌ Preimage does not match hash lock');
      return;
    }
    
    // Since this is the user's wallet as beneficiary, they need to claim with their own private key
    console.log('\n3️⃣ Claim Instructions:');
    console.log('=====================================');
    console.log('Since you are the beneficiary, you need to claim with your wallet.');
    console.log('\nOption 1: Use MetaMask or Web3 Wallet');
    console.log('- Connect to Monad Testnet');
    console.log('- Call claim() function on contract:', htlcAddress);
    console.log('- Parameters:');
    console.log('  - contractId:', contractId);
    console.log('  - preimage:', preimage);
    
    console.log('\nOption 2: Use the Direct Claim API');
    console.log('POST http://localhost:3000/api/fusion/claims/direct');
    console.log(JSON.stringify({
      swapId: swapId,
      contractId: contractId,
      preimage: preimage,
      privateKey: "[YOUR_PRIVATE_KEY_HERE]"
    }, null, 2));
    
    console.log('\nOption 3: Use this script with your private key');
    console.log('Set your private key in .env.local as USER_PRIVATE_KEY');
    
    // If user has provided their private key, execute the claim
    const userPrivateKey = process.env.USER_PRIVATE_KEY;
    if (userPrivateKey && userPrivateKey !== '[YOUR_PRIVATE_KEY_HERE]') {
      console.log('\n4️⃣ Executing claim with provided private key...');
      
      const userWallet = new ethers.Wallet(userPrivateKey, provider);
      console.log('Using wallet:', userWallet.address);
      
      if (userWallet.address.toLowerCase() !== beneficiary.toLowerCase()) {
        console.log('❌ Wallet address does not match beneficiary');
        return;
      }
      
      const htlcWithSigner = htlc.connect(userWallet);
      
      // Get token balance before
      const tokenABI = ['function balanceOf(address) view returns (uint256)'];
      const token = new ethers.Contract(details.token, tokenABI, provider);
      const balanceBefore = await token.balanceOf(beneficiary);
      console.log('Token balance before:', ethers.formatUnits(balanceBefore, 18));
      
      // Execute claim
      console.log('\n🚀 Sending claim transaction...');
      const tx = await htlcWithSigner.claim(contractId, preimage, {
        gasLimit: 200000
      });
      
      console.log('📡 Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed!');
      console.log('Block:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());
      
      // Check balance after
      const balanceAfter = await token.balanceOf(beneficiary);
      console.log('\nToken balance after:', ethers.formatUnits(balanceAfter, 18));
      console.log('Received:', ethers.formatUnits(balanceAfter - balanceBefore, 18), 'OMNIMONSTER');
      
      // Update swap status
      console.log('\n5️⃣ Updating swap status...');
      const updateResponse = await fetch(`http://localhost:3000/api/swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'USER_CLAIMED',
          userClaimedAt: new Date().toISOString()
        })
      });
      
      if (updateResponse.ok) {
        console.log('✅ Swap status updated to USER_CLAIMED');
      }
      
      console.log('\n🎉 Claim successful!');
    } else {
      console.log('\n⚠️  To execute the claim automatically, add your private key to .env.local:');
      console.log('USER_PRIVATE_KEY=0x...');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

executeDirectClaim();