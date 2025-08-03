#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '10105da8-098c-44ac-aca6-54c576f5081e';
  
  try {
    console.log(`🔍 Checking swap ${swapId}\n`);
    
    // Get swap from database
    const result = await db.query(
      'SELECT * FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found in database');
      return;
    }
    
    const swap = result.rows[0];
    console.log('📋 Database Swap Details:');
    console.log('- Status:', swap.status);
    console.log('- User HTLC:', swap.user_htlc_contract);
    console.log('- Pool HTLC:', swap.pool_htlc_contract || '(not created)');
    console.log('- Preimage:', swap.preimage_hash || '(missing)');
    console.log('- Hash lock:', swap.hash_lock);
    console.log('- Source:', swap.source_token);
    console.log('- Target:', swap.target_token);
    console.log('- Expected amount:', swap.expected_amount);
    console.log('- Created:', new Date(swap.created_at).toLocaleString());
    
    // Check if user HTLC exists on chain
    if (swap.user_htlc_contract) {
      console.log('\n🔗 Checking User HTLC on Sepolia...');
      const sepoliaProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
      const htlcAddress = '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7';
      
      const htlcABI = [
        'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
      ];
      
      const htlc = new ethers.Contract(htlcAddress, htlcABI, sepoliaProvider);
      
      try {
        const details = await htlc.getDetails(swap.user_htlc_contract);
        console.log('✅ User HTLC found on chain');
        console.log('- State:', details.state.toString());
        console.log('- Amount:', ethers.formatUnits(details.value, 18), 'MONSTER');
        console.log('- Beneficiary (Pool):', details.beneficiary);
        console.log('- Hash lock:', details.hashLock);
        
        if (details.state.toString() === '1') {
          console.log('✅ User HTLC is OPEN and ready for pool to claim');
        }
      } catch (error) {
        console.log('❌ Error checking user HTLC:', error.message);
      }
    }
    
    console.log('\n🔧 Next Steps:');
    if (!swap.pool_htlc_contract) {
      console.log('1. Pool needs to claim the user HTLC and create their HTLC');
      console.log('2. The resolver should handle this automatically');
      console.log('3. If not, we can manually trigger it');
    } else if (!swap.preimage_hash) {
      console.log('1. The preimage is missing - this swap cannot be completed');
      console.log('2. User needs to create a new swap');
    } else if (swap.status === 'POOL_FULFILLED') {
      console.log('1. Swap is ready for claiming');
      console.log('2. Use the direct claim API or gasless claim');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwap();