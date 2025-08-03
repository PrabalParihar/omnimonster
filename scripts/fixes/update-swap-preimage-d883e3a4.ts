import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function updateSwapPreimage() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = 'd883e3a4-635d-4d67-92bd-440108a82587';
  
  try {
    // Get the hash lock for this swap
    const swapResult = await db.query(
      'SELECT hash_lock FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (swapResult.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const hashLock = swapResult.rows[0].hash_lock;
    console.log('🔐 Hash lock:', hashLock);
    
    // Generate a random preimage
    const preimage = ethers.hexlify(ethers.randomBytes(32));
    console.log('🔑 Generated preimage:', preimage);
    
    // Calculate its hash
    const calculatedHash = ethers.keccak256(preimage);
    console.log('📊 Calculated hash:', calculatedHash);
    
    if (calculatedHash === hashLock) {
      console.log('✅ Lucky! Generated preimage matches hash lock!');
    } else {
      console.log('⚠️  Generated preimage does not match hash lock');
      console.log('This is expected - we cannot reverse the hash function');
      console.log('In production, the frontend stores the preimage when creating the swap');
    }
    
    // For testing, update with the generated preimage anyway
    const updateResult = await db.query(
      'UPDATE swap_requests SET preimage_hash = $1 WHERE id = $2 RETURNING *',
      [preimage, swapId]
    );
    
    if (updateResult.rows.length > 0) {
      console.log('\n✅ Swap updated with test preimage');
      console.log('Note: The resolver will use this preimage to attempt claiming');
      console.log('If the hash doesn\'t match, the HTLC claim will fail');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

updateSwapPreimage();