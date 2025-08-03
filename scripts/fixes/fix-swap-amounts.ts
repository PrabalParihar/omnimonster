import { FusionDatabase, getDatabaseConfig } from './packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function fixSwapAmounts() {
  const db = FusionDatabase.getInstance(getDatabaseConfig());
  const swapId = 'd883e3a4-635d-4d67-92bd-440108a82587';
  
  try {
    console.log(`🔧 Fixing swap ${swapId} amounts...\n`);
    
    // First get the current swap
    const result = await db.query(
      'SELECT * FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Swap not found');
      return;
    }
    
    const swap = result.rows[0];
    console.log('Current amounts:');
    console.log('- Source amount:', swap.source_amount);
    console.log('- Expected amount:', swap.expected_amount);
    
    // Convert decimal amounts to wei (assuming 18 decimals for both tokens)
    const sourceAmountWei = ethers.parseUnits(swap.source_amount.toString(), 18).toString();
    const expectedAmountWei = ethers.parseUnits(swap.expected_amount.toString(), 18).toString();
    
    console.log('\nConverted to wei:');
    console.log('- Source amount wei:', sourceAmountWei);
    console.log('- Expected amount wei:', expectedAmountWei);
    
    // Update the database
    await db.query(
      `UPDATE swap_requests 
       SET source_amount = $1, expected_amount = $2
       WHERE id = $3`,
      [sourceAmountWei, expectedAmountWei, swapId]
    );
    
    console.log('\n✅ Updated swap amounts in database');
    
    // Verify the update
    const verifyResult = await db.query(
      'SELECT source_amount, expected_amount FROM swap_requests WHERE id = $1',
      [swapId]
    );
    
    const updated = verifyResult.rows[0];
    console.log('\nVerification:');
    console.log('- New source amount:', updated.source_amount);
    console.log('- New expected amount:', updated.expected_amount);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

fixSwapAmounts();