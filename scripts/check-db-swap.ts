#!/usr/bin/env tsx
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import database
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

async function checkDbSwap() {
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);

  try {
    const result = await dao.query(
      `SELECT * FROM swap_requests WHERE id = $1`,
      ['cee3f43b-9585-44a6-98c6-23cc49c9cb4d']
    );

    if (result.rows.length > 0) {
      const swap = result.rows[0];
      console.log(chalk.cyan('\n📊 SWAP DETAILS IN DATABASE:\n'));
      console.log(chalk.gray(`ID: ${swap.id}`));
      console.log(chalk.gray(`Status: ${swap.status}`));
      console.log(chalk.gray(`Source Amount: ${swap.source_amount}`));
      console.log(chalk.gray(`Expected Amount: ${swap.expected_amount}`));
      console.log(chalk.gray(`User HTLC: ${swap.user_htlc_contract}`));
      console.log(chalk.gray(`Pool HTLC: ${swap.pool_htlc_contract}`));
      console.log(chalk.gray(`Hash Lock: ${swap.hash_lock}`));
      console.log(chalk.gray(`Source Token: ${swap.source_token}`));
      console.log(chalk.gray(`Target Token: ${swap.target_token}`));
      console.log(chalk.gray(`User Address: ${swap.user_address}`));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await database.close();
  }
}

checkDbSwap().catch(console.error);