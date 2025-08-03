#!/usr/bin/env tsx

import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function fixSwapPreimage() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  const preimage = '0xe64325fb6cabd75f2b7d9ee22a82329e80e6ba9bf82a390cfdf21dd1369327c9';
  
  try {
    console.log(`🔧 Fixing preimage for swap ${swapId}\n`);
    
    // First check current state
    const result = await db.query(
      'SELECT id, status, preimage_hash, hash_lock FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const swap = result.rows[0];
    console.log('Current state:');
    console.log('- Status:', swap.status);
    console.log('- Preimage:', swap.preimage_hash || '(empty)');
    console.log('- Hash lock:', swap.hash_lock);
    
    // Verify preimage matches hash lock
    const hashOfPreimage = ethers.keccak256(preimage);
    console.log('\n🔍 Verification:');
    console.log('- Preimage:', preimage);
    console.log('- Hash of preimage:', hashOfPreimage);
    console.log('- Expected hash lock:', swap.hash_lock);
    console.log('- Match?', hashOfPreimage.toLowerCase() === swap.hash_lock.toLowerCase());
    
    if (hashOfPreimage.toLowerCase() !== swap.hash_lock.toLowerCase()) {
      console.log('\n❌ Preimage does not match hash lock!');
      return;
    }
    
    // Update preimage in database
    console.log('\n✅ Updating preimage in database...');
    await db.query(
      'UPDATE swap_requests SET preimage_hash = $1 WHERE id = $2',
      [preimage, swapId]
    );
    
    console.log('✅ Preimage updated successfully!');
    
    // Also update via API to ensure cache is cleared
    console.log('\n📡 Updating via API...');
    const response = await fetch(`http://localhost:3000/api/swaps/${swapId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preimage: preimage
      })
    });
    
    if (response.ok) {
      console.log('✅ API update successful');
    } else {
      console.log('❌ API update failed:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

fixSwapPreimage();