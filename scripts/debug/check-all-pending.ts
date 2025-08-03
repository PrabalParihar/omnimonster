import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkAllPending() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    // Get pending swaps like resolver does
    const result = await db.query(`
      SELECT id, status, user_htlc_contract, source_token, target_token, created_at
      FROM swap_requests
      WHERE status = 'PENDING'
      AND user_htlc_contract IS NOT NULL
      AND user_htlc_contract != ''
      ORDER BY created_at ASC
      LIMIT 10
    `);
    
    console.log(`📊 Pending swaps with HTLCs: ${result.rows.length}`);
    
    result.rows.forEach(swap => {
      console.log(`\n- ${swap.id}`);
      console.log(`  Status: ${swap.status}`);
      console.log(`  Tokens: ${swap.source_token} -> ${swap.target_token}`);
      console.log(`  HTLC: ${swap.user_htlc_contract?.substring(0, 20)}...`);
      console.log(`  Created: ${new Date(swap.created_at).toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkAllPending();