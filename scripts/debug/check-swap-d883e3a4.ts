import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = 'd883e3a4-635d-4d67-92bd-440108a82587';
  
  try {
    console.log(`🔍 Checking swap ${swapId}\n`);
    
    const result = await db.query(
      'SELECT * FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const swap = result.rows[0];
    console.log('📋 Swap details:');
    console.log('- Status:', swap.status);
    console.log('- Source:', swap.source_token);
    console.log('- Target:', swap.target_token); 
    console.log('- Source amount:', swap.source_amount);
    console.log('- Expected amount:', swap.expected_amount);
    console.log('- Hash lock:', swap.hash_lock);
    console.log('- Preimage hash:', swap.preimage_hash || '(empty)');
    console.log('- User HTLC:', swap.user_htlc_contract);
    console.log('- Pool HTLC:', swap.pool_htlc_contract);
    console.log('- Created:', new Date(swap.created_at).toLocaleString());
    
    console.log('\n💡 Amount Analysis:');
    console.log(`- Source amount in DB: ${swap.source_amount}`);
    console.log(`- Expected amount in DB: ${swap.expected_amount}`);
    console.log(`- If these should be 9 tokens with 18 decimals:`);
    console.log(`  - Should be: 9000000000000000000 (9e18)`);
    console.log(`  - Actually is: ${swap.expected_amount}`);
    
    if (!swap.preimage_hash) {
      console.log('\n❌ PROBLEM: No preimage stored in database!');
      console.log('This is why the resolver cannot claim the HTLC.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwap();