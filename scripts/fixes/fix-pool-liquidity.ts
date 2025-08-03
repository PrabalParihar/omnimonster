import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function fixPoolLiquidity() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔧 Fixing pool liquidity...\n');
    
    // Fix negative balance
    await db.query(`
      UPDATE pool_liquidity 
      SET available_balance = total_balance, 
          reserved_balance = '0',
          updated_at = NOW()
      WHERE token_address = 'monadTestnet:OMNIMONSTER'
    `);
    
    console.log('✅ Fixed pool liquidity balance');
    
    // Show updated liquidity
    const result = await db.query(
      'SELECT * FROM pool_liquidity WHERE token_address = $1',
      ['monadTestnet:OMNIMONSTER']
    );
    
    if (result.rows.length > 0) {
      const liquidity = result.rows[0];
      console.log('\n📊 Updated liquidity:');
      console.log(`- Total: ${parseFloat(liquidity.total_balance) / 1e18} tokens`);
      console.log(`- Available: ${parseFloat(liquidity.available_balance) / 1e18} tokens`);
      console.log(`- Reserved: ${parseFloat(liquidity.reserved_balance) / 1e18} tokens`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

fixPoolLiquidity();