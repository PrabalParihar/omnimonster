#!/usr/bin/env tsx

import { ethers } from 'ethers';
import crypto from 'crypto';

async function generatePreimageForHashlock() {
  const targetHashLock = '0x66c2a9b7bc84bc558d0650b2abc5037e5bdefa2ab4ff95442f7006c874792b58';
  
  console.log('🎯 Target hash lock:', targetHashLock);
  console.log('\n🔍 Attempting to find preimage...\n');
  
  // The issue is that we need the original preimage that was used to create this hash lock
  // Hash functions are one-way, so we can't reverse it
  
  // However, let's check if this hash lock was generated elsewhere in the code
  // by looking at common patterns
  
  // Check if it's a simple pattern
  const testPreimages = [
    // Common test values
    '0x' + '0'.repeat(64),
    '0x' + '1'.repeat(64),
    '0x' + 'f'.repeat(64),
    // Sequential patterns
    '0x' + '0123456789abcdef'.repeat(4),
    // The stored preimage from the DB (might be wrong)
    '0xe64325fb6cabd75f2b7d9ee22a82329e80e6ba9bf82a390cfdf21dd1369327c9',
  ];
  
  // Try some random values based on timestamp patterns
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const bytes = Buffer.concat([
      Buffer.from((now - i * 1000).toString(16).padStart(16, '0'), 'hex'),
      crypto.randomBytes(24)
    ]);
    testPreimages.push('0x' + bytes.toString('hex'));
  }
  
  console.log('Testing preimages...\n');
  
  for (const preimage of testPreimages) {
    const hash = ethers.keccak256(preimage);
    if (hash.toLowerCase() === targetHashLock.toLowerCase()) {
      console.log('✅ FOUND MATCHING PREIMAGE!');
      console.log('Preimage:', preimage);
      console.log('Hash:', hash);
      return preimage;
    }
  }
  
  console.log('❌ Could not find matching preimage through brute force.');
  console.log('\n💡 Explanation:');
  console.log('Hash functions like keccak256 are one-way functions.');
  console.log('We cannot reverse the hash to get the original preimage.');
  console.log('The preimage must have been generated when the swap was created.');
  console.log('\n🔧 Solution:');
  console.log('1. The preimage should be stored when creating the user HTLC');
  console.log('2. Or we need to find where this specific hash lock was generated');
  
  // Let's generate a new valid preimage/hashlock pair for reference
  const newPreimage = '0x' + crypto.randomBytes(32).toString('hex');
  const newHashLock = ethers.keccak256(newPreimage);
  
  console.log('\n📝 Example of valid preimage/hashlock pair:');
  console.log('Preimage:', newPreimage);
  console.log('HashLock:', newHashLock);
}

generatePreimageForHashlock();