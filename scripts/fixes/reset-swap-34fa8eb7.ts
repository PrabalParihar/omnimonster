import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function resetSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    const swapId = '34fa8eb7-35bb-4a5d-bc45-4d2b1c1ef692';
    
    // Reset swap to PENDING
    await db.query(`
      UPDATE swap_requests 
      SET status = 'PENDING', 
          updated_at = NOW()
      WHERE id = $1
    `, [swapId]);
    
    console.log(`✅ Reset swap ${swapId} to PENDING`);
    
    // Clear failed operations
    await db.query(`
      DELETE FROM resolver_operations 
      WHERE swap_request_id = $1 
      AND status = 'FAILED'
    `, [swapId]);
    
    console.log('✅ Cleared failed resolver operations');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

resetSwap();