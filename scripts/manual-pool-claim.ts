#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import { Client } from 'pg';

const FUSION_HTLC_ABI = [
  'function claim(bytes32 contractId, bytes32 preimage) external',
  'function contracts(bytes32) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

async function manualPoolClaim() {
  // Swap details
  const swapId = '7b3b3903-09c7-4d93-9410-9a5bebc98790';
  const userHtlcId = '0xe8b22dd759652a42db4fc7bac5dd210c5285c988202d5b88287ce685a68e7390';
  const preimage = '0x68d976a8a6b4b40f59aa878f756c4824b10a3bb41bda67102e1fdf4d94383c68';
  
  // Monad chain config
  const monadProvider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  const poolWallet = new ethers.Wallet('e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647', monadProvider);
  const monadHtlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
  
  console.log('Manual Pool Claim for Swap:', swapId);
  console.log('Pool wallet:', poolWallet.address);
  console.log('');
  
  try {
    // Check HTLC state on Monad
    const htlcContract = new ethers.Contract(monadHtlcAddress, FUSION_HTLC_ABI, monadProvider);
    
    console.log('Checking user HTLC state on Monad...');
    let details;
    try {
      details = await htlcContract.contracts(userHtlcId);
    } catch (e) {
      details = await htlcContract.getDetails(userHtlcId);
    }
    
    console.log('User HTLC Details:');
    console.log('- Token:', details.token);
    console.log('- Beneficiary:', details.beneficiary);
    console.log('- Originator:', details.originator);
    console.log('- Value:', ethers.formatUnits(details.value, 18), 'OMNIMONSTER');
    console.log('- State:', details.state.toString());
    console.log('');
    
    if (details.state === 1n) {
      console.log('HTLC is FUNDED, proceeding with claim...');
      
      // Estimate gas
      const gasEstimate = await htlcContract.claim.estimateGas(userHtlcId, preimage, {
        from: poolWallet.address
      });
      console.log('Estimated gas:', gasEstimate.toString());
      
      // Get current gas price
      const feeData = await monadProvider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('62.4', 'gwei');
      console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
      
      // Execute claim
      console.log('\\nExecuting claim transaction...');
      const tx = await htlcContract.connect(poolWallet).claim(userHtlcId, preimage, {
        gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        gasPrice: gasPrice
      });
      
      console.log('Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('\\n✅ Claim successful!');
      console.log('Block:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());
      
      // Update database
      const DATABASE_URL = 'postgresql://neondb_owner:npg_Fb4WALuywlr8@ep-crimson-mud-a10e1015-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
      const client = new Client({ connectionString: DATABASE_URL });
      await client.connect();
      
      await client.query(
        `UPDATE swap_requests 
         SET pool_claimed_at = NOW(), status = 'USER_CLAIMED' 
         WHERE id = $1`,
        [swapId]
      );
      
      await client.end();
      console.log('\\n✅ Database updated!');
      console.log('\\nYou can now claim from the pool HTLC on Sepolia!');
      
    } else if (details.state === 2n) {
      console.log('HTLC already CLAIMED!');
    } else if (details.state === 3n) {
      console.log('HTLC is REFUNDED!');
    } else {
      console.log('HTLC is in INVALID state:', details.state);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

manualPoolClaim();