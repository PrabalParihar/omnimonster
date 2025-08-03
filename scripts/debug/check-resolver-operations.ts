import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkResolverOperations() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔍 Checking resolver operations for latest swap...\n');
    
    const swapId = '2b4832d7-2dab-4590-9fdc-66104d23d231';
    
    // Get swap details
    const swap = await db.query(
      'SELECT * FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (swap.rows.length > 0) {
      const s = swap.rows[0];
      console.log(`📋 Swap ${s.id}:`);
      console.log(`   Status: ${s.status}`);
      console.log(`   HTLC: ${s.user_htlc_contract}`);
      console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(s.updated_at).toLocaleString()}`);
    }
    
    // Get resolver operations
    const operations = await db.query(`
      SELECT * FROM resolver_operations 
      WHERE swap_request_id = $1 
      ORDER BY started_at DESC
    `, [swapId]);
    
    console.log(`\n🔧 Found ${operations.rows.length} resolver operations:`);
    
    operations.rows.forEach(op => {
      console.log(`\n- Operation ${op.id}:`);
      console.log(`  Type: ${op.operation_type}`);
      console.log(`  Status: ${op.status}`);
      console.log(`  Started: ${new Date(op.started_at).toLocaleString()}`);
      if (op.completed_at) {
        console.log(`  Completed: ${new Date(op.completed_at).toLocaleString()}`);
      }
      if (op.error_message) {
        console.log(`  Error: ${op.error_message}`);
      }
      if (op.metadata) {
        console.log(`  Metadata:`, JSON.stringify(op.metadata, null, 2));
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkResolverOperations();