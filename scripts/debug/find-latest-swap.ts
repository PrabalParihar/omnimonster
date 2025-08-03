import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function findLatestSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔍 Finding latest swap with HTLC...\n');
    
    // Find swaps created in the last hour
    const recentSwaps = await db.query(`
      SELECT 
        id,
        status,
        source_token,
        target_token,
        source_amount,
        user_htlc_contract,
        hash_lock,
        created_at,
        updated_at
      FROM swap_requests
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${recentSwaps.rows.length} recent swaps:\n`);
    
    recentSwaps.rows.forEach(swap => {
      console.log(`📋 Swap ${swap.id}:`);
      console.log(`   Status: ${swap.status}`);
      console.log(`   Created: ${new Date(swap.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(swap.updated_at).toLocaleString()}`);
      console.log(`   Amount: ${swap.source_amount} ${swap.source_token}`);
      console.log(`   HTLC Contract ID: ${swap.user_htlc_contract || 'NOT SET'}`);
      console.log(`   Hash Lock: ${swap.hash_lock || 'NOT SET'}`);
      console.log('');
    });
    
    // Check if any swap has the contract ID we're looking for
    const targetContractId = '0x0e95f9320dacd40ca1fe008c804bf2239e4a23d1d54ab2b8c4c6fe0e0ef3f355';
    const matchingSwap = recentSwaps.rows.find(s => s.user_htlc_contract === targetContractId);
    
    if (matchingSwap) {
      console.log(`✅ Found swap with contract ID ${targetContractId}!`);
      console.log(`   Swap ID: ${matchingSwap.id}`);
    } else {
      console.log(`❌ No swap found with contract ID ${targetContractId}`);
      console.log('\nThis means the frontend might not be updating the swap with the HTLC contract ID after funding.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

findLatestSwap();