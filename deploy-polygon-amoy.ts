#!/usr/bin/env tsx

/**
 * Polygon Amoy Deployment Script
 * 
 * This script deploys the HTLC contract to Polygon Amoy testnet.
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
const POLYGON_AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology';

async function deployToPolygonAmoy(): Promise<void> {
  const spinner = ora();
  
  console.log(chalk.blue('🚀 Deploying HTLC Contract to Polygon Amoy'));
  console.log(chalk.gray('═'.repeat(50)));
  
  try {
    // Setup provider and wallet
    spinner.start('Connecting to Polygon Amoy...');
    const provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC_URL);
    const wallet = new ethers.Wallet(`0x${PRIVATE_KEY}`, provider);
    
    // Get network info
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    spinner.succeed(`Connected to Polygon Amoy (Chain ID: ${chainId})`);
    
    // Check wallet balance
    spinner.start('Checking wallet balance...');
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    
    if (parseFloat(balanceEth) < 0.01) {
      spinner.fail(`Insufficient balance: ${balanceEth} MATIC`);
      console.log(chalk.red('❌ You need at least 0.01 MATIC for deployment'));
      console.log(chalk.yellow('💡 Get Polygon Amoy tokens from: https://faucet.polygon.technology'));
      return;
    }
    
    spinner.succeed(`Wallet balance: ${balanceEth} MATIC`);
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
      network: 'polygon-amoy',
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
    
    // Update POLYGON_AMOY_HTLC_ADDRESS
    if (envContent.includes('POLYGON_AMOY_HTLC_ADDRESS=')) {
      envContent = envContent.replace(/POLYGON_AMOY_HTLC_ADDRESS=.*/g, `POLYGON_AMOY_HTLC_ADDRESS=${contractAddress}`);
    } else {
      envContent += `\nPOLYGON_AMOY_HTLC_ADDRESS=${contractAddress}`;
    }
    
    // Add POLYGON_AMOY_RPC_URL if not present
    if (!envContent.includes('POLYGON_AMOY_RPC_URL=')) {
      envContent += `\nPOLYGON_AMOY_RPC_URL=${POLYGON_AMOY_RPC_URL}`;
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
    console.log(`   Block Explorer: ${chalk.blue(`https://amoy.polygonscan.com/tx/${deployTx.hash}`)}`);
    
    console.log(chalk.green('\n✅ Polygon Amoy setup complete!'));
    console.log(chalk.white('🚀 Next steps:'));
    console.log('   1. Test EVM-to-EVM swap: pnpm cli:swap swap --dry-run --src-chain sepolia --dst-chain polygonAmoy');
    console.log('   2. Verify setup: pnpm deploy-setup verify');
    console.log('   3. Run a real swap between Sepolia and Polygon Amoy!');
    
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red('❌ Error:'), error);
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        console.log(chalk.yellow('\n💡 You need more MATIC for deployment'));
        console.log('   Get free Polygon Amoy MATIC from: https://faucet.polygon.technology');
      } else if (error.message.includes('network')) {
        console.log(chalk.yellow('\n💡 Check your network connection and RPC URL'));
      }
    }
    
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployToPolygonAmoy().catch(console.error);
}

export { deployToPolygonAmoy };