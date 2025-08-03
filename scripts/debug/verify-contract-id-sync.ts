import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function verifyContractIdSync() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  
  try {
    console.log('🔍 Verifying Contract ID Synchronization\n');
    
    // Get the most recent swap
    const swapResult = await db.query(`
      SELECT id, user_htlc_contract, hash_lock, created_at, status
      FROM swap_requests
      WHERE user_htlc_contract IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (swapResult.rows.length === 0) {
      console.log('❌ No swaps with HTLC contract IDs found');
      return;
    }
    
    const swap = swapResult.rows[0];
    console.log('📋 Latest swap with HTLC:');
    console.log(`- ID: ${swap.id}`);
    console.log(`- Status: ${swap.status}`);
    console.log(`- Contract ID: ${swap.user_htlc_contract}`);
    console.log(`- Hash Lock: ${swap.hash_lock}`);
    console.log(`- Created: ${new Date(swap.created_at).toLocaleString()}`);
    
    // Verify on blockchain
    const sepoliaConfig = evmChains.sepolia;
    const provider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrl);
    
    const htlcABI = [
      'function getDetails(bytes32) view returns (address,address,address,bytes32,uint256,uint256,uint8)'
    ];
    
    const htlcContract = new ethers.Contract(sepoliaConfig.htlcAddress, htlcABI, provider);
    
    console.log('\n🔗 Checking HTLC on Sepolia...');
    try {
      const details = await htlcContract.getDetails(swap.user_htlc_contract);
      console.log('✅ HTLC found on-chain!');
      console.log(`- State: ${details[6]} (0=INVALID, 1=PENDING, 2=CLAIMED, 3=REFUNDED)`);
      console.log(`- Hash Lock: ${details[3]}`);
      console.log(`- DB Hash Lock: ${swap.hash_lock}`);
      
      if (details[3] === swap.hash_lock) {
        console.log('✅ Hash locks match!');
      } else {
        console.log('❌ Hash lock mismatch!');
      }
      
      // Check resolver operations for this swap
      const operations = await db.query(`
        SELECT operation_type, status, error_message, started_at
        FROM resolver_operations
        WHERE swap_request_id = $1
        ORDER BY started_at DESC
        LIMIT 5
      `, [swap.id]);
      
      console.log(`\n🔧 Recent resolver operations (${operations.rows.length}):`);
      operations.rows.forEach(op => {
        console.log(`- ${op.operation_type}: ${op.status}`);
        if (op.error_message) {
          console.log(`  Error: ${op.error_message.substring(0, 100)}...`);
        }
      });
      
    } catch (error) {
      console.log('❌ HTLC not found on-chain or error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

verifyContractIdSync();