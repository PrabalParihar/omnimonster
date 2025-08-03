#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function updateSwapStatus() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  
  try {
    console.log(`🔧 Updating swap ${swapId} status to POOL_FULFILLED...`);
    
    await db.query(
      `UPDATE swap_requests 
       SET status = 'POOL_FULFILLED', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [swapId]
    );
    
    console.log('✅ Status updated successfully');
    
    // Verify the update
    const result = await db.query(
      `SELECT id, status, pool_htlc_contract FROM swap_requests WHERE id = $1`,
      [swapId]
    );
    
    const swap = result.rows[0];
    console.log('\n📋 Updated swap:');
    console.log(`ID: ${swap.id}`);
    console.log(`Status: ${swap.status}`);
    console.log(`Pool HTLC: ${swap.pool_htlc_contract}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

updateSwapStatus();