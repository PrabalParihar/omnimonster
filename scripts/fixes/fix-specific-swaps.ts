#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Specific swaps that need fixing based on the resolver logs
const SWAPS_TO_FIX = [
  {
    id: 'd883e3a4-635d-4d67-92bd-440108a82587',
    issue: 'Amount stored as 9 instead of 9000000000000000000',
    action: 'CANCEL' // This swap has a mismatched pool HTLC
  },
  {
    id: 'ea49c8bc-7347-4dae-a941-6077d4383773',
    issue: 'Amount stored as 3 instead of 3000000000000000000',
    action: 'CANCEL' // Preimage mismatch
  },
  {
    id: '3068f871-b0c4-4d02-ac9a-fdd2b0223721',
    issue: 'Amount stored as 9 instead of 9000000000000000000',
    action: 'CANCEL' // Pool HTLC mismatch
  },
  {
    id: '26d51561-a49f-4136-b0d1-22f9ec5702a9',
    issue: 'Amount stored as 9 instead of 9000000000000000000',
    action: 'CANCEL' // Pool HTLC mismatch
  }
];

async function fixSpecificSwaps() {
  console.log(chalk.cyan.bold('\n🔧 Fixing Specific Swaps\n'));
  
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    for (const swap of SWAPS_TO_FIX) {
      console.log(chalk.blue(`\nProcessing swap ${swap.id}:`));
      console.log(`  Issue: ${swap.issue}`);
      console.log(`  Action: ${swap.action}`);
      
      if (swap.action === 'CANCEL') {
        // Cancel the swap due to unrecoverable issues
        await db.query(
          `UPDATE swap_requests 
           SET status = 'CANCELLED', 
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [swap.id]
        );
        console.log(chalk.yellow('  ✅ Cancelled'));
      }
    }
    
    // Also mark any new dry-run swaps as completed
    console.log(chalk.blue('\n\nCleaning up dry-run swaps...'));
    const dryRunResult = await db.query(`
      UPDATE swap_requests 
      SET status = 'EXPIRED', 
          updated_at = CURRENT_TIMESTAMP
      WHERE 
        status = 'PENDING' 
        AND (user_htlc_contract IS NULL OR user_htlc_contract = '')
        AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `);
    
    console.log(chalk.yellow(`  ✅ Expired ${dryRunResult.rows.length} dry-run swaps`));
    
    // Reset pool liquidity
    console.log(chalk.blue('\n\nResetting pool liquidity...'));
    await db.query(`
      UPDATE pool_liquidity 
      SET 
        reserved_balance = '0',
        available_balance = total_balance,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log(chalk.green('  ✅ Reset pool liquidity'));
    
    // Final summary
    console.log(chalk.cyan.bold('\n\n📊 Current Status:'));
    const summary = await db.query(`
      SELECT 
        status, 
        COUNT(*) as count
      FROM swap_requests
      WHERE created_at > NOW() - INTERVAL '48 hours'
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\nRecent swaps by status:');
    for (const row of summary.rows) {
      console.log(`  ${row.status}: ${row.count}`);
    }
    
    console.log(chalk.green.bold('\n✅ Cleanup complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await db.close();
  }
}

fixSpecificSwaps();