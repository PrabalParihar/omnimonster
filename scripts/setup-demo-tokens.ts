import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';

async function setupDemoTokens() {
  console.log('Setting up demo tokens...');
  
  try {
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Add Sepolia MONSTER token
    await dao.query(`
      INSERT INTO supported_tokens (token_address, symbol, name, decimals, chain_id, min_swap_amount, max_swap_amount, fee_percentage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (token_address) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        decimals = EXCLUDED.decimals,
        chain_id = EXCLUDED.chain_id,
        min_swap_amount = EXCLUDED.min_swap_amount,
        max_swap_amount = EXCLUDED.max_swap_amount,
        fee_percentage = EXCLUDED.fee_percentage,
        updated_at = NOW()
    `, [
      'sepolia:MONSTER',
      'MONSTER',
      'Monster Token',
      18,
      11155111, // Sepolia chain ID
      '1000000000000000000', // 1 token minimum
      '1000000000000000000000', // 1000 tokens maximum
      0.003 // 0.3% fee
    ]);

    // Add Monad Testnet OMNI token
    await dao.query(`
      INSERT INTO supported_tokens (token_address, symbol, name, decimals, chain_id, min_swap_amount, max_swap_amount, fee_percentage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (token_address) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        decimals = EXCLUDED.decimals,
        chain_id = EXCLUDED.chain_id,
        min_swap_amount = EXCLUDED.min_swap_amount,
        max_swap_amount = EXCLUDED.max_swap_amount,
        fee_percentage = EXCLUDED.fee_percentage,
        updated_at = NOW()
    `, [
      'monadTestnet:OMNI',
      'OMNI',
      'Omni Token',
      18,
      41454, // Monad testnet chain ID
      '1000000000000000000', // 1 token minimum
      '1000000000000000000000', // 1000 tokens maximum
      0.003 // 0.3% fee
    ]);

    // Add liquidity for MONSTER token
    await dao.query(`
      INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (token_address) DO UPDATE SET
        total_balance = EXCLUDED.total_balance,
        available_balance = EXCLUDED.available_balance,
        reserved_balance = EXCLUDED.reserved_balance,
        min_threshold = EXCLUDED.min_threshold,
        updated_at = NOW()
    `, [
      'sepolia:MONSTER',
      '100000000000000000000000', // 100,000 tokens total
      '100000000000000000000000', // 100,000 tokens available
      '0', // 0 reserved
      '1000000000000000000000' // 1,000 tokens minimum threshold
    ]);

    // Add liquidity for OMNI token
    await dao.query(`
      INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (token_address) DO UPDATE SET
        total_balance = EXCLUDED.total_balance,
        available_balance = EXCLUDED.available_balance,
        reserved_balance = EXCLUDED.reserved_balance,
        min_threshold = EXCLUDED.min_threshold,
        updated_at = NOW()
    `, [
      'monadTestnet:OMNI',
      '100000000000000000000000', // 100,000 tokens total
      '100000000000000000000000', // 100,000 tokens available
      '0', // 0 reserved
      '1000000000000000000000' // 1,000 tokens minimum threshold
    ]);

    console.log('✅ Demo tokens and liquidity setup completed');
    
    // Verify setup
    const tokens = await dao.query('SELECT * FROM supported_tokens WHERE token_address LIKE \'%MONSTER%\' OR token_address LIKE \'%OMNI%\'');
    const liquidity = await dao.query('SELECT * FROM pool_liquidity WHERE token_address LIKE \'%MONSTER%\' OR token_address LIKE \'%OMNI%\'');
    
    console.log('Supported tokens:', tokens.rows);
    console.log('Pool liquidity:', liquidity.rows);
    
  } catch (error) {
    console.error('Error setting up demo tokens:', error);
  }
}

setupDemoTokens().catch(console.error);