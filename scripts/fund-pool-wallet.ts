import { ethers } from 'ethers';
import { evmChains } from '../packages/shared/src/chains';
import { getToken } from '../packages/shared/src/tokens';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ERC20 ABI for token transfers
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function mint(address to, uint256 amount) external", // For demo tokens that have minting
];

async function fundPoolWallet() {
  console.log('🏦 Funding Pool Wallet with Demo Tokens...\n');
  
  const poolPrivateKey = process.env.POOL_MANAGER_PRIVATE_KEY;
  if (!poolPrivateKey) {
    throw new Error('POOL_MANAGER_PRIVATE_KEY not found in environment variables');
  }

  // Your main wallet private key (the one that has tokens to transfer)
  const mainWalletKey = process.env.PRIVATE_KEY;
  if (!mainWalletKey) {
    throw new Error('PRIVATE_KEY not found in environment variables');
  }

  // Fund Monad Testnet with OMNI tokens
  await fundTokenOnChain('monadTestnet', 'OMNI', '10000'); // 10,000 OMNI tokens
  
  // Fund Sepolia with MONSTER tokens  
  await fundTokenOnChain('sepolia', 'MONSTER', '10000'); // 10,000 MONSTER tokens

  console.log('\n✅ Pool wallet funding completed!');
}

async function fundTokenOnChain(chainKey: string, tokenSymbol: string, amount: string) {
  console.log(`\n🔗 Funding ${chainKey} with ${amount} ${tokenSymbol} tokens...`);
  
  const chainConfig = evmChains[chainKey];
  if (!chainConfig) {
    throw new Error(`Chain ${chainKey} not found`);
  }

  const tokenConfig = getToken(chainKey, tokenSymbol);
  if (!tokenConfig) {
    throw new Error(`Token ${tokenSymbol} not found on ${chainKey}`);
  }

  console.log(`   Chain: ${chainConfig.name}`);
  console.log(`   Token: ${tokenConfig.name} (${tokenConfig.address})`);
  console.log(`   Amount: ${amount} tokens`);

  // Connect to the chain
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  
  // Main wallet (source of funds)
  const mainWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  // Pool wallet (destination)
  const poolWallet = new ethers.Wallet(process.env.POOL_MANAGER_PRIVATE_KEY!, provider);
  
  console.log(`   Main wallet: ${mainWallet.address}`);
  console.log(`   Pool wallet: ${poolWallet.address}`);

  // Connect to token contract
  const tokenContract = new ethers.Contract(tokenConfig.address, ERC20_ABI, mainWallet);

  try {
    // Check current balances
    const mainBalance = await tokenContract.balanceOf(mainWallet.address);
    const poolBalance = await tokenContract.balanceOf(poolWallet.address);
    const decimals = await tokenContract.decimals();
    
    console.log(`   Main wallet balance: ${ethers.formatUnits(mainBalance, decimals)} ${tokenSymbol}`);
    console.log(`   Pool wallet balance: ${ethers.formatUnits(poolBalance, decimals)} ${tokenSymbol}`);

    // Convert amount to wei
    const amountWei = ethers.parseUnits(amount, decimals);
    
    // Check if main wallet has enough balance
    if (mainBalance < amountWei) {
      console.log(`   ⚠️  Main wallet doesn't have enough ${tokenSymbol} tokens`);
      console.log(`   Attempting to mint tokens to main wallet...`);
      
      try {
        // Try to mint tokens (if the token contract supports it)
        const mintTx = await tokenContract.mint(mainWallet.address, amountWei);
        await mintTx.wait();
        console.log(`   ✅ Minted ${amount} ${tokenSymbol} tokens to main wallet`);
      } catch (mintError) {
        console.log(`   ❌ Could not mint tokens: ${(mintError as Error).message}`);
        console.log(`   Skipping ${tokenSymbol} funding - please manually add tokens to ${mainWallet.address}`);
        return;
      }
    }

    // Transfer tokens to pool wallet
    console.log(`   Transferring ${amount} ${tokenSymbol} tokens to pool wallet...`);
    
    const transferTx = await tokenContract.transfer(poolWallet.address, amountWei);
    const receipt = await transferTx.wait();
    
    console.log(`   ✅ Transfer successful!`);
    console.log(`   Transaction hash: ${receipt?.hash}`);
    
    // Check new balances
    const newMainBalance = await tokenContract.balanceOf(mainWallet.address);
    const newPoolBalance = await tokenContract.balanceOf(poolWallet.address);
    
    console.log(`   New main wallet balance: ${ethers.formatUnits(newMainBalance, decimals)} ${tokenSymbol}`);
    console.log(`   New pool wallet balance: ${ethers.formatUnits(newPoolBalance, decimals)} ${tokenSymbol}`);

  } catch (error) {
    console.error(`   ❌ Error funding ${tokenSymbol} on ${chainKey}:`, error);
  }
}

async function fundWithNativeTokens() {
  console.log('\n💰 Funding Pool Wallet with Native Tokens for Gas...\n');
  
  const mainWallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
  const poolWalletAddress = new ethers.Wallet(process.env.POOL_MANAGER_PRIVATE_KEY!).address;

  // Fund on Sepolia
  try {
    const sepoliaProvider = new ethers.JsonRpcProvider(evmChains.sepolia.rpcUrl);
    const sepoliaWallet = mainWallet.connect(sepoliaProvider);
    
    console.log('🔗 Funding Sepolia ETH for gas...');
    const sepoliaBalance = await sepoliaProvider.getBalance(poolWalletAddress);
    console.log(`   Current pool balance: ${ethers.formatEther(sepoliaBalance)} ETH`);
    
    if (sepoliaBalance < ethers.parseEther('0.1')) {
      const tx = await sepoliaWallet.sendTransaction({
        to: poolWalletAddress,
        value: ethers.parseEther('0.1'), // 0.1 ETH for gas
      });
      await tx.wait();
      console.log(`   ✅ Sent 0.1 ETH to pool wallet on Sepolia`);
    } else {
      console.log(`   ✅ Pool wallet already has sufficient ETH`);
    }
  } catch (error) {
    console.error('   ❌ Error funding Sepolia:', error);
  }

  // Fund on Monad Testnet
  try {
    const monadProvider = new ethers.JsonRpcProvider(evmChains.monadTestnet.rpcUrl);
    const monadWallet = mainWallet.connect(monadProvider);
    
    console.log('🔗 Funding Monad native tokens for gas...');
    const monadBalance = await monadProvider.getBalance(poolWalletAddress);
    console.log(`   Current pool balance: ${ethers.formatEther(monadBalance)} MON`);
    
    if (monadBalance < ethers.parseEther('0.1')) {
      const tx = await monadWallet.sendTransaction({
        to: poolWalletAddress,
        value: ethers.parseEther('0.1'), // 0.1 MON for gas
      });
      await tx.wait();
      console.log(`   ✅ Sent 0.1 MON to pool wallet on Monad`);
    } else {
      console.log(`   ✅ Pool wallet already has sufficient MON`);
    }
  } catch (error) {
    console.error('   ❌ Error funding Monad:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('═'.repeat(60));
    console.log('🚀 POOL WALLET FUNDING SCRIPT');
    console.log('═'.repeat(60));

    // First fund with native tokens for gas
    await fundWithNativeTokens();
    
    // Then fund with demo tokens
    await fundPoolWallet();
    
    console.log('\n═'.repeat(60));
    console.log('🎉 Pool wallet funding completed successfully!');
    console.log('The resolver should now be able to deploy pool HTLCs.');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { fundPoolWallet, fundTokenOnChain };