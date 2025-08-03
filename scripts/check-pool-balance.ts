#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const CONFIG = {
  POOL_WALLET_KEY: process.env.PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647',
  MONAD_RPC: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  MONAD_OMNIMONSTER: process.env.NEXT_PUBLIC_MONAD_OMNIMONSTER || '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
  MONAD_HTLC: process.env.NEXT_PUBLIC_MONAD_HTLC || '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3',
};

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)'
];

async function checkPoolBalance() {
  console.log(chalk.cyan.bold('\n💰 CHECKING POOL WALLET BALANCES\n'));
  
  const poolWallet = new ethers.Wallet(CONFIG.POOL_WALLET_KEY);
  const monadProvider = new ethers.JsonRpcProvider(CONFIG.MONAD_RPC);
  
  console.log(chalk.blue('👤 Pool Wallet:'), poolWallet.address);
  
  try {
    // Check MONAD balance
    const monadBalance = await monadProvider.getBalance(poolWallet.address);
    console.log(chalk.green('\n💎 MONAD Balance:'), ethers.formatEther(monadBalance), 'MONAD');
    
    // Check OMNIMONSTER token
    console.log(chalk.yellow('\n🪙 Checking OMNIMONSTER Token...'));
    const omniToken = new ethers.Contract(CONFIG.MONAD_OMNIMONSTER, ERC20_ABI, monadProvider);
    
    try {
      const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
        omniToken.name(),
        omniToken.symbol(),
        omniToken.decimals(),
        omniToken.totalSupply(),
        omniToken.owner()
      ]);
      
      console.log(chalk.gray(`   Name: ${name}`));
      console.log(chalk.gray(`   Symbol: ${symbol}`));
      console.log(chalk.gray(`   Decimals: ${decimals}`));
      console.log(chalk.gray(`   Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`));
      console.log(chalk.gray(`   Owner: ${owner}`));
      
      const balance = await omniToken.balanceOf(poolWallet.address);
      console.log(chalk.green(`   Pool Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`));
      
      if (balance === 0n) {
        console.log(chalk.red('\n❌ Pool wallet has no OMNIMONSTER tokens!'));
        console.log(chalk.yellow('   The pool wallet needs OMNIMONSTER tokens to create HTLCs on Monad'));
        
        // Check if pool wallet is the owner
        if (owner.toLowerCase() === poolWallet.address.toLowerCase()) {
          console.log(chalk.green('\n✅ Good news: Pool wallet is the token owner!'));
          console.log(chalk.gray('   You can mint tokens directly'));
        }
      } else {
        console.log(chalk.green('\n✅ Pool wallet has sufficient OMNIMONSTER balance'));
      }
      
    } catch (error: any) {
      console.log(chalk.red('❌ Error checking OMNIMONSTER token:'), error.message);
      console.log(chalk.yellow('   The token contract might not be deployed at this address'));
    }
    
    // Check HTLC contract
    console.log(chalk.yellow('\n📄 Checking HTLC Contract...'));
    const htlcCode = await monadProvider.getCode(CONFIG.MONAD_HTLC);
    console.log(`   HTLC Contract (${CONFIG.MONAD_HTLC}):`);
    console.log(`   Has code: ${htlcCode !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`   Code length: ${htlcCode.length}`);
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

checkPoolBalance().catch(console.error);