#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwapStatus() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  
  try {
    const result = await db.query(
      `SELECT 
        id, 
        status, 
        source_amount, 
        expected_amount, 
        user_htlc_contract,
        pool_htlc_contract,
        hash_lock,
        preimage_hash,
        created_at,
        updated_at
      FROM swap_requests 
      WHERE id = $1`,
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const swap = result.rows[0];
    console.log('\n📋 Swap Details:');
    console.log(`ID: ${swap.id}`);
    console.log(`Status: ${swap.status}`);
    console.log(`Source Amount: ${swap.source_amount} wei`);
    console.log(`Expected Amount: ${swap.expected_amount} wei`);
    console.log(`User HTLC: ${swap.user_htlc_contract || 'Not deployed'}`);
    console.log(`Pool HTLC: ${swap.pool_htlc_contract || 'Not deployed'}`);
    console.log(`Hash Lock: ${swap.hash_lock || 'Not set'}`);
    console.log(`Preimage: ${swap.preimage_hash || 'Not set'}`);
    console.log(`Created: ${swap.created_at}`);
    console.log(`Updated: ${swap.updated_at}`);
    
    console.log('\n💡 Analysis:');
    if (swap.pool_htlc_contract && swap.status === 'PENDING') {
      console.log('⚠️  Pool HTLC is deployed but status is still PENDING');
      console.log('   The resolver should have updated the status to POOL_FULFILLED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwapStatus();