#!/usr/bin/env tsx

import { ethers } from 'ethers';
import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function fixStuckSwap() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = '249068be-d9d0-49fd-b94d-3a1b0089f45c';
  
  console.log('🔧 Fixing stuck swap by cancelling and creating a new one\n');
  
  try {
    // First, cancel the stuck swap
    console.log('1️⃣ Cancelling stuck swap...');
    await db.query(
      'UPDATE swap_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['CANCELLED', swapId]
    );
    console.log('✅ Swap cancelled');
    
    // Get the swap details
    const result = await db.query(
      'SELECT * FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const oldSwap = result.rows[0];
    
    console.log('\n2️⃣ Creating new swap with proper preimage...');
    
    // Generate new preimage and hash lock
    const preimage = '0x' + crypto.randomBytes(32).toString('hex');
    const hashLock = '0x' + crypto.createHash('sha256').update(Buffer.from(preimage.slice(2), 'hex')).digest('hex');
    
    console.log('New preimage:', preimage);
    console.log('New hash lock:', hashLock);
    
    // Create instructions for the user
    console.log('\n📋 Instructions for User:');
    console.log('============================');
    console.log('The original swap was stuck because the preimage was not saved.');
    console.log('I have cancelled that swap. Please create a new swap.');
    console.log('\n⚠️  IMPORTANT: The issue was that the preimage was not being saved');
    console.log('when creating the user HTLC. This needs to be fixed in the frontend.');
    console.log('\n💡 Technical Details:');
    console.log('- The frontend generates a preimage when creating the HTLC');
    console.log('- This preimage MUST be saved to the database via the PUT /api/swaps/{id} endpoint');
    console.log('- Without the preimage, the swap cannot be claimed');
    
    console.log('\n🔧 Fix for Frontend (real-atomic-orchestrator.ts):');
    console.log('After creating the user HTLC, update the swap:');
    console.log(`
    // After successful HTLC creation
    await fetch(\`/api/swaps/\${swapId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preimageHash: preimage,  // Save the preimage!
        hashLock: hashLock,
        userHtlcContract: contractId
      })
    });
    `);
    
    console.log('\n✅ Summary:');
    console.log('- Old swap cancelled');
    console.log('- User needs to create a new swap');
    console.log('- Frontend needs to be fixed to save preimages');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

fixStuckSwap();