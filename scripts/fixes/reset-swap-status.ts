import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function resetSwapStatus() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔧 Resetting swap status...\n');
    
    const swapId = '2b4832d7-2dab-4590-9fdc-66104d23d231';
    
    // Reset swap to PENDING
    await db.query(`
      UPDATE swap_requests 
      SET status = 'PENDING', 
          updated_at = NOW()
      WHERE id = $1
    `, [swapId]);
    
    console.log(`✅ Reset swap ${swapId} to PENDING`);
    
    // Clear failed resolver operations
    await db.query(`
      DELETE FROM resolver_operations 
      WHERE swap_request_id = $1 
      AND status = 'FAILED'
    `, [swapId]);
    
    console.log('✅ Cleared failed resolver operations');
    
    // Verify
    const swap = await db.query(
      'SELECT id, status, user_htlc_contract FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (swap.rows.length > 0) {
      console.log('\n📋 Swap status:');
      console.log(`- ID: ${swap.rows[0].id}`);
      console.log(`- Status: ${swap.rows[0].status}`);
      console.log(`- HTLC: ${swap.rows[0].user_htlc_contract}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

resetSwapStatus();