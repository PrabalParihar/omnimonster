#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import the EVM client
import { EvmHTLCClient } from '../packages/shared/src/clients/evm';
import { evmChains } from '../packages/shared/src/chains';

async function debugResolverContractCall() {
  console.log(chalk.cyan.bold('\n🐛 DEBUGGING RESOLVER CONTRACT CALL\n'));

  const contractId = '0xa347f805ae6eea35341ae081cbea995c0dabc608b9243631cd37956e383e3a50';

  try {
    // Test 1: Direct ethers.js call
    console.log(chalk.yellow('1️⃣ Direct ethers.js call...'));
    const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
    const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
    const contract = new ethers.Contract('0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7', abi, provider);
    
    const result = await contract.contracts(contractId);
    console.log(chalk.green('✅ Direct call successful!'));
    console.log(chalk.gray(`   State: ${result.state}`));
    console.log(chalk.gray(`   Value: ${result.value.toString()}`));

    // Test 2: Using EvmHTLCClient
    console.log(chalk.yellow('\n2️⃣ Using EvmHTLCClient...'));
    const sepoliaChain = evmChains.sepolia;
    const client = new EvmHTLCClient({ chain: sepoliaChain });
    
    const details = await client.getDetails(contractId);
    console.log(chalk.green('✅ EvmHTLCClient call successful!'));
    console.log(chalk.gray(`   State: ${details.state}`));
    console.log(chalk.gray(`   Value: ${details.value}`));

    // Test 3: Different contract ID (all zeros)
    console.log(chalk.yellow('\n3️⃣ Testing with zeros contract ID...'));
    const zeroId = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    try {
      const zeroResult = await contract.contracts(zeroId);
      console.log(chalk.gray(`   State: ${zeroResult.state}`));
      console.log(chalk.gray(`   Token: ${zeroResult.token}`));
    } catch (error: any) {
      console.log(chalk.red('❌ Error:'), error.message);
    }

    // Test 4: Invalid contract ID
    console.log(chalk.yellow('\n4️⃣ Testing with invalid contract ID...'));
    const invalidId = '0x1234567890123456789012345678901234567890123456789012345678901234';
    
    const invalidResult = await contract.contracts(invalidId);
    console.log(chalk.gray(`   State: ${invalidResult.state}`));
    console.log(chalk.gray(`   Token: ${invalidResult.token}`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

// Run debug
debugResolverContractCall().catch(console.error);