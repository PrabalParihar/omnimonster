#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const HTLC_ABI = [
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

async function verifyHTLC() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  
  try {
    // Get swap details from database
    const result = await db.query(
      `SELECT * FROM swap_requests WHERE id = $1`,
      [swapId]
    );
    
    const swap = result.rows[0];
    console.log('📋 Swap Details:');
    console.log(`- Pool HTLC Contract: ${swap.pool_htlc_contract}`);
    console.log(`- User Address: ${swap.user_address}`);
    console.log(`- Preimage: ${swap.preimage_hash}`);
    
    // Connect to Monad testnet (destination chain)
    const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
    const htlcAddress = '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9';
    const htlc = new ethers.Contract(htlcAddress, HTLC_ABI, provider);
    
    console.log('\n🔍 Checking pool HTLC on Monad testnet...');
    console.log(`HTLC Contract: ${htlcAddress}`);
    console.log(`Contract ID: ${swap.pool_htlc_contract}`);
    
    try {
      const details = await htlc.getDetails(swap.pool_htlc_contract);
      console.log('\n✅ HTLC Details:');
      console.log(`- Token: ${details.token}`);
      console.log(`- Beneficiary: ${details.beneficiary}`);
      console.log(`- Originator: ${details.originator}`);
      console.log(`- Value: ${details.value} (${ethers.formatUnits(details.value, 18)} tokens)`);
      console.log(`- State: ${details.state} (0=INVALID, 1=OPEN, 2=CLAIMED, 3=REFUNDED)`);
      console.log(`- Timelock: ${new Date(Number(details.timelock) * 1000).toLocaleString()}`);
      
      console.log('\n💡 Analysis:');
      if (details.state.toString() === '0') {
        console.log('❌ HTLC shows as INVALID - this means the contract ID doesn\'t exist');
        console.log('   This could mean:');
        console.log('   1. Wrong contract ID');
        console.log('   2. Wrong HTLC contract address');
        console.log('   3. HTLC was never created');
      } else if (details.state.toString() === '1') {
        console.log('✅ HTLC is OPEN and can be claimed');
        console.log(`   Beneficiary should be: ${swap.user_address}`);
        console.log(`   Actual beneficiary is: ${details.beneficiary}`);
      }
      
    } catch (error) {
      console.error('❌ Error getting HTLC details:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

verifyHTLC();