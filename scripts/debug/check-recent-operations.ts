import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkRecentOperations() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    const swapId = '34fa8eb7-35bb-4a5d-bc45-4d2b1c1ef692';
    
    // Get recent operations
    const result = await db.query(`
      SELECT operation_type, status, error_message, started_at, completed_at
      FROM resolver_operations
      WHERE swap_request_id = $1
      AND started_at > NOW() - INTERVAL '5 minutes'
      ORDER BY started_at DESC
      LIMIT 10
    `, [swapId]);
    
    console.log(`📊 Recent operations (last 5 minutes): ${result.rows.length}`);
    
    result.rows.forEach(op => {
      console.log(`\n- ${new Date(op.started_at).toLocaleTimeString()} - ${op.operation_type}: ${op.status}`);
      if (op.error_message) {
        console.log(`  Error: ${op.error_message}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkRecentOperations();