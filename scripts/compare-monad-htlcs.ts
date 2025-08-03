#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const CONTRACTS = {
  OLD_HTLC: '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9', // SimpleHTLC that worked before
  NEW_HTLC: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3', // FusionHTLC from .env.local
  OMNIMONSTER: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
  POOL_KEY: process.env.PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647'
};

const HTLC_ABI = [
  'function fund(bytes32 contractId, address token, address payable beneficiary, bytes32 hashLock, uint256 timelock, uint256 value) payable',
  'function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

async function compareHTLCs() {
  console.log(chalk.cyan.bold('\n🔍 COMPARING MONAD HTLC CONTRACTS\n'));
  
  const poolWallet = new ethers.Wallet(CONTRACTS.POOL_KEY);
  const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  const signer = poolWallet.connect(provider);
  
  console.log(chalk.blue('👤 Pool Wallet:'), poolWallet.address);
  
  // Test parameters
  const beneficiary = '0x0000000000000000000000000000000000000001';
  const hashLock = ethers.keccak256(ethers.toUtf8Bytes('test-preimage'));
  const timelock = Math.floor(Date.now() / 1000) + 3600;
  const amount = ethers.parseUnits('0.001', 18); // 0.001 OMNIMONSTER
  
  // Test OLD HTLC
  console.log(chalk.yellow('\n1️⃣ Testing OLD HTLC (SimpleHTLC):'), CONTRACTS.OLD_HTLC);
  
  try {
    const oldHTLC = new ethers.Contract(CONTRACTS.OLD_HTLC, HTLC_ABI, signer);
    const token = new ethers.Contract(CONTRACTS.OMNIMONSTER, ERC20_ABI, signer);
    
    // Check if it has contracts() or getDetails()
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    let hasContracts = false;
    let hasGetDetails = false;
    
    try {
      await oldHTLC.contracts(testId);
      hasContracts = true;
    } catch {}
    
    try {
      await oldHTLC.getDetails(testId);
      hasGetDetails = true;
    } catch {}
    
    console.log(chalk.gray(`   Has contracts(): ${hasContracts ? chalk.green('YES') : chalk.red('NO')}`));
    console.log(chalk.gray(`   Has getDetails(): ${hasGetDetails ? chalk.green('YES') : chalk.red('NO')}`));
    
    // Try to create HTLC
    const contractId = ethers.keccak256(ethers.toUtf8Bytes(`old-${Date.now()}`));
    
    // Approve
    console.log(chalk.gray('   Approving tokens...'));
    const approveTx = await token.approve(CONTRACTS.OLD_HTLC, amount);
    await approveTx.wait();
    
    // Fund
    console.log(chalk.gray('   Creating HTLC...'));
    const fundTx = await oldHTLC.fund(
      contractId,
      CONTRACTS.OMNIMONSTER,
      beneficiary,
      hashLock,
      timelock,
      amount,
      { value: 0, gasLimit: 300000 }
    );
    
    const receipt = await fundTx.wait();
    console.log(chalk.green('   ✅ SUCCESS! HTLC created'));
    console.log(chalk.gray(`   TX: ${fundTx.hash}`));
    console.log(chalk.gray(`   Gas Used: ${receipt.gasUsed.toString()}`));
    
  } catch (error: any) {
    console.log(chalk.red('   ❌ FAILED:'), error.message);
  }
  
  // Test NEW HTLC
  console.log(chalk.yellow('\n2️⃣ Testing NEW HTLC (FusionHTLC):'), CONTRACTS.NEW_HTLC);
  
  try {
    const newHTLC = new ethers.Contract(CONTRACTS.NEW_HTLC, HTLC_ABI, signer);
    const token = new ethers.Contract(CONTRACTS.OMNIMONSTER, ERC20_ABI, signer);
    
    // Check if it has contracts() or getDetails()
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    let hasContracts = false;
    let hasGetDetails = false;
    
    try {
      await newHTLC.contracts(testId);
      hasContracts = true;
    } catch {}
    
    try {
      await newHTLC.getDetails(testId);
      hasGetDetails = true;
    } catch {}
    
    console.log(chalk.gray(`   Has contracts(): ${hasContracts ? chalk.green('YES') : chalk.red('NO')}`));
    console.log(chalk.gray(`   Has getDetails(): ${hasGetDetails ? chalk.green('YES') : chalk.red('NO')}`));
    
    // Try to create HTLC
    const contractId = ethers.keccak256(ethers.toUtf8Bytes(`new-${Date.now()}`));
    
    // Approve
    console.log(chalk.gray('   Approving tokens...'));
    const approveTx = await token.approve(CONTRACTS.NEW_HTLC, amount);
    await approveTx.wait();
    
    // Fund
    console.log(chalk.gray('   Creating HTLC...'));
    const fundTx = await newHTLC.fund(
      contractId,
      CONTRACTS.OMNIMONSTER,
      beneficiary,
      hashLock,
      timelock,
      amount,
      { value: 0, gasLimit: 300000 }
    );
    
    const receipt = await fundTx.wait();
    console.log(chalk.green('   ✅ SUCCESS! HTLC created'));
    console.log(chalk.gray(`   TX: ${fundTx.hash}`));
    console.log(chalk.gray(`   Gas Used: ${receipt.gasUsed.toString()}`));
    
  } catch (error: any) {
    console.log(chalk.red('   ❌ FAILED:'), error.message);
  }
  
  console.log(chalk.cyan.bold('\n📊 RECOMMENDATION:'));
  console.log('Use the HTLC that succeeded above for production!');
}

compareHTLCs().catch(console.error);