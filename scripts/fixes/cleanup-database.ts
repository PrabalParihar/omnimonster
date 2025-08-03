#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

dotenv.config({ path: path.join(__dirname, '.env.local') });

interface SwapToFix {
  id: string;
  source_amount: string;
  expected_amount: string;
  status: string;
  pool_htlc_contract: string;
}

async function cleanupDatabase() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  console.log(chalk.cyan.bold('\n🧹 Database Cleanup Script\n'));
  
  try {
    // Step 1: Find all swaps with decimal amounts (amounts less than 1e15)
    console.log(chalk.blue('Step 1: Finding swaps with decimal amounts...'));
    const decimalSwaps = await db.query<SwapToFix>(`
      SELECT id, source_amount, expected_amount, status, pool_htlc_contract 
      FROM swap_requests 
      WHERE 
        (CAST(source_amount AS DECIMAL) < 1000000000000000 OR 
         CAST(expected_amount AS DECIMAL) < 1000000000000000)
        AND status IN ('PENDING', 'POOL_FULFILLED')
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${decimalSwaps.rows.length} swaps with decimal amounts`);
    
    // Step 2: Fix amounts by converting to wei
    console.log(chalk.blue('\nStep 2: Converting decimal amounts to wei...'));
    let fixedCount = 0;
    
    for (const swap of decimalSwaps.rows) {
      console.log(`\n📝 Processing swap ${swap.id}`);
      console.log(`   Current amounts: ${swap.source_amount} / ${swap.expected_amount}`);
      
      // Check if amounts are likely decimal (less than 1e15)
      const sourceNum = BigInt(swap.source_amount);
      const expectedNum = BigInt(swap.expected_amount);
      
      if (sourceNum < 1000000000000000n || expectedNum < 1000000000000000n) {
        // Convert to wei (multiply by 1e18)
        const sourceWei = (sourceNum * 1000000000000000000n).toString();
        const expectedWei = (expectedNum * 1000000000000000000n).toString();
        
        console.log(`   Converting to wei: ${sourceWei} / ${expectedWei}`);
        
        await db.query(
          `UPDATE swap_requests 
           SET source_amount = $1, expected_amount = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [sourceWei, expectedWei, swap.id]
        );
        
        fixedCount++;
        console.log(chalk.green('   ✅ Fixed'));
      }
    }
    
    console.log(chalk.green(`\n✅ Fixed ${fixedCount} swaps with decimal amounts`));
    
    // Step 3: Clean up stuck swaps with mismatched pool HTLCs
    console.log(chalk.blue('\nStep 3: Finding stuck swaps with pool HTLC mismatches...'));
    const stuckSwaps = await db.query<SwapToFix>(`
      SELECT id, status, pool_htlc_contract 
      FROM swap_requests 
      WHERE 
        status = 'PENDING' 
        AND pool_htlc_contract IS NOT NULL 
        AND pool_htlc_contract != ''
        AND created_at < NOW() - INTERVAL '1 hour'
    `);
    
    console.log(`Found ${stuckSwaps.rows.length} stuck swaps with pool HTLCs`);
    
    // Mark these as failed so they don't keep getting retried
    if (stuckSwaps.rows.length > 0) {
      const stuckIds = stuckSwaps.rows.map(s => s.id);
      await db.query(
        `UPDATE swap_requests 
         SET status = 'FAILED', 
             updated_at = CURRENT_TIMESTAMP,
             error = 'Stuck swap with pool HTLC mismatch - cleaned up'
         WHERE id = ANY($1::uuid[])`,
        [stuckIds]
      );
      console.log(chalk.yellow(`⚠️  Marked ${stuckIds.length} stuck swaps as FAILED`));
    }
    
    // Step 4: Clean up very old pending swaps (older than 24 hours)
    console.log(chalk.blue('\nStep 4: Cleaning up old pending swaps...'));
    const oldPendingResult = await db.query(`
      UPDATE swap_requests 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE 
        status = 'PENDING' 
        AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING id
    `);
    
    console.log(chalk.yellow(`⚠️  Expired ${oldPendingResult.rows.length} old pending swaps`));
    
    // Step 5: Reset pool liquidity tracking
    console.log(chalk.blue('\nStep 5: Resetting pool liquidity tracking...'));
    
    // First, get current balances
    const liquidityData = await db.query(`
      SELECT token_address, total_balance, available_balance, reserved_balance 
      FROM pool_liquidity
    `);
    
    console.log('\nCurrent liquidity state:');
    for (const row of liquidityData.rows) {
      console.log(`   ${row.token_address}: Available=${row.available_balance}, Reserved=${row.reserved_balance}`);
    }
    
    // Reset negative reserved balances
    await db.query(`
      UPDATE pool_liquidity 
      SET 
        reserved_balance = '0',
        available_balance = total_balance,
        updated_at = CURRENT_TIMESTAMP
      WHERE CAST(reserved_balance AS DECIMAL) < 0
    `);
    
    console.log(chalk.green('✅ Reset pool liquidity tracking'));
    
    // Step 6: Summary report
    console.log(chalk.cyan.bold('\n📊 Cleanup Summary:'));
    
    const summaryResult = await db.query(`
      SELECT 
        status, 
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM swap_requests
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\nSwap status distribution:');
    for (const row of summaryResult.rows) {
      console.log(`   ${row.status}: ${row.count} swaps`);
    }
    
    // Check for any remaining issues
    const remainingIssues = await db.query(`
      SELECT COUNT(*) as count
      FROM swap_requests
      WHERE 
        (CAST(source_amount AS DECIMAL) < 1000000000000000 OR 
         CAST(expected_amount AS DECIMAL) < 1000000000000000)
        AND status IN ('PENDING', 'POOL_FULFILLED')
    `);
    
    if (remainingIssues.rows[0].count > 0) {
      console.log(chalk.red(`\n⚠️  Warning: ${remainingIssues.rows[0].count} swaps still have decimal amounts`));
    } else {
      console.log(chalk.green('\n✅ All amounts are now in wei format'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Cleanup failed:'), error);
  } finally {
    await db.close();
  }
}

// Run cleanup
cleanupDatabase();