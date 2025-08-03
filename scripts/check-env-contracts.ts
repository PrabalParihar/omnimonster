#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function checkEnvContracts() {
  console.log(chalk.cyan.bold('\n🔍 CHECKING CONTRACTS FROM .env.local\n'));
  
  // Print environment values
  console.log(chalk.yellow('Environment Configuration:'));
  console.log('SEPOLIA_HTLC:', process.env.NEXT_PUBLIC_SEPOLIA_HTLC);
  console.log('MONAD_HTLC:', process.env.NEXT_PUBLIC_MONAD_HTLC);
  console.log('SEPOLIA_MONSTER:', process.env.NEXT_PUBLIC_SEPOLIA_MONSTER);
  console.log('MONAD_OMNIMONSTER:', process.env.NEXT_PUBLIC_MONAD_OMNIMONSTER);
  console.log('SEPOLIA_FUSION_HTLC:', process.env.SEPOLIA_FUSION_HTLC_CONTRACT);
  console.log('MONAD_FUSION_HTLC:', process.env.MONAD_FUSION_HTLC_CONTRACT);
  
  const sepoliaProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
  const monadProvider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  
  // Test the new HTLC addresses
  const newSepoliaHTLC = process.env.NEXT_PUBLIC_SEPOLIA_HTLC || '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D';
  const newMonadHTLC = process.env.NEXT_PUBLIC_MONAD_HTLC || '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3';
  
  console.log(chalk.cyan.bold('\n🧪 TESTING NEW HTLC CONTRACTS\n'));
  
  // Check if they have the fund function
  const htlcABI = [
    'function fund(bytes32 contractId, address token, address payable beneficiary, bytes32 hashLock, uint256 timelock, uint256 value) payable',
    'function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
    'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
  ];
  
  // Test Sepolia HTLC
  console.log(chalk.yellow(`Testing Sepolia HTLC (${newSepoliaHTLC}):`));
  const sepoliaContract = new ethers.Contract(newSepoliaHTLC, htlcABI, sepoliaProvider);
  
  try {
    // Try to get contract interface
    const code = await sepoliaProvider.getCode(newSepoliaHTLC);
    console.log(`  Has code: ${code !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
    
    // Check which function exists
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    try {
      await sepoliaContract.contracts(testId);
      console.log(chalk.green('  ✅ Has contracts() function'));
    } catch {
      try {
        await sepoliaContract.getDetails(testId);
        console.log(chalk.yellow('  ⚠️  Has getDetails() function instead of contracts()'));
      } catch {
        console.log(chalk.red('  ❌ Neither contracts() nor getDetails() work'));
      }
    }
  } catch (e) {
    console.log(chalk.red('  ❌ Error checking contract'));
  }
  
  // Test Monad HTLC
  console.log(chalk.yellow(`\nTesting Monad HTLC (${newMonadHTLC}):`));
  const monadContract = new ethers.Contract(newMonadHTLC, htlcABI, monadProvider);
  
  try {
    const code = await monadProvider.getCode(newMonadHTLC);
    console.log(`  Has code: ${code !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
    
    // Check which function exists
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    try {
      await monadContract.contracts(testId);
      console.log(chalk.green('  ✅ Has contracts() function'));
    } catch {
      try {
        await monadContract.getDetails(testId);
        console.log(chalk.yellow('  ⚠️  Has getDetails() function instead of contracts()'));
      } catch {
        console.log(chalk.red('  ❌ Neither contracts() nor getDetails() work'));
      }
    }
  } catch (e) {
    console.log(chalk.red('  ❌ Error checking contract'));
  }
  
  // Check token contracts
  console.log(chalk.cyan.bold('\n🪙 CHECKING TOKEN CONTRACTS\n'));
  
  const monsterToken = process.env.NEXT_PUBLIC_SEPOLIA_MONSTER || '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E';
  const omniToken = process.env.NEXT_PUBLIC_MONAD_OMNIMONSTER || '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24';
  
  console.log(chalk.yellow(`MONSTER Token (${monsterToken}):`));
  const monsterCode = await sepoliaProvider.getCode(monsterToken);
  console.log(`  Has code: ${monsterCode !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
  
  console.log(chalk.yellow(`\nOMNIMONSTER Token (${omniToken}):`));
  try {
    const omniCode = await monadProvider.getCode(omniToken);
    console.log(`  Has code: ${omniCode !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
  } catch {
    console.log(chalk.red('  ❌ Could not check'));
  }
}

checkEnvContracts().catch(console.error);