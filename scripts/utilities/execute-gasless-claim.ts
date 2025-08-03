#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const HTLC_ABI = [
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function claim(bytes32 contractId, bytes32 preimage) external',
  'event Claimed(bytes32 indexed contractId, address indexed beneficiary)'
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)'
];

async function executeGaslessClaim() {
  const contractId = '0xdd1e89d0084c3c5e87030b528e09cc547cf4384a3d2b92e4cc3dcc6634abee13';
  const preimage = '0xe64325fb6cabd75f2b7d9ee22a82329e80e6ba9bf82a390cfdf21dd1369327c9';
  const beneficiary = '0x2BCc053BB6915F28aC2041855D2292dDca406903';
  
  console.log('🚀 Executing Gasless Claim\n');
  
  // Connect to Monad testnet
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  
  // Use pool manager wallet as relayer
  const relayerPrivateKey = process.env.POOL_MANAGER_PRIVATE_KEY || '0xefb5c329d347fdefd49346ae79700ea4d351b90044a25d8a67a62d56e5cee0dd';
  const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);
  
  console.log('🤖 Relayer wallet:', relayerWallet.address);
  console.log('👤 Beneficiary:', beneficiary);
  
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  const htlc = new ethers.Contract(htlcAddress, HTLC_ABI, relayerWallet);
  
  try {
    // Check HTLC details
    console.log('\n1️⃣ Checking HTLC details...');
    const details = await htlc.getDetails(contractId);
    console.log('State:', details.state.toString());
    console.log('Token:', details.token);
    console.log('Value:', ethers.formatUnits(details.value, 18), 'tokens');
    console.log('Beneficiary:', details.beneficiary);
    
    if (details.state.toString() !== '1') {
      throw new Error(`HTLC not claimable. State: ${details.state}`);
    }
    
    if (details.beneficiary.toLowerCase() !== beneficiary.toLowerCase()) {
      throw new Error(`Beneficiary mismatch. Expected: ${beneficiary}, Got: ${details.beneficiary}`);
    }
    
    // Get token balance before claim
    const token = new ethers.Contract(details.token, ERC20_ABI, provider);
    const symbol = await token.symbol();
    const balanceBefore = await token.balanceOf(beneficiary);
    console.log(`\n💰 ${symbol} balance before: ${ethers.formatUnits(balanceBefore, 18)}`);
    
    // Estimate gas
    console.log('\n2️⃣ Estimating gas...');
    const gasEstimate = await htlc.claim.estimateGas(contractId, preimage);
    console.log('Gas estimate:', gasEstimate.toString());
    
    // Execute claim
    console.log('\n3️⃣ Executing claim transaction...');
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
    const claimed = balanceAfter - balanceBefore;
    console.log(`\n💰 ${symbol} balance after: ${ethers.formatUnits(balanceAfter, 18)}`);
    console.log(`🎉 Claimed: ${ethers.formatUnits(claimed, 18)} ${symbol}`);
    
    // Return success result
    const result = {
      success: true,
      txHash: tx.hash,
      claimedAmount: ethers.formatUnits(claimed, 18),
      token: symbol,
      beneficiary: beneficiary
    };
    
    console.log('\n✅ Gasless claim successful!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.error('\n❌ Claim failed:', error.message);
    
    // Check if already claimed
    if (error.message.includes('INVALID_STATE')) {
      const details = await htlc.getDetails(contractId);
      if (details.state.toString() === '2') {
        console.log('ℹ️  This HTLC has already been claimed');
      }
    }
  }
}

executeGaslessClaim();