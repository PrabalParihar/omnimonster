#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const CONFIG = {
  SEPOLIA_RPC: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  SEPOLIA_HTLC: '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7',
};

const HTLC_ABI = [
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)',
  'function getContract(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

async function checkHTLCEvents() {
  console.log(chalk.cyan.bold('\n🔍 CHECKING HTLC EVENTS\n'));

  const provider = new ethers.JsonRpcProvider(CONFIG.SEPOLIA_RPC);
  const htlcContract = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, provider);

  try {
    // Check specific transaction
    const txHash = '0xffbfd91bd000a0f6dd5086b97abefeaa28312f6baec2cff5f11a84a92be86b89';
    console.log(chalk.yellow('📋 Checking transaction:'), txHash);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.log(chalk.red('Transaction not found'));
      return;
    }

    console.log(chalk.green('✅ Transaction found'));
    console.log(chalk.gray(`   Block: ${receipt.blockNumber}`));
    console.log(chalk.gray(`   Status: ${receipt.status} (1=success)`));
    console.log(chalk.gray(`   Gas used: ${receipt.gasUsed.toString()}`));

    // Parse events
    console.log(chalk.yellow('\n📌 Events in transaction:'));
    for (const log of receipt.logs) {
      try {
        const parsed = htlcContract.interface.parseLog(log);
        if (parsed && parsed.name === 'HTLCCreated') {
          console.log(chalk.green('\n✅ HTLCCreated event found!'));
          console.log(chalk.gray(`   Contract ID: ${parsed.args.contractId}`));
          console.log(chalk.gray(`   Originator: ${parsed.args.originator}`));
          console.log(chalk.gray(`   Beneficiary: ${parsed.args.beneficiary}`));
          console.log(chalk.gray(`   Token: ${parsed.args.token}`));
          console.log(chalk.gray(`   Value: ${parsed.args.value.toString()}`));
          console.log(chalk.gray(`   Hash Lock: ${parsed.args.hashLock}`));
          console.log(chalk.gray(`   Timelock: ${new Date(Number(parsed.args.timelock) * 1000).toISOString()}`));

          // Try to get contract details
          console.log(chalk.yellow('\n🔗 Fetching HTLC details...'));
          try {
            const details = await htlcContract.getContract(parsed.args.contractId);
            console.log(chalk.green('✅ HTLC details retrieved!'));
            console.log(chalk.gray(`   State: ${details.state}`));
          } catch (error: any) {
            console.log(chalk.red('❌ Failed to get contract details'));
            console.log(chalk.gray(`   Error: ${error.message}`));
          }
        }
      } catch (e) {
        // Not an HTLC event
      }
    }

    // Check recent HTLCs
    console.log(chalk.yellow('\n📊 Recent HTLCs (last 100 blocks):'));
    const currentBlock = await provider.getBlockNumber();
    const filter = htlcContract.filters.HTLCCreated();
    const events = await htlcContract.queryFilter(filter, currentBlock - 100, currentBlock);
    
    console.log(chalk.gray(`Found ${events.length} HTLCs`));
    for (const event of events.slice(-5)) {
      console.log(chalk.gray(`\n   Contract ID: ${event.args.contractId}`));
      console.log(chalk.gray(`   Block: ${event.blockNumber}`));
      console.log(chalk.gray(`   Originator: ${event.args.originator}`));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

// Run check
checkHTLCEvents().catch(console.error);