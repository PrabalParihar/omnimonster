import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function addPoolLiquidity() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('💧 Adding pool liquidity for demo tokens...\n');
    
    // Demo tokens
    const tokens = [
      {
        token_address: 'sepolia:MONSTER',
        chain_id: 11155111,
        total_balance: '1000000000000000000000', // 1000 tokens
        available_balance: '1000000000000000000000',
        reserved_balance: '0',
        min_threshold: '10000000000000000000' // 10 tokens minimum
      },
      {
        token_address: 'monadTestnet:OMNIMONSTER',
        chain_id: 10143,
        total_balance: '1000000000000000000000', // 1000 tokens
        available_balance: '1000000000000000000000',
        reserved_balance: '0',
        min_threshold: '10000000000000000000' // 10 tokens minimum
      },
      {
        token_address: 'monadTestnet:OMNI',
        chain_id: 10143,
        total_balance: '1000000000000000000000', // 1000 tokens
        available_balance: '1000000000000000000000',
        reserved_balance: '0',
        min_threshold: '10000000000000000000' // 10 tokens minimum
      }
    ];
    
    for (const token of tokens) {
      // Check if liquidity already exists
      const existing = await db.query(
        'SELECT * FROM pool_liquidity WHERE token_address = $1',
        [token.token_address]
      );
      
      if (existing.rows.length > 0) {
        // Update existing
        await db.query(`
          UPDATE pool_liquidity 
          SET total_balance = $2, available_balance = $3, reserved_balance = $4, min_threshold = $5, updated_at = NOW()
          WHERE token_address = $1
        `, [token.token_address, token.total_balance, token.available_balance, token.reserved_balance, token.min_threshold]);
        console.log(`✅ Updated liquidity for ${token.token_address}`);
      } else {
        // Insert new
        await db.query(`
          INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold)
          VALUES ($1, $2, $3, $4, $5)
        `, [token.token_address, token.total_balance, token.available_balance, token.reserved_balance, token.min_threshold]);
        console.log(`✅ Added liquidity for ${token.token_address}`);
      }
    }
    
    // Show current liquidity
    const liquidity = await db.query('SELECT * FROM pool_liquidity');
    console.log('\n📊 Current Pool Liquidity:');
    liquidity.rows.forEach(row => {
      const available = parseFloat(row.available_balance) / 1e18;
      const total = parseFloat(row.total_balance) / 1e18;
      console.log(`- ${row.token_address}: ${available}/${total} tokens available`);
    });
    
    console.log('\n✅ Pool liquidity setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

addPoolLiquidity();