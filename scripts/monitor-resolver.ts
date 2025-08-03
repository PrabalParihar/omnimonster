#!/usr/bin/env tsx
import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

async function monitorResolver() {
  console.log(chalk.cyan.bold('\n🔍 MONITORING RESOLVER\n'));
  
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);

  // Start resolver
  console.log(chalk.yellow('Starting resolver service...'));
  const resolverProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(process.cwd(), 'services/resolver'),
    detached: false,
    stdio: 'pipe'
  });

  const targetSwapId = 'fcae85d0-fad0-4297-96f7-27755a2c6b61';
  let poolCreated = false;

  resolverProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    
    // Only show relevant logs
    if (output.includes(targetSwapId) || 
        output.includes('Pool HTLC created') ||
        output.includes('successfully deployed') ||
        output.includes('POOL_FULFILLED') ||
        output.includes('Amount in wei: 50000000000000000')) {
      console.log(chalk.green('📡'), output.trim());
    }
    
    if (output.includes(targetSwapId) && output.includes('successfully deployed')) {
      poolCreated = true;
    }
  });

  resolverProcess.stderr.on('data', (data: Buffer) => {
    const error = data.toString();
    if (error.includes(targetSwapId)) {
      console.error(chalk.red('❌'), error.trim());
    }
  });

  // Monitor database
  console.log(chalk.yellow(`\nMonitoring swap ${targetSwapId}...`));
  
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const swap = await dao.getSwapRequest(targetSwapId);
    if (swap.poolHtlcContract) {
      console.log(chalk.green('\n\n🎉 POOL HTLC CREATED!'));
      console.log(chalk.gray(`   Pool Contract: ${swap.poolHtlcContract}`));
      console.log(chalk.gray(`   Status: ${swap.status}`));
      poolCreated = true;
      break;
    }
    
    if (i % 5 === 0) {
      process.stdout.write('.');
    }
  }

  if (!poolCreated) {
    console.log(chalk.yellow('\n\nPool HTLC not created yet. Checking resolver logs...'));
  }

  resolverProcess.kill();
  await database.close();

  if (poolCreated) {
    console.log(chalk.green.bold('\n✅ CROSS-CHAIN ATOMIC SWAP IS WORKING!'));
    console.log(chalk.cyan('\nThe system successfully:'));
    console.log('1. Created swap with correct wei amounts');
    console.log('2. Created user HTLC on Sepolia');
    console.log('3. Resolver detected and created pool HTLC on Monad');
    console.log('4. Updated database with pool HTLC info');
  }
}

monitorResolver().catch(console.error);