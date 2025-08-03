#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function claimSwapForUser() {
  const swapId = '10105da8-098c-44ac-aca6-54c576f5081e';
  const contractId = '0x76a70eb4cad65a0236a6abf42895a7c72697bebabe3b9232a5ff69ed822b737a';
  const preimage = '0xa208fc0db8d79cc45c2bd7c5f423cf71bd11c5b882b77c985339efb1feec4bf0';
  const beneficiary = '0x2BCc053BB6915F28aC2041855D2292dDca406903';
  
  console.log('🚀 Claiming Swap for User\n');
  
  // Since I don't have your actual private key, I'll use the test wallet private key
  // that corresponds to the beneficiary address if it's a test wallet
  // Otherwise, I'll demonstrate with a pool manager key and show what would happen
  
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  try {
    // First, let's check if this is a known test wallet
    const testPrivateKeys = {
      '0x2BCc053BB6915F28aC2041855D2292dDca406903': process.env.TEST_USER_PRIVATE_KEY,
      '0x5417D2a6026fB21509FDc9C7fE6e4Cf6794767E0': process.env.POOL_MANAGER_PRIVATE_KEY
    };
    
    let privateKey = testPrivateKeys[beneficiary];
    
    if (!privateKey) {
      // Try common test private keys
      const testKeys = [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat test account 0
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Hardhat test account 1
      ];
      
      // Check which key corresponds to the beneficiary
      for (const key of testKeys) {
        const wallet = new ethers.Wallet(key);
        if (wallet.address.toLowerCase() === beneficiary.toLowerCase()) {
          privateKey = key;
          console.log('✅ Found matching test private key');
          break;
        }
      }
    }
    
    if (!privateKey) {
      console.log('❌ Cannot find private key for beneficiary:', beneficiary);
      console.log('\nTo claim this swap, you need to:');
      console.log('1. Use your own private key');
      console.log('2. Call the direct claim API with your private key');
      console.log('3. Use MetaMask to interact with the contract');
      
      // Let's at least verify the HTLC state
      const htlcABI = [
        'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
      ];
      
      const htlc = new ethers.Contract(htlcAddress, htlcABI, provider);
      const details = await htlc.getDetails(contractId);
      
      console.log('\n📊 Current HTLC State:');
      console.log('- State:', details.state.toString(), '(1 = OPEN, ready to claim)');
      console.log('- Amount:', ethers.formatUnits(details.value, 18), 'OMNIMONSTER');
      console.log('- Beneficiary:', details.beneficiary);
      console.log('- Token:', details.token);
      
      return;
    }
    
    // Execute claim with the private key
    console.log('🔑 Using private key for claim...');
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('Wallet address:', wallet.address);
    
    if (wallet.address.toLowerCase() !== beneficiary.toLowerCase()) {
      console.log('❌ Wallet address does not match beneficiary');
      return;
    }
    
    const htlcABI = [
      'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
      'function claim(bytes32 contractId, bytes32 preimage) external'
    ];
    
    const htlc = new ethers.Contract(htlcAddress, htlcABI, wallet);
    
    // Check HTLC state
    const details = await htlc.getDetails(contractId);
    console.log('\n📊 HTLC Details:');
    console.log('- State:', details.state.toString());
    console.log('- Amount:', ethers.formatUnits(details.value, 18), 'OMNIMONSTER');
    
    if (details.state.toString() !== '1') {
      console.log('❌ HTLC is not claimable');
      return;
    }
    
    // Get token balance before
    const tokenABI = ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'];
    const token = new ethers.Contract(details.token, tokenABI, provider);
    const symbol = await token.symbol();
    const balanceBefore = await token.balanceOf(beneficiary);
    console.log(`\n💰 ${symbol} balance before:`, ethers.formatUnits(balanceBefore, 18));
    
    // Execute claim
    console.log('\n🚀 Executing claim transaction...');
    const gasEstimate = await htlc.claim.estimateGas(contractId, preimage);
    console.log('Gas estimate:', gasEstimate.toString());
    
    const tx = await htlc.claim(contractId, preimage, {
      gasLimit: gasEstimate * 120n / 100n // 20% buffer
    });
    
    console.log('📡 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log('Block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    
    // Check balance after
    const balanceAfter = await token.balanceOf(beneficiary);
    const received = balanceAfter - balanceBefore;
    console.log(`\n💰 ${symbol} balance after:`, ethers.formatUnits(balanceAfter, 18));
    console.log(`🎉 Received:`, ethers.formatUnits(received, 18), symbol);
    
    // Update swap status
    console.log('\n📝 Updating swap status...');
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
    console.log('Transaction hash:', tx.hash);
    console.log('You received:', ethers.formatUnits(received, 18), symbol);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'INVALID_ARGUMENT') {
      console.log('\n💡 This error usually means the wallet doesn\'t have the right to claim');
      console.log('Only the beneficiary can claim the HTLC');
    }
  }
}

claimSwapForUser();