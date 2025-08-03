#!/usr/bin/env npx tsx

import { Client } from 'pg';

async function cleanupBrokenSwaps() {
  // Use the correct database URL from .env.local
  const DATABASE_URL = 'postgresql://neondb_owner:npg_Fb4WALuywlr8@ep-crimson-mud-a10e1015-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find swaps with amount = 0
    const brokenSwaps = await client.query(`
      SELECT id, source_amount, user_htlc_contract, status 
      FROM swap_requests 
      WHERE status = 'PENDING' 
      AND (source_amount = '0' OR source_amount IS NULL)
    `);
    
    console.log(`\nFound ${brokenSwaps.rows.length} broken swaps with amount = 0`);
    
    for (const swap of brokenSwaps.rows) {
      console.log(`- Swap ${swap.id}: amount=${swap.source_amount}`);
      await client.query(
        `UPDATE swap_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [swap.id]
      );
    }

    // Find swaps with known invalid HTLC contracts
    const invalidHTLCs = [
      '0xa347f805ae6eea35341ae081cbea995c0dabc608b9243631cd37956e383e3a50',
      '0x992e3c490e8e0a425049c61b6239670afe8f6c0711ccb37c9cfec2789f3f000c',
      '0xea3f1b0b29e43f33b1e6419d87ed652f2b4cbea6ae8f1e7c96f92bd7872f1506',
      '0xf1ff459b9ac40e44208f89b646fcf89ecfa0669db0db86fb21243f48a736df74'
    ];

    const invalidSwaps = await client.query(`
      SELECT id, user_htlc_contract 
      FROM swap_requests 
      WHERE status = 'PENDING' 
      AND user_htlc_contract = ANY($1)
    `, [invalidHTLCs]);
    
    console.log(`\nFound ${invalidSwaps.rows.length} swaps with invalid HTLCs`);
    
    for (const swap of invalidSwaps.rows) {
      console.log(`- Swap ${swap.id}: HTLC=${swap.user_htlc_contract}`);
      await client.query(
        `UPDATE swap_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [swap.id]
      );
    }

    // Check remaining pending swaps
    const remainingPending = await client.query(`
      SELECT id, source_token, target_token, source_amount, status 
      FROM swap_requests 
      WHERE status = 'PENDING'
    `);
    
    console.log(`\n${remainingPending.rows.length} swaps remaining in PENDING status:`);
    for (const swap of remainingPending.rows) {
      console.log(`- ${swap.id}: ${swap.source_token} -> ${swap.target_token} (${swap.source_amount})`);
    }

    console.log('\nCleanup complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

cleanupBrokenSwaps();