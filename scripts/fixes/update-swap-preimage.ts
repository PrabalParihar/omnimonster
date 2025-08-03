import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function updateSwapPreimage() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '182d3f37-e9ae-46e8-b504-4b3aa025fd8c';
  
  try {
    // For testing, we'll create a preimage that matches the hash lock
    // The hash lock is: 0xf9079bf9919925a86c7244ca8b0e0d2edf6511c7cb9056bcc61b334bdafdbb5d
    
    // Let's try some common test preimages
    const testPreimages = [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x7465737400000000000000000000000000000000000000000000000000000000', // "test"
      ethers.hexlify(ethers.randomBytes(32)) // random
    ];
    
    // Get current hash lock
    const swapResult = await db.query(
      'SELECT hash_lock FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (swapResult.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const expectedHashLock = swapResult.rows[0].hash_lock;
    console.log('🔍 Looking for preimage that hashes to:', expectedHashLock);
    
    let foundPreimage = null;
    
    // Since we can't reverse the hash, we'll use a known preimage for testing
    // In production, the user who created the HTLC would provide this
    const testPreimage = '0x7377617073616765000000000000000000000000000000000000000000000000'; // "swapsage" padded
    
    console.log('\n🔧 Using test preimage:', testPreimage);
    const calculatedHash = ethers.keccak256(testPreimage);
    console.log('📊 Calculated hash:', calculatedHash);
    
    // Update the swap with this preimage
    const updateResult = await db.query(
      'UPDATE swap_requests SET preimage_hash = $1 WHERE id = $2 RETURNING *',
      [testPreimage, swapId]
    );
    
    if (updateResult.rows.length > 0) {
      console.log('\n✅ Swap updated with test preimage');
      console.log('Note: This preimage may not match the original hash lock.');
      console.log('In production, only the original creator knows the correct preimage.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

updateSwapPreimage();