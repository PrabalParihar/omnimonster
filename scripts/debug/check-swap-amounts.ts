import * as dao from './packages/shared/src/database/dao';

async function checkSwapAmounts() {
  
  const swapId = 'd883e3a4-635d-4d67-92bd-440108a82587';
  console.log(`\n🔍 Checking swap ${swapId}...`);
  
  try {
    const swap = await dao.getSwapRequestById(swapId);
    if (!swap) {
      console.log('❌ Swap not found');
      return;
    }
    
    console.log('\n📋 Swap Details:');
    console.log(`   ID: ${swap.id}`);
    console.log(`   Status: ${swap.status}`);
    console.log(`   Source Token: ${swap.sourceToken}`);
    console.log(`   Source Amount: ${swap.sourceAmount}`);
    console.log(`   Target Token: ${swap.targetToken}`);
    console.log(`   Expected Amount: ${swap.expectedAmount}`);
    console.log(`   Hash Lock: ${swap.hashLock}`);
    console.log(`   Pool HTLC: ${swap.poolHtlcContract}`);
    
    console.log('\n💡 Analysis:');
    console.log(`   Source amount appears to be: ${swap.sourceAmount}`);
    console.log(`   Expected amount appears to be: ${swap.expectedAmount}`);
    console.log(`   If these are meant to be 9 tokens with 18 decimals:`);
    console.log(`   - Should be: 9000000000000000000 (9e18)`);
    console.log(`   - Actually is: ${swap.expectedAmount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkSwapAmounts();