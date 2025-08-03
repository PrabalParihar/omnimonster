// Using native fetch in Node.js 18+

const API_URL = 'http://localhost:3000/api';
const SWAP_ID = 'a4d64de2-053b-437a-b869-3ccf1d16f583';

async function verifySwapInDatabase() {
  console.log('🔍 Verifying Swap in Database\n');
  
  try {
    // 1. Get swap details
    console.log('📋 1. Fetching Swap Details:');
    console.log('='.repeat(50));
    
    const swapResponse = await fetch(`${API_URL}/swaps/${SWAP_ID}`);
    const swapData = await swapResponse.json();
    
    console.log('Swap ID:', swapData.id);
    console.log('Status:', swapData.status);
    console.log('Created:', new Date(swapData.createdAt).toISOString());
    console.log('Updated:', new Date(swapData.updatedAt).toISOString());
    console.log('Source Token:', swapData.sourceToken);
    console.log('Target Token:', swapData.targetToken);
    console.log('Source Amount:', swapData.sourceAmount);
    console.log('Expected Amount:', swapData.expectedAmount);
    console.log('User Address:', swapData.userAddress);
    console.log('Hash Lock:', swapData.hashLock);
    console.log('Preimage Hash:', swapData.preimageHash);
    
    // 2. Get all swaps for the user
    console.log('\n📋 2. All User Swaps:');
    console.log('='.repeat(50));
    
    const allSwapsResponse = await fetch(`${API_URL}/swaps?userAddress=${swapData.userAddress}`);
    const allSwapsData = await allSwapsResponse.json();
    const allSwaps = Array.isArray(allSwapsData) ? allSwapsData : allSwapsData.swaps || [];
    
    console.log(`Found ${allSwaps.length} swaps for user`);
    allSwaps.forEach((swap: any, index: number) => {
      console.log(`\nSwap ${index + 1}:`);
      console.log('  ID:', swap.id);
      console.log('  Status:', swap.status);
      console.log('  Amount:', swap.sourceAmount);
      console.log('  Created:', new Date(swap.createdAt).toISOString());
    });
    
    // 3. Test gasless claim endpoint
    console.log('\n📋 3. Testing Gasless Claim Availability:');
    console.log('='.repeat(50));
    
    const claimData = {
      swapRequestId: SWAP_ID,
      claimerAddress: swapData.userAddress,
      htlcContract: '0x7185D90BCD120dE7d091DF6EA8bd26e912571b61',
      contractId: '0xc71bbdf4a70f83a031e1509e616102a8e3f78f8fd25b75d386d93f9d8fe986aa',
      preimage: '0xd17508c79a4db59401fbe90ca82857c7e7385f1c6aa7c9ef88db601c35291868',
      signature: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };
    
    const claimResponse = await fetch(`${API_URL}/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(claimData)
    });
    
    if (claimResponse.ok) {
      const claimResult = await claimResponse.json();
      console.log('✅ Gasless claim created:', claimResult.id);
      console.log('Status:', claimResult.status);
    } else {
      console.log('❌ Gasless claim failed:', claimResponse.status, claimResponse.statusText);
    }
    
    // 4. Update swap status
    console.log('\n📋 4. Updating Swap Status:');
    console.log('='.repeat(50));
    
    const updateData = {
      status: 'USER_CLAIMED',
      userHtlcContract: '0x20371f07a80f99127e2cbbdc46d35cb28b426fdaf137f1aa9c0adb201bf90ee5',
      poolHtlcContract: '0xc71bbdf4a70f83a031e1509e616102a8e3f78f8fd25b75d386d93f9d8fe986aa'
    };
    
    const updateResponse = await fetch(`${API_URL}/swaps/${SWAP_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (updateResponse.ok) {
      console.log('✅ Swap status updated successfully');
      
      // Fetch updated swap
      const updatedSwapResponse = await fetch(`${API_URL}/swaps/${SWAP_ID}`);
      const updatedSwap = await updatedSwapResponse.json();
      console.log('New Status:', updatedSwap.status);
      console.log('User HTLC:', updatedSwap.userHtlcContract);
      console.log('Pool HTLC:', updatedSwap.poolHtlcContract);
    } else {
      console.log('❌ Status update failed:', updateResponse.status);
    }
    
    // 5. Check system metrics
    console.log('\n📋 5. System Metrics:');
    console.log('='.repeat(50));
    
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    
    console.log('Overall Health:', health.overall);
    console.log('Database:', health.components.find((c: any) => c.component === 'Database')?.status);
    console.log('API Status:', health.components.find((c: any) => c.component === 'API Endpoints')?.status);
    
    console.log('\n✅ Database Verification Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run verification
verifySwapInDatabase().catch(console.error);