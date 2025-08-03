import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function checkSwapPreimage() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '182d3f37-e9ae-46e8-b504-4b3aa025fd8c';
  
  try {
    const result = await db.query(
      'SELECT hash_lock, preimage_hash FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const swap = result.rows[0];
    console.log('📋 Swap preimage data:');
    console.log('- Hash lock:', swap.hash_lock);
    console.log('- Preimage hash:', swap.preimage_hash);
    
    // The preimage should hash to the hash lock
    if (swap.preimage_hash) {
      const calculatedHash = ethers.keccak256(swap.preimage_hash);
      console.log('\n🔐 Verification:');
      console.log('- Calculated hash from preimage:', calculatedHash);
      console.log('- Matches hash lock?', calculatedHash === swap.hash_lock);
    } else {
      console.log('\n❌ No preimage stored!');
      
      // For demo, let's create a preimage that hashes to the hash lock
      // In production, only the user who created the HTLC knows the preimage
      console.log('\n🔧 For testing, we need the actual preimage that hashes to:', swap.hash_lock);
      console.log('In a real swap, only the user who created the HTLC knows this preimage.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkSwapPreimage();