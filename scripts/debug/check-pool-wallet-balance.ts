import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';
import { getToken } from './packages/shared/src/tokens';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkPoolWalletBalance() {
  console.log('🔍 Checking pool wallet balance on Monad...\n');
  
  const walletAddress = '0x2BCc053BB6915F28aC2041855D2292dDca406903';
  const provider = new ethers.JsonRpcProvider(evmChains.monadTestnet.rpcUrl);
  
  // Get OMNIMONSTER token info
  const token = getToken('monadTestnet', 'OMNIMONSTER');
  if (!token) {
    console.log('❌ OMNIMONSTER token not found');
    return;
  }
  
  console.log('📋 Pool wallet:', walletAddress);
  console.log('💰 Token:', token.symbol, 'at', token.address);
  
  // Check ETH balance
  const ethBalance = await provider.getBalance(walletAddress);
  console.log('\n💎 ETH balance:', ethers.formatEther(ethBalance), 'ETH');
  
  // Check token balance
  const tokenContract = new ethers.Contract(
    token.address,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  try {
    const tokenBalance = await tokenContract.balanceOf(walletAddress);
    console.log('🪙 OMNIMONSTER balance:', ethers.formatUnits(tokenBalance, 18), token.symbol);
  } catch (error) {
    console.log('❌ Error checking token balance:', error.message);
  }
  
  // Check if HTLC contract is deployed
  const htlcAddress = evmChains.monadTestnet.htlcAddress;
  console.log('\n📄 HTLC contract:', htlcAddress);
  
  const htlcCode = await provider.getCode(htlcAddress);
  if (htlcCode === '0x') {
    console.log('❌ HTLC contract NOT deployed on Monad!');
  } else {
    console.log('✅ HTLC contract is deployed');
    
    // Check token allowance
    const allowanceABI = ['function allowance(address owner, address spender) view returns (uint256)'];
    const tokenWithAllowance = new ethers.Contract(token.address, allowanceABI, provider);
    
    try {
      const allowance = await tokenWithAllowance.allowance(walletAddress, htlcAddress);
      console.log('✅ Token allowance for HTLC:', ethers.formatUnits(allowance, 18), token.symbol);
    } catch (error) {
      console.log('❌ Error checking allowance:', error.message);
    }
  }
}

checkPoolWalletBalance();