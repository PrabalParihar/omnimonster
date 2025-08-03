#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';

async function checkContracts() {
  const sepoliaProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
  const monadProvider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  
  console.log(chalk.cyan.bold('\n🔍 CHECKING HTLC CONTRACTS\n'));
  
  // Sepolia contracts
  console.log(chalk.yellow('Sepolia Contracts:'));
  const sepoliaContracts = {
    '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7': 'Old HTLC (from test scripts)',
    '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D': 'New HTLC (from .env.local)'
  };
  
  for (const [address, name] of Object.entries(sepoliaContracts)) {
    const code = await sepoliaProvider.getCode(address);
    console.log(`\n${name}:`);
    console.log(`  Address: ${address}`);
    console.log(`  Has code: ${code !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`  Code length: ${code.length}`);
  }
  
  // Monad contracts
  console.log(chalk.yellow('\n\nMonad Contracts:'));
  const monadContracts = {
    '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9': 'Old HTLC (from test scripts)',
    '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3': 'New HTLC (from .env.local)'
  };
  
  for (const [address, name] of Object.entries(monadContracts)) {
    try {
      const code = await monadProvider.getCode(address);
      console.log(`\n${name}:`);
      console.log(`  Address: ${address}`);
      console.log(`  Has code: ${code !== '0x' ? chalk.green('YES') : chalk.red('NO')}`);
      console.log(`  Code length: ${code.length}`);
    } catch (e) {
      console.log(`\n${name}:`);
      console.log(`  Address: ${address}`);
      console.log(`  Error: ${chalk.red('Could not check')}`);
    }
  }
  
  // Test function calls
  console.log(chalk.cyan.bold('\n\n🧪 TESTING FUNCTION CALLS\n'));
  
  const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
  const testContractId = ethers.keccak256(ethers.toUtf8Bytes('test'));
  
  // Test old Sepolia HTLC
  console.log(chalk.yellow('Testing old Sepolia HTLC (0x89f4...):'));
  try {
    const oldHTLC = new ethers.Contract('0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7', abi, sepoliaProvider);
    const result = await oldHTLC.contracts(testContractId);
    console.log(chalk.green('  ✅ contracts() function works'));
  } catch (e: any) {
    console.log(chalk.red('  ❌ contracts() function failed:', e.shortMessage || e.message));
  }
  
  // Test new Sepolia HTLC
  console.log(chalk.yellow('\nTesting new Sepolia HTLC (0x5d98...):'));
  try {
    const newHTLC = new ethers.Contract('0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D', abi, sepoliaProvider);
    const result = await newHTLC.contracts(testContractId);
    console.log(chalk.green('  ✅ contracts() function works'));
  } catch (e: any) {
    console.log(chalk.red('  ❌ contracts() function failed:', e.shortMessage || e.message));
  }
}

checkContracts().catch(console.error);