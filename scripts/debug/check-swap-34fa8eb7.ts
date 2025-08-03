import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    const swapId = '34fa8eb7-35bb-4a5d-bc45-4d2b1c1ef692';
    
    // Get swap details
    const result = await db.query(`
      SELECT id, status, user_htlc_contract, source_token, target_token, created_at, updated_at
      FROM swap_requests
      WHERE id = $1
    `, [swapId]);
    
    if (result.rows.length > 0) {
      const swap = result.rows[0];
      console.log('📋 Swap Details:');
      console.log(`- ID: ${swap.id}`);
      console.log(`- Status: ${swap.status}`);
      console.log(`- Contract ID: ${swap.user_htlc_contract}`);
      console.log(`- Tokens: ${swap.source_token} -> ${swap.target_token}`);
      console.log(`- Created: ${new Date(swap.created_at).toLocaleString()}`);
      console.log(`- Updated: ${new Date(swap.updated_at).toLocaleString()}`);
    } else {
      console.log('❌ Swap not found');
    }
    
    // Check pending swaps
    const pending = await db.query(`
      SELECT COUNT(*) as count FROM swap_requests WHERE status = 'PENDING'
    `);
    
    console.log(`\n📊 Total pending swaps: ${pending.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwap();