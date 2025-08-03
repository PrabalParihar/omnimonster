import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwapStatus() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔍 Checking swap status...\n');
    
    // Get all swaps
    const swaps = await db.query(`
      SELECT 
        id, 
        status, 
        source_token, 
        target_token, 
        source_amount,
        user_htlc_contract,
        pool_htlc_contract,
        created_at,
        updated_at
      FROM swap_requests 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${swaps.rows.length} swaps:\n`);
    
    swaps.rows.forEach(swap => {
      console.log(`📋 Swap ${swap.id}:`);
      console.log(`   Status: ${swap.status}`);
      console.log(`   Tokens: ${swap.source_token} -> ${swap.target_token}`);
      console.log(`   Amount: ${swap.source_amount}`);
      console.log(`   User HTLC: ${swap.user_htlc_contract || 'Not set'}`);
      console.log(`   Pool HTLC: ${swap.pool_htlc_contract || 'Not set'}`);
      console.log(`   Created: ${new Date(swap.created_at).toISOString()}`);
      console.log(`   Updated: ${new Date(swap.updated_at).toISOString()}`);
      console.log('');
    });
    
    // Check resolver operations
    const operations = await db.query(`
      SELECT 
        ro.id,
        ro.swap_request_id,
        ro.operation_type,
        ro.status,
        ro.error_message,
        ro.started_at,
        ro.completed_at
      FROM resolver_operations ro
      JOIN swap_requests sr ON ro.swap_request_id = sr.id
      WHERE sr.status = 'PENDING'
      ORDER BY ro.started_at DESC
      LIMIT 10
    `);
    
    if (operations.rows.length > 0) {
      console.log('\n🔧 Resolver Operations for Pending Swaps:');
      operations.rows.forEach(op => {
        console.log(`\n- Operation ${op.id}:`);
        console.log(`  Swap: ${op.swap_request_id}`);
        console.log(`  Type: ${op.operation_type}`);
        console.log(`  Status: ${op.status}`);
        if (op.error_message) {
          console.log(`  Error: ${op.error_message}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwapStatus();