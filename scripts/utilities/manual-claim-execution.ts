#!/usr/bin/env tsx

import { ethers } from 'ethers';

async function manualClaimExecution() {
  const contractId = '0x76a70eb4cad65a0236a6abf42895a7c72697bebabe3b9232a5ff69ed822b737a';
  const preimage = '0xa208fc0db8d79cc45c2bd7c5f423cf71bd11c5b882b77c985339efb1feec4bf0';
  const privateKey = '0xe736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  console.log('🚀 Manual Claim Execution\n');
  
  try {
    // Connect to Monad testnet
    const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('Using wallet:', wallet.address);
    
    // HTLC contract interface
    const htlcABI = [
      'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
      'function claim(bytes32 contractId, bytes32 preimage) external',
      'event Claimed(bytes32 indexed contractId, address indexed beneficiary)'
    ];
    
    const htlc = new ethers.Contract(htlcAddress, htlcABI, wallet);
    
    // Check HTLC details
    console.log('\n1️⃣ Checking HTLC details...');
    const details = await htlc.getDetails(contractId);
    
    console.log('State:', details.state.toString());
    console.log('Beneficiary:', details.beneficiary);
    console.log('Amount:', ethers.formatUnits(details.value, 18), 'tokens');
    console.log('Token:', details.token);
    console.log('Hash lock:', details.hashLock);
    
    if (details.state.toString() === '0') {
      console.log('\n❌ HTLC shows as INVALID (state 0)');
      console.log('This could mean:');
      console.log('1. The HTLC was never created');
      console.log('2. The contract ID is wrong');
      console.log('3. The HTLC has already been claimed or refunded');
      return;
    }
    
    if (details.state.toString() === '2') {
      console.log('\n❌ HTLC has already been claimed');
      return;
    }
    
    if (details.state.toString() !== '1') {
      console.log('\n❌ HTLC is not in claimable state');
      return;
    }
    
    // Verify we're the beneficiary
    if (details.beneficiary.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('\n❌ Wallet mismatch');
      console.log('HTLC beneficiary:', details.beneficiary);
      console.log('Your wallet:', wallet.address);
      return;
    }
    
    // Get token info
    const tokenABI = [
      'function balanceOf(address) view returns (uint256)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const token = new ethers.Contract(details.token, tokenABI, provider);
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const balanceBefore = await token.balanceOf(wallet.address);
    
    console.log(`\n2️⃣ Token info:`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Current balance: ${ethers.formatUnits(balanceBefore, decimals)} ${symbol}`);
    
    // Execute claim
    console.log('\n3️⃣ Executing claim transaction...');
    
    // Estimate gas
    const gasEstimate = await htlc.claim.estimateGas(contractId, preimage);
    console.log('Gas estimate:', gasEstimate.toString());
    
    // Send transaction
    const tx = await htlc.claim(contractId, preimage, {
      gasLimit: gasEstimate * 150n / 100n // 50% buffer
    });
    
    console.log('\n📡 Transaction sent!');
    console.log('Hash:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log('\n✅ Transaction confirmed!');
    console.log('Block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
    
    // Check balance after
    const balanceAfter = await token.balanceOf(wallet.address);
    const received = balanceAfter - balanceBefore;
    
    console.log(`\n💰 Balance update:`);
    console.log(`Before: ${ethers.formatUnits(balanceBefore, decimals)} ${symbol}`);
    console.log(`After: ${ethers.formatUnits(balanceAfter, decimals)} ${symbol}`);
    console.log(`Received: ${ethers.formatUnits(received, decimals)} ${symbol}`);
    
    // Update swap status
    console.log('\n4️⃣ Updating swap status...');
    const updateResponse = await fetch('http://localhost:3000/api/swaps/10105da8-098c-44ac-aca6-54c576f5081e', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'USER_CLAIMED',
        userClaimedAt: new Date().toISOString()
      })
    });
    
    if (updateResponse.ok) {
      console.log('✅ Swap status updated');
    }
    
    console.log('\n🎉 Claim successful!');
    console.log('Transaction: https://explorer.monad.xyz/tx/' + tx.hash);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error);
    if (error.code === 'CALL_EXCEPTION') {
      console.log('\nThis error usually means:');
      console.log('1. The HTLC has already been claimed');
      console.log('2. The preimage is incorrect');
      console.log('3. The contract ID is wrong');
    }
  }
}

manualClaimExecution();