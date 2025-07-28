#!/usr/bin/env tsx

/**
 * Direct Sepolia Deployment Script
 * 
 * This script deploys the HTLC contract directly to Sepolia
 * without relying on Hardhat's complex toolchain.
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

// Contract ABI and bytecode from compiled artifacts
const SWAP_SAGE_HTLC_ARTIFACT = JSON.parse(
  readFileSync(join(__dirname, 'contracts/evm/artifacts/contracts/SwapSageHTLC.sol/SwapSageHTLC.json'), 'utf8')
);

const PRIVATE_KEY = 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';

async function deployToSepolia(): Promise<void> {
  const spinner = ora();
  
  console.log(chalk.blue('🚀 Deploying HTLC Contract to Sepolia'));
  console.log(chalk.gray('═'.repeat(50)));
  
  try {
    // Setup provider and wallet
    spinner.start('Connecting to Sepolia...');
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(`0x${PRIVATE_KEY}`, provider);
    
    // Get network info
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    spinner.succeed(`Connected to ${network.name || 'Sepolia'} (Chain ID: ${chainId})`);
    
    // Check wallet balance
    spinner.start('Checking wallet balance...');
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    
    if (parseFloat(balanceEth) < 0.01) {
      spinner.fail(`Insufficient balance: ${balanceEth} ETH`);
      console.log(chalk.red('❌ You need at least 0.01 ETH for deployment'));
      console.log(chalk.yellow('💡 Get Sepolia ETH from: https://sepoliafaucet.com'));
      return;
    }
    
    spinner.succeed(`Wallet balance: ${balanceEth} ETH`);
    console.log(`   Deployer address: ${chalk.cyan(wallet.address)}`);
    
    // Deploy contract
    spinner.start('Deploying SwapSageHTLC contract...');
    
    const contractFactory = new ethers.ContractFactory(
      SWAP_SAGE_HTLC_ARTIFACT.abi,
      SWAP_SAGE_HTLC_ARTIFACT.bytecode,
      wallet
    );
    
    const contract = await contractFactory.deploy();
    const deployTx = contract.deploymentTransaction();
    
    if (!deployTx) {
      throw new Error('Deployment transaction is null');
    }
    
    spinner.text = `Waiting for deployment confirmation... (${deployTx.hash})`;
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    const receipt = await provider.getTransactionReceipt(deployTx.hash);
    
    if (!receipt || receipt.status !== 1) {
      throw new Error('Deployment transaction failed');
    }
    
    spinner.succeed(`Contract deployed to: ${contractAddress}`);
    
    // Test basic functionality
    spinner.start('Testing contract functionality...');
    const currentTime = await contract.getCurrentTime();
    spinner.succeed(`Contract is functional (current time: ${new Date(Number(currentTime) * 1000).toISOString()})`);
    
    // Save deployment info
    spinner.start('Saving deployment information...');
    
    const deploymentInfo = {
      chainId,
      network: network.name || 'sepolia',
      address: contractAddress,
      deployer: wallet.address,
      deploymentTime: new Date().toISOString(),
      blockNumber: receipt.blockNumber,
      transactionHash: deployTx.hash,
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: deployTx.gasPrice?.toString() || '0'
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = join(__dirname, 'contracts/evm/deployments');
    if (!existsSync(deploymentsDir)) {
      mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save deployment file
    const deploymentFile = join(deploymentsDir, `htlc-${chainId}.json`);
    writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    // Update .env.local
    const envPath = join(__dirname, '.env.local');
    let envContent = readFileSync(envPath, 'utf8');
    
    // Update SEPOLIA_HTLC_ADDRESS
    if (envContent.includes('SEPOLIA_HTLC_ADDRESS=')) {
      envContent = envContent.replace(/SEPOLIA_HTLC_ADDRESS=.*/g, `SEPOLIA_HTLC_ADDRESS=${contractAddress}`);
    } else {
      envContent += `\nSEPOLIA_HTLC_ADDRESS=${contractAddress}`;
    }
    
    writeFileSync(envPath, envContent);
    
    spinner.succeed('Deployment information saved');
    
    // Success summary
    console.log(chalk.green('\n🎉 Deployment completed successfully!'));
    console.log(chalk.white('📊 Deployment Summary:'));
    console.log(`   Contract Address: ${chalk.cyan(contractAddress)}`);
    console.log(`   Chain ID: ${chalk.yellow(chainId)}`);
    console.log(`   Block Number: ${chalk.blue(receipt.blockNumber)}`);
    console.log(`   Transaction Hash: ${chalk.gray(deployTx.hash)}`);
    console.log(`   Gas Used: ${chalk.magenta(receipt.gasUsed.toString())}`);
    console.log(`   Deployment File: ${chalk.gray(deploymentFile)}`);
    
    console.log(chalk.green('\n✅ Your CLI is now ready!'));
    console.log(chalk.white('🚀 Next steps:'));
    console.log('   1. Test with dry-run: pnpm cli:swap swap --dry-run');
    console.log('   2. Verify setup: pnpm deploy-setup verify');
    console.log('   3. Run a real swap: pnpm cli:swap swap');
    
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red('❌ Error:'), error);
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        console.log(chalk.yellow('\n💡 You need more Sepolia ETH for deployment'));
        console.log('   Get free Sepolia ETH from: https://sepoliafaucet.com');
      } else if (error.message.includes('network')) {
        console.log(chalk.yellow('\n💡 Check your network connection and RPC URL'));
      }
    }
    
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployToSepolia().catch(console.error);
}

export { deployToSepolia };