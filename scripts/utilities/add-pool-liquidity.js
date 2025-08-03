#!/usr/bin/env node

console.log('💧 Adding Pool Liquidity...\n');

// Add pool liquidity directly to the database
async function addPoolLiquidity() {
  try {
    // First, add supported tokens
    console.log('1️⃣ Adding supported tokens...');
    
    const addTokenResponse = await fetch('http://localhost:3000/api/fusion/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_address: 'monadTestnet:OMNI',
        symbol: 'OMNI',
        name: 'Omni Token',
        decimals: 18,
        chain_id: 10143,
        min_swap_amount: '1000000000000000000', // 1 token
        max_swap_amount: '1000000000000000000000', // 1000 tokens
        fee_percentage: 0.3,
        is_active: true
      })
    });
    
    if (addTokenResponse.ok) {
      console.log('✅ OMNI token added to supported tokens');
    } else {
      const error = await addTokenResponse.text();
      console.log('⚠️  Token might already exist:', error);
    }
    
    // Add another token that might be needed
    const addMonsterResponse = await fetch('http://localhost:3000/api/fusion/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_address: 'sepolia:MONSTER',
        symbol: 'MONSTER',
        name: 'Monster Token',
        decimals: 18,
        chain_id: 11155111,
        min_swap_amount: '1000000000000000000', // 1 token
        max_swap_amount: '1000000000000000000000', // 1000 tokens
        fee_percentage: 0.3,
        is_active: true
      })
    });
    
    if (addMonsterResponse.ok) {
      console.log('✅ MONSTER token added to supported tokens');
    } else {
      const error = await addMonsterResponse.text();
      console.log('⚠️  MONSTER token might already exist:', error);
    }
    
    console.log('\n2️⃣ Adding pool liquidity...');
    
    // Try to add pool liquidity via API (if endpoint exists)
    // For now, let's show the manual SQL that would be needed
    
    console.log('📝 Manual SQL to add pool liquidity:');
    console.log('');
    console.log(`-- Add liquidity for OMNI token`);
    console.log(`INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold, created_at, updated_at)
VALUES ('monadTestnet:OMNI', '1000000000000000000000', '1000000000000000000000', '0', '10000000000000000000', NOW(), NOW())
ON CONFLICT (token_address) DO UPDATE SET
  total_balance = EXCLUDED.total_balance,
  available_balance = EXCLUDED.available_balance,
  updated_at = NOW();`);
    
    console.log('');
    console.log(`-- Add liquidity for MONSTER token`);
    console.log(`INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold, created_at, updated_at)
VALUES ('sepolia:MONSTER', '1000000000000000000000', '1000000000000000000000', '0', '10000000000000000000', NOW(), NOW())
ON CONFLICT (token_address) DO UPDATE SET
  total_balance = EXCLUDED.total_balance,
  available_balance = EXCLUDED.available_balance,
  updated_at = NOW();`);
    
    console.log('\n💡 Run these SQL commands in your database to add liquidity!');
    console.log('📊 After adding liquidity, create a new swap to test the resolver.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test current liquidity
async function checkCurrentLiquidity() {
  try {
    console.log('🔍 Checking current pool liquidity...');
    
    const response = await fetch('http://localhost:3000/api/fusion/pool/liquidity');
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Pool Liquidity Summary:');
      console.log(`   Total Tokens: ${data.summary.totalTokens}`);
      console.log(`   Total Liquidity: ${data.summary.totalLiquidity}`);
      
      if (data.tokens.length > 0) {
        console.log('🪙 Available Tokens:');
        data.tokens.forEach(token => {
          console.log(`   ${token.symbol}: ${token.availableBalance} (${token.healthStatus})`);
        });
      } else {
        console.log('❌ No liquidity found - need to add some!');
      }
    } else {
      console.log('❌ Failed to fetch liquidity data');
    }
  } catch (error) {
    console.log('❌ Error checking liquidity:', error.message);
  }
}

// Main function
async function main() {
  await checkCurrentLiquidity();
  await addPoolLiquidity();
}

main().catch(console.error);