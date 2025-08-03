import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function updateSwapToPending() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '182d3f37-e9ae-46e8-b504-4b3aa025fd8c';
  
  try {
    console.log('🔄 Updating swap to PENDING status...');
    
    const result = await db.query(
      "UPDATE swap_requests SET status = 'PENDING', updated_at = NOW() WHERE id = $1 RETURNING *",
      [swapId]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Swap updated successfully!');
      console.log('- Status:', result.rows[0].status);
      console.log('- Updated at:', new Date(result.rows[0].updated_at).toLocaleString());
    } else {
      console.log('❌ Swap not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

updateSwapToPending();