#!/usr/bin/env tsx

import { CrossChainSwapTester, CROSS_CHAIN_SWAPS } from './cross-chain-swap';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment from multiple locations
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

/**
 * Omni Token (Monad) → Monster Token (Sepolia) Cross-Chain Swap
 * 
 * Flow:
 * 1. User creates swap request (Omni → Monster)
 * 2. User deploys HTLC on Monad with Omni tokens
 * 3. User deposits Omni tokens into Monad HTLC
 * 4. Database records swap request with HTLC address
 * 5. Pool Manager triggers automatic fulfillment
 * 6. Resolver detects swap and validates
 * 7. Pool checks liquidity for Monster tokens on Sepolia
 * 8. Pool deploys HTLC on Sepolia with Monster tokens
 * 9. Pool claims Omni tokens from Monad HTLC
 * 10. User performs gasless claim of Monster tokens from Sepolia HTLC
 */

async function omniToMonsterSwap() {
  console.log(chalk.cyan.bold('🌟 Omni Token → Monster Token Cross-Chain Swap'));
  console.log(chalk.gray('From: Monad Testnet → To: Sepolia Testnet'));
  console.log();

  // Get parameters from command line or use defaults
  const amount = process.argv[2] || '10'; // 10 OMNI tokens
  const destinationAddress = process.argv[3] || process.env.TEST_WALLET_ADDRESS || '0x2BCc053BB6915F28aC2041855D2292dDca406903';

  if (!destinationAddress) {
    console.error(chalk.red('❌ Destination address is required'));
    console.log(chalk.yellow('Usage: npm run swap:omni-to-monster [amount] [destinationAddress]'));
    process.exit(1);
  }

  console.log(chalk.blue(`💰 Swapping ${amount} OMNI tokens`));
  console.log(chalk.green(`📍 Destination: ${destinationAddress}`));
  console.log();

  const config = {
    ...CROSS_CHAIN_SWAPS.omniToMonster,
    amount,
    destinationAddress,
    slippage: 0.5 // 0.5% slippage tolerance
  };

  // Validate environment variables
  const requiredEnvVars = [
    'SEPOLIA_RPC_URL',
    'MONAD_RPC_URL', 
    'SEPOLIA_FUSION_HTLC_CONTRACT',
    'MONAD_FUSION_HTLC_CONTRACT',
    'TEST_WALLET_PRIVATE_KEY',
    'NEXT_PUBLIC_API_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(chalk.red(`❌ Missing environment variable: ${envVar}`));
      process.exit(1);
    }
  }

  try {
    const swapTester = new CrossChainSwapTester(config);
    
    console.log(chalk.yellow('⚠️  Make sure you have:'));
    console.log(chalk.gray('  • Omni tokens on Monad'));
    console.log(chalk.gray('  • Pool has Monster token liquidity on Sepolia'));
    console.log(chalk.gray('  • Resolver service is running'));
    console.log(chalk.gray('  • Gas relayer service is running'));
    console.log();

    // Wait for user confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      readline.question(chalk.cyan('Press Enter to continue or Ctrl+C to cancel...'), () => {
        readline.close();
        resolve(null);
      });
    });

    await swapTester.executeSwap();
    
    console.log();
    console.log(chalk.green.bold('🎉 Omni → Monster cross-chain swap completed!'));
    console.log(chalk.gray(`Check your balance at: ${destinationAddress}`));

  } catch (error) {
    console.error(chalk.red.bold('❌ Swap failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  omniToMonsterSwap().catch(console.error);
}

export { omniToMonsterSwap };