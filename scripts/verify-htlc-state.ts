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

// Correct ABI based on the actual contract
const HTLC_ABI = [
  'function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
];

async function verifyHTLCState() {
  console.log(chalk.cyan.bold('\n🔍 VERIFYING HTLC STATE\n'));

  const provider = new ethers.JsonRpcProvider(CONFIG.SEPOLIA_RPC);
  const htlcContract = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, provider);

  try {
    // Check our test swap HTLC
    const contractId = '0xa347f805ae6eea35341ae081cbea995c0dabc608b9243631cd37956e383e3a50';
    console.log(chalk.yellow('📋 Checking HTLC:'), contractId);
    
    const htlc = await htlcContract.contracts(contractId);
    
    console.log(chalk.green('✅ HTLC found on blockchain!'));
    console.log(chalk.gray(`   Token: ${htlc.token}`));
    console.log(chalk.gray(`   Beneficiary: ${htlc.beneficiary}`));
    console.log(chalk.gray(`   Originator: ${htlc.originator}`));
    console.log(chalk.gray(`   Value: ${htlc.value.toString()}`));
    console.log(chalk.gray(`   State: ${htlc.state} (0=INVALID, 1=PENDING, 2=CLAIMED, 3=REFUNDED)`));
    console.log(chalk.gray(`   Hash Lock: ${htlc.hashLock}`));
    console.log(chalk.gray(`   Timelock: ${new Date(Number(htlc.timelock) * 1000).toISOString()}`));
    
    if (htlc.state === 1) {
      console.log(chalk.green('\n✅ HTLC is in PENDING state - ready for pool to counter!'));
    } else if (htlc.state === 0) {
      console.log(chalk.red('\n❌ HTLC is in INVALID state - does not exist!'));
    } else if (htlc.state === 2) {
      console.log(chalk.yellow('\n⚠️  HTLC has been CLAIMED'));
    } else if (htlc.state === 3) {
      console.log(chalk.yellow('\n⚠️  HTLC has been REFUNDED'));
    }
    
    // Also check the recent test HTLC
    const testContractId = '0x8830d90e452d395fc3fbce5a288f21fd9a171d142b9ccebf2b1ff721e17cafa7';
    console.log(chalk.yellow('\n📋 Checking test HTLC:'), testContractId);
    
    const testHtlc = await htlcContract.contracts(testContractId);
    console.log(chalk.gray(`   State: ${testHtlc.state}`));
    console.log(chalk.gray(`   Value: ${testHtlc.value.toString()}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

// Run verification
verifyHTLCState().catch(console.error);