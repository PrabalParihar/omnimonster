#!/usr/bin/env tsx

import { ethers } from 'ethers';

async function executeClaimWithKey() {
  const swapId = '10105da8-098c-44ac-aca6-54c576f5081e';
  const contractId = '0x76a70eb4cad65a0236a6abf42895a7c72697bebabe3b9232a5ff69ed822b737a';
  const preimage = '0xa208fc0db8d79cc45c2bd7c5f423cf71bd11c5b882b77c985339efb1feec4bf0';
  const privateKey = '0xe736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
  
  console.log('🚀 Executing Claim with Provided Key\n');
  
  try {
    // First check if this key matches the beneficiary
    const wallet = new ethers.Wallet(privateKey);
    console.log('Wallet address from private key:', wallet.address);
    
    // Call the direct claim API
    console.log('\n📡 Calling direct claim API...');
    const response = await fetch('http://localhost:3000/api/fusion/claims/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swapId: swapId,
        contractId: contractId,
        preimage: preimage,
        privateKey: privateKey
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('\n✅ Claim successful!');
      console.log('Transaction hash:', result.txHash);
      console.log('Block number:', result.blockNumber);
      console.log('Gas used:', result.gasUsed);
      console.log('Message:', result.message);
      
      console.log('\n🎉 You have successfully claimed your OMNIMONSTER tokens!');
      console.log('Check your wallet on Monad Testnet');
    } else {
      console.log('\n❌ Claim failed:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.error?.includes('Wrong wallet')) {
        console.log('\n💡 The private key does not match the beneficiary wallet');
        console.log('Expected beneficiary: 0x2BCc053BB6915F28aC2041855D2292dDca406903');
        console.log('Your wallet:', wallet.address);
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

executeClaimWithKey();