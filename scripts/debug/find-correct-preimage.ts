#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function findCorrectPreimage() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const targetHashLock = '0x66c2a9b7bc84bc558d0650b2abc5037e5bdefa2ab4ff95442f7006c874792b58';
  
  try {
    console.log('🔍 Looking for preimage that matches hash lock:', targetHashLock);
    
    // Check all swaps to find one with matching hash lock and a preimage
    const result = await db.query(`
      SELECT id, hash_lock, preimage_hash, status 
      FROM swap_requests 
      WHERE hash_lock = $1 OR preimage_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `, [targetHashLock]);
    
    console.log(`\nFound ${result.rows.length} related swaps:`);
    
    for (const swap of result.rows) {
      console.log(`\nSwap ${swap.id}:`);
      console.log('- Hash lock:', swap.hash_lock);
      console.log('- Preimage:', swap.preimage_hash || '(empty)');
      console.log('- Status:', swap.status);
      
      if (swap.preimage_hash) {
        const hash = ethers.keccak256(swap.preimage_hash);
        console.log('- Hash of preimage:', hash);
        
        if (hash.toLowerCase() === targetHashLock.toLowerCase()) {
          console.log('✅ FOUND MATCHING PREIMAGE!');
          console.log('Preimage:', swap.preimage_hash);
          return swap.preimage_hash;
        }
      }
    }
    
    // Try the test preimage from other scripts
    const testPreimages = [
      '0x91b3a4e2b8c84f4e6e55b8c6e44e2e03a63e44e2e03a63e44e2e03a63e44e2e0',
      '0xa9b3c4d5e6f7081929aabbccddeeff00112233445566778899aabbccddeeff00',
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    ];
    
    console.log('\n🧪 Testing known preimages...');
    for (const preimage of testPreimages) {
      const hash = ethers.keccak256(preimage);
      console.log(`\nPreimage: ${preimage}`);
      console.log(`Hash: ${hash}`);
      if (hash.toLowerCase() === targetHashLock.toLowerCase()) {
        console.log('✅ FOUND MATCHING PREIMAGE!');
        return preimage;
      }
    }
    
    console.log('\n❌ Could not find matching preimage');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

findCorrectPreimage();