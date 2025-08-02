#!/usr/bin/env node

console.log('🔍 DEBUGGING SWAP FLOW...\n');

// Check if we can query the database directly
async function checkDatabase() {
  try {
    console.log('📋 Checking database for recent swaps...');
    
    const response = await fetch('http://localhost:3000/api/swaps/swap_1754166888192_tp1whvrrr');
    
    if (response.ok) {
      const swap = await response.json();
      console.log('✅ Found swap in database:');
      console.log('   ID:', swap.id);
      console.log('   Status:', swap.status);
      console.log('   User Address:', swap.userAddress);
      console.log('   Hash Lock:', swap.hashLock);
      console.log('   User HTLC Contract:', swap.userHtlcContract);
      console.log('   Source Token:', swap.sourceToken);
      console.log('   Target Token:', swap.targetToken);
      
      if (!swap.userHtlcContract) {
        console.log('❌ ISSUE: userHtlcContract is missing - database update failed!');
      } else {
        console.log('✅ userHtlcContract is present in database');
      }
    } else {
      console.log('❌ Failed to get swap from database:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

// Check resolver status
async function checkResolver() {
  try {
    console.log('\n🤖 Checking resolver status...');
    
    const response = await fetch('http://localhost:3000/api/fusion/resolver/status');
    
    if (response.ok) {
      const status = await response.json();
      console.log('✅ Resolver status:');
      console.log('   Processing:', status.processing);
      console.log('   Queue Size:', status.queueSize);
      console.log('   Last Processed:', status.lastProcessedAt);
      console.log('   Success Rate:', status.metrics.successRate + '%');
      
      if (status.queueSize === 0) {
        console.log('⚠️  No swaps in queue - resolver might have already processed or swaps not being added to queue');
      }
    } else {
      console.log('❌ Failed to get resolver status:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Resolver check failed:', error.message);
  }
}

// Test creating a swap to see if our fix works
async function testSwapCreation() {
  try {
    console.log('\n🧪 Testing new swap creation...');
    
    const testSwap = {
      fromChain: 'sepolia',
      fromToken: 'MONSTER',
      toChain: 'monadTestnet',
      toToken: 'OMNI',
      amount: '10',
      beneficiary: '0x2BCc053BB6915F28aC2041855D2292dDca406903',
      timelock: 3600,
      slippage: 1,
      dryRun: true // Use dry run for testing
    };
    
    const response = await fetch('http://localhost:3000/api/swaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSwap)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test swap created with UUID:', result.id);
      
      // Check if it appears in the database
      setTimeout(async () => {
        const checkResponse = await fetch(`http://localhost:3000/api/swaps/${result.id}`);
        if (checkResponse.ok) {
          const swap = await checkResponse.json();
          console.log('✅ Test swap found in database');
          if (swap.userHtlcContract) {
            console.log('✅ userHtlcContract would be populated (dry run mode)');
          }
        }
      }, 2000);
      
    } else {
      console.log('❌ Failed to create test swap:', response.status);
    }
  } catch (error) {
    console.error('❌ Test swap creation failed:', error.message);
  }
}

// Run diagnostics
async function main() {
  await checkDatabase();
  await checkResolver();
  await testSwapCreation();
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. If userHtlcContract is missing → Database update failed');
  console.log('2. If userHtlcContract exists but queue is empty → Resolver processed but failed validation');
  console.log('3. If resolver is not running → Start resolver with: cd services/resolver && npm run dev');
  console.log('4. The fix ensures blockchain service uses the correct database UUID instead of generating new IDs');
}

main().catch(console.error);