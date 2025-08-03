import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';
import { getToken } from './packages/shared/src/tokens';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function approveHTLCOnMonad() {
  console.log('🔧 Approving HTLC contract on Monad...\n');
  
  const privateKey = process.env.POOL_WALLET_PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
  const provider = new ethers.JsonRpcProvider(evmChains.monadTestnet.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Get OMNIMONSTER token info
  const token = getToken('monadTestnet', 'OMNIMONSTER');
  if (!token) {
    console.log('❌ OMNIMONSTER token not found');
    return;
  }
  
  const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9'; // New SimpleHTLC
  
  console.log('📋 Pool wallet:', wallet.address);
  console.log('💰 Token:', token.symbol, 'at', token.address);
  console.log('📄 HTLC contract:', htlcAddress);
  
  // Create token contract instance
  const tokenContract = new ethers.Contract(
    token.address,
    [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address) view returns (uint256)'
    ],
    wallet
  );
  
  try {
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(wallet.address, htlcAddress);
    console.log('\n📊 Current allowance:', ethers.formatUnits(currentAllowance, 18), token.symbol);
    
    // Check balance
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log('💎 Token balance:', ethers.formatUnits(balance, 18), token.symbol);
    
    // Approve a large amount (1 million tokens)
    const approveAmount = ethers.parseUnits('1000000', 18);
    console.log('\n🚀 Approving 1,000,000 tokens...');
    
    const tx = await tokenContract.approve(htlcAddress, approveAmount, {
      gasLimit: 100000,
      maxFeePerGas: ethers.parseUnits('100', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
    });
    
    console.log('📤 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Approval confirmed in block:', receipt.blockNumber);
    
    // Verify new allowance
    const newAllowance = await tokenContract.allowance(wallet.address, htlcAddress);
    console.log('\n✅ New allowance:', ethers.formatUnits(newAllowance, 18), token.symbol);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

approveHTLCOnMonad();