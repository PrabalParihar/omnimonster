import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function cleanInvalidSwaps() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🧹 Cleaning invalid test swaps from database...\n');
    
    // Get all pending swaps with invalid contract IDs
    const invalidSwaps = await db.query(`
      SELECT id, user_htlc_contract, source_token, target_token, status 
      FROM swap_requests 
      WHERE status = 'PENDING' 
      AND (
        user_htlc_contract = '0x1234567890123456789012345678901234567890123456789012345678901234'
        OR user_htlc_contract LIKE '0x12345678%'
        OR LENGTH(user_htlc_contract) != 66
      )
    `);
    
    console.log(`Found ${invalidSwaps.rows.length} invalid swaps to clean:`);
    
    for (const swap of invalidSwaps.rows) {
      console.log(`\n- Swap ${swap.id}:`);
      console.log(`  Contract ID: ${swap.user_htlc_contract}`);
      console.log(`  Tokens: ${swap.source_token} -> ${swap.target_token}`);
      
      // Update status to EXPIRED
      await db.query(
        `UPDATE swap_requests SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
        [swap.id]
      );
      console.log(`  ✅ Marked as EXPIRED`);
    }
    
    // Also clean up any resolver operations for these swaps
    const cleanupOps = await db.query(`
      UPDATE resolver_operations 
      SET status = 'FAILED', error_message = 'Invalid HTLC contract ID', completed_at = NOW()
      WHERE swap_request_id IN (
        SELECT id FROM swap_requests 
        WHERE status = 'EXPIRED' 
        AND user_htlc_contract LIKE '0x12345678%'
      )
      AND status = 'IN_PROGRESS'
      RETURNING id
    `);
    
    console.log(`\n✅ Cleaned up ${cleanupOps.rows.length} resolver operations`);
    
    // Show current valid pending swaps
    const validSwaps = await db.query(`
      SELECT id, user_htlc_contract, source_token, target_token, created_at 
      FROM swap_requests 
      WHERE status = 'PENDING' 
      AND user_htlc_contract IS NOT NULL
      AND LENGTH(user_htlc_contract) = 66
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`\n📋 Current valid pending swaps: ${validSwaps.rows.length}`);
    validSwaps.rows.forEach(swap => {
      console.log(`- ${swap.id}: ${swap.source_token} -> ${swap.target_token}`);
      console.log(`  Contract: ${swap.user_htlc_contract}`);
    });
    
    console.log('\n✅ Database cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

cleanInvalidSwaps();