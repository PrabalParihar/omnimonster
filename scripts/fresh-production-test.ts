#!/usr/bin/env tsx
import { ethers } from 'ethers';
import crypto from 'crypto';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import database
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

const CONFIG = {
  POOL_WALLET_KEY: process.env.POOL_WALLET_PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647',
  API_URL: 'http://localhost:3000/api',
  SEPOLIA_RPC: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  SEPOLIA_HTLC: '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7',
  SEPOLIA_MONSTER: '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E',
};

const HTLC_ABI = [
  'function fund(bytes32 contractId, address token, address payable beneficiary, bytes32 hashLock, uint256 timelock, uint256 value) payable',
  'function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

async function freshProductionTest() {
  console.log(chalk.cyan.bold('\n🚀 FRESH PRODUCTION TEST\n'));
  
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);
  
  const poolWallet = new ethers.Wallet(CONFIG.POOL_WALLET_KEY);
  const provider = new ethers.JsonRpcProvider(CONFIG.SEPOLIA_RPC);
  const userSigner = poolWallet.connect(provider);
  
  let resolverProcess: any = null;

  try {
    // Step 1: Create a fresh swap
    console.log(chalk.yellow('1️⃣ Creating fresh swap...'));
    
    const swapData = {
      fromChain: 'sepolia',
      fromToken: 'MONSTER',
      toChain: 'monadTestnet',
      toToken: 'OMNIMONSTER',
      amount: '0.001',
      beneficiary: poolWallet.address,
      timelock: 3600,
      slippage: 1
    };

    const createResponse = await fetch(`${CONFIG.API_URL}/swaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapData)
    });

    if (!createResponse.ok) {
      throw new Error(`API error: ${await createResponse.text()}`);
    }

    const swap = await createResponse.json();
    console.log(chalk.green('✅ Swap created'));
    console.log(chalk.gray(`   ID: ${swap.id}`));
    console.log(chalk.gray(`   Hash Lock: ${swap.hashLock}`));

    // Step 2: Create HTLC with proper contract ID
    console.log(chalk.yellow('\n2️⃣ Creating HTLC on blockchain...'));
    
    const userContractId = ethers.keccak256(ethers.toUtf8Bytes(`${swap.id}-user`));
    console.log(chalk.gray(`   Contract ID: ${userContractId}`));
    
    const monsterToken = new ethers.Contract(CONFIG.SEPOLIA_MONSTER, ERC20_ABI, userSigner);
    const htlcContract = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, userSigner);
    
    const decimals = await monsterToken.decimals();
    const amount = ethers.parseUnits(swapData.amount, decimals);
    
    // Approve
    console.log(chalk.gray('   Approving tokens...'));
    const approveTx = await monsterToken.approve(CONFIG.SEPOLIA_HTLC, amount);
    await approveTx.wait();
    
    // Create HTLC
    const timelock = Math.floor(Date.now() / 1000) + swapData.timelock;
    const fundTx = await htlcContract.fund(
      userContractId,
      CONFIG.SEPOLIA_MONSTER,
      poolWallet.address,
      swap.hashLock,
      timelock,
      amount,
      { value: 0 }
    );
    
    console.log(chalk.gray(`   TX: ${fundTx.hash}`));
    const receipt = await fundTx.wait();
    console.log(chalk.green('✅ HTLC created on blockchain'));
    console.log(chalk.gray(`   Block: ${receipt.blockNumber}`));

    // Step 3: Verify HTLC
    console.log(chalk.yellow('\n3️⃣ Verifying HTLC...'));
    const htlcDetails = await htlcContract.contracts(userContractId);
    console.log(chalk.green('✅ HTLC verified'));
    console.log(chalk.gray(`   State: ${htlcDetails.state} (1=PENDING)`));
    console.log(chalk.gray(`   Value: ${ethers.formatUnits(htlcDetails.value, decimals)} MONSTER`));

    // Step 4: Update database
    console.log(chalk.yellow('\n4️⃣ Updating database...'));
    const updateResponse = await fetch(`${CONFIG.API_URL}/swaps/${swap.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userHtlcContract: userContractId,
        userAddress: poolWallet.address,
        status: 'PENDING'
      })
    });

    if (updateResponse.ok) {
      console.log(chalk.green('✅ Database updated'));
    }

    // Step 5: Start resolver
    console.log(chalk.yellow('\n5️⃣ Starting resolver service...'));
    resolverProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(process.cwd(), 'services/resolver'),
      detached: false,
      stdio: 'pipe'
    });

    // Capture important logs
    resolverProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes(swap.id) || 
          output.includes(userContractId) ||
          output.includes('HTLC Details') || 
          output.includes('state:')) {
        console.log(chalk.green('📡'), output.trim());
      }
    });

    resolverProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      if (error.includes(swap.id) || error.includes(userContractId)) {
        console.error(chalk.red('❌'), error.trim());
      }
    });

    // Wait and check
    console.log(chalk.yellow('\n⏳ Monitoring for 20 seconds...'));
    
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      process.stdout.write('.');
      
      const updatedSwap = await dao.getSwapRequest(swap.id);
      if (updatedSwap.poolHtlcContract) {
        console.log(chalk.green('\n\n✅ POOL HTLC CREATED!'));
        console.log(chalk.gray(`   Contract: ${updatedSwap.poolHtlcContract}`));
        console.log(chalk.gray(`   Status: ${updatedSwap.status}`));
        break;
      }
    }

    console.log(chalk.cyan('\n\n📊 PRODUCTION TEST COMPLETE'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  } finally {
    if (resolverProcess) {
      console.log(chalk.gray('\nStopping resolver...'));
      resolverProcess.kill();
    }
    await database.close();
  }
}

// Run test
freshProductionTest().catch(console.error);