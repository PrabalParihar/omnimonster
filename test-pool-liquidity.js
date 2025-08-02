#!/usr/bin/env node

console.log('🧪 Testing Pool Liquidity Setup...\n');

// Test creating pool liquidity and a swap
async function testPoolLiquidity() {
  try {
    console.log('1️⃣ Creating pool liquidity for OMNI token...');
    
    // Add liquidity for the target token (monadTestnet:OMNI)
    const liquidityData = {
      token_address: 'monadTestnet:OMNI',
      total_balance: '1000000000000000000000', // 1000 tokens with 18 decimals
      available_balance: '1000000000000000000000', // 1000 tokens available
      reserved_balance: '0',
      min_threshold: '10000000000000000000' // 10 tokens minimum
    };
    
    // First, let's try to create the liquidity via direct database call
    // We'll need to create an API endpoint for this, or add it manually
    
    console.log('2️⃣ Creating a test swap...');
    
    const testSwap = {
      fromChain: 'sepolia',
      fromToken: 'MONSTER',
      toChain: 'monadTestnet',
      toToken: 'OMNI',
      amount: '5', // Small amount for testing
      beneficiary: '0x2BCc053BB6915F28aC2041855D2292dDca406903',
      timelock: 3600,
      slippage: 1,
      dryRun: false // Real swap
    };
    
    const response = await fetch('http://localhost:3000/api/swaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSwap)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test swap created:', result.id);
      
      // Wait a bit for it to process
      setTimeout(async () => {
        console.log('3️⃣ Checking swap status...');
        const checkResponse = await fetch(`http://localhost:3000/api/swaps/${result.id}`);
        if (checkResponse.ok) {
          const swap = await checkResponse.json();
          console.log('📊 Swap status:', swap.status);
          console.log('💰 Has HTLC contract:', !!swap.userHtlcContract);
        }
      }, 5000);
      
    } else {
      console.log('❌ Failed to create test swap:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Also let's create a simple API call to add pool liquidity
async function addPoolLiquidity() {
  console.log('💧 Adding pool liquidity directly to database...');
  
  // For now, let's just show what would need to be added
  console.log('📝 Pool liquidity needed:');
  console.log('   Token: monadTestnet:OMNI');
  console.log('   Available: 1000 tokens');
  console.log('   This needs to be added to the pool_liquidity table');
  console.log('');
  console.log('💡 SQL to add liquidity:');
  console.log(`INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold)
VALUES ('monadTestnet:OMNI', '1000000000000000000000', '1000000000000000000000', '0', '10000000000000000000')
ON CONFLICT (token_address) DO UPDATE SET
  total_balance = EXCLUDED.total_balance,
  available_balance = EXCLUDED.available_balance,
  updated_at = NOW();`);
}

// Run tests
async function main() {
  await addPoolLiquidity();
  await testPoolLiquidity();
  
  console.log('\n🔍 Next: Check resolver logs to see if it processes the swap successfully!');
}

main().catch(console.error);