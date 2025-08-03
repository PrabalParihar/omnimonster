#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import database
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

async function checkLatestSwap() {
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);

  try {
    // Get the latest swap
    const result = await dao.query(`
      SELECT * FROM swap_requests 
      WHERE id = '092211e5-50f9-46a9-9116-e17cf1099274'
    `);

    if (result.rows.length > 0) {
      const swap = result.rows[0];
      console.log(chalk.cyan('\n📋 Latest Swap Status:'));
      console.log(chalk.gray(`   ID: ${swap.id}`));
      console.log(chalk.gray(`   Status: ${swap.status}`));
      console.log(chalk.gray(`   Source Amount: ${swap.source_amount} wei (${ethers.formatUnits(swap.source_amount, 18)} tokens)`));
      console.log(chalk.gray(`   User HTLC: ${swap.user_htlc_contract}`));
      console.log(chalk.gray(`   Pool HTLC: ${swap.pool_htlc_contract}`));
      console.log(chalk.gray(`   Created: ${swap.created_at}`));
      console.log(chalk.gray(`   Updated: ${swap.updated_at}`));

      if (swap.user_htlc_contract) {
        console.log(chalk.yellow('\n🔍 Verifying User HTLC...'));
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
        const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
        const htlc = new ethers.Contract('0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7', abi, provider);
        
        try {
          const details = await htlc.contracts(swap.user_htlc_contract);
          console.log(chalk.green('✅ User HTLC exists'));
          console.log(chalk.gray(`   State: ${details.state}`));
          console.log(chalk.gray(`   Value: ${details.value.toString()} wei`));
        } catch (e) {
          console.log(chalk.red('❌ User HTLC not found'));
        }
      }

      if (swap.status === 'POOL_FULFILLED' && swap.pool_htlc_contract) {
        console.log(chalk.green('\n✅ SWAP IS SUCCESSFUL!'));
        console.log('The pool HTLC has been created on Monad.');
      } else {
        console.log(chalk.yellow('\n⚠️  Pool HTLC not yet created'));
        console.log('The resolver may still be processing...');
      }
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await database.close();
  }
}

checkLatestSwap().catch(console.error);