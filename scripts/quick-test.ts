#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import database
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

async function quickTest() {
  console.log(chalk.cyan.bold('\n🚀 QUICK PRODUCTION TEST\n'));
  
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);

  try {
    // Check the latest swap that was created
    const result = await dao.query(`
      SELECT * FROM swap_requests 
      WHERE id = 'fcae85d0-fad0-4297-96f7-27755a2c6b61'
    `);

    if (result.rows.length > 0) {
      const swap = result.rows[0];
      console.log(chalk.blue('📋 Swap Details:'));
      console.log(chalk.gray(`   ID: ${swap.id}`));
      console.log(chalk.gray(`   Status: ${swap.status}`));
      console.log(chalk.gray(`   Source Amount: ${swap.source_amount} wei`));
      console.log(chalk.gray(`   Source Amount: ${ethers.formatUnits(swap.source_amount, 18)} tokens`));
      console.log(chalk.gray(`   User HTLC: ${swap.user_htlc_contract}`));
      console.log(chalk.gray(`   Pool HTLC: ${swap.pool_htlc_contract}`));

      // Check if HTLC exists on chain
      if (swap.user_htlc_contract) {
        console.log(chalk.yellow('\n🔍 Verifying User HTLC on Sepolia...'));
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
        const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
        const htlc = new ethers.Contract('0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7', abi, provider);
        
        const details = await htlc.contracts(swap.user_htlc_contract);
        console.log(chalk.green('✅ User HTLC verified!'));
        console.log(chalk.gray(`   State: ${details.state}`));
        console.log(chalk.gray(`   Value: ${details.value.toString()} wei`));
        console.log(chalk.gray(`   Value: ${ethers.formatUnits(details.value, 18)} MONSTER`));
      }

      if (swap.pool_htlc_contract) {
        console.log(chalk.yellow('\n🔍 Verifying Pool HTLC on Monad...'));
        const monadProvider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
        const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
        const monadHtlc = new ethers.Contract('0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9', abi, monadProvider);
        
        try {
          const poolDetails = await monadHtlc.contracts(swap.pool_htlc_contract);
          console.log(chalk.green('✅ Pool HTLC verified on Monad!'));
          console.log(chalk.gray(`   State: ${poolDetails.state}`));
          console.log(chalk.gray(`   Value: ${poolDetails.value.toString()} wei`));
          console.log(chalk.gray(`   Token: ${poolDetails.token}`));
        } catch (e) {
          console.log(chalk.yellow('   Pool HTLC not yet created or not accessible'));
        }
      }
    }

    // Check all pending swaps
    console.log(chalk.yellow('\n📊 All Pending Swaps:'));
    const pendingSwaps = await dao.query(`
      SELECT id, source_amount, expected_amount, status, user_htlc_contract, pool_htlc_contract 
      FROM swap_requests 
      WHERE status IN ('PENDING', 'POOL_FULFILLED')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    for (const swap of pendingSwaps.rows) {
      const amount = ethers.formatUnits(swap.source_amount || '0', 18);
      console.log(chalk.gray(`\n   ${swap.id}`));
      console.log(chalk.gray(`   Amount: ${amount} tokens (${swap.source_amount} wei)`));
      console.log(chalk.gray(`   Status: ${swap.status}`));
      console.log(chalk.gray(`   User HTLC: ${swap.user_htlc_contract ? '✓' : '✗'}`));
      console.log(chalk.gray(`   Pool HTLC: ${swap.pool_htlc_contract ? '✓' : '✗'}`));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await database.close();
  }
}

quickTest().catch(console.error);