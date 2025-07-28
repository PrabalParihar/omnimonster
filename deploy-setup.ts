#!/usr/bin/env tsx

/**
 * Deployment Setup Helper
 * 
 * This script helps set up and deploy the HTLC contracts to the required networks
 * for the cross-chain swap CLI to work properly.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface DeploymentConfig {
  network: 'sepolia' | 'goerli' | 'local';
  privateKey: string;
  rpcUrl?: string;
  etherscanApiKey?: string;
}

const program = new Command();

program
  .name('deploy-setup')
  .description('Setup and deploy HTLC contracts for cross-chain swaps')
  .version('1.0.0');

program
  .command('setup')
  .description('Interactive setup for deployment')
  .action(async () => {
    try {
      await interactiveSetup();
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Deploy HTLC contract to specified network')
  .option('-n, --network <network>', 'Network to deploy to (sepolia|goerli|local)')
  .option('-k, --private-key <key>', 'Private key for deployment')
  .option('-r, --rpc-url <url>', 'Custom RPC URL')
  .action(async (options) => {
    try {
      const config = await promptForDeployment(options);
      await deployContract(config);
    } catch (error) {
      console.error(chalk.red('❌ Deployment failed:'), error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify deployment and setup')
  .action(async () => {
    try {
      await verifySetup();
    } catch (error) {
      console.error(chalk.red('❌ Verification failed:'), error);
      process.exit(1);
    }
  });

async function interactiveSetup(): Promise<void> {
  console.log(chalk.blue('🔧 Cross-Chain Swap Deployment Setup'));
  console.log(chalk.gray('This will help you deploy the HTLC contracts needed for cross-chain swaps\n'));

  // Check current setup
  const envPath = join(process.cwd(), '.env.local');
  const hasEnv = existsSync(envPath);
  
  if (hasEnv) {
    console.log(chalk.green('✅ Found .env.local file'));
    const envContent = readFileSync(envPath, 'utf8');
    
    // Check what's already configured
    const hasSepoliaAddress = envContent.includes('SEPOLIA_HTLC_ADDRESS') && 
                              envContent.match(/SEPOLIA_HTLC_ADDRESS=0x[a-fA-F0-9]{40}/);
    const hasPrivateKey = envContent.includes('PRIVATE_KEY') && 
                         envContent.match(/PRIVATE_KEY=[a-fA-F0-9]{64}/);
    
    if (hasSepoliaAddress) {
      const address = envContent.match(/SEPOLIA_HTLC_ADDRESS=(0x[a-fA-F0-9]{40})/)?.[1];
      console.log(chalk.green(`✅ Sepolia HTLC address already configured: ${address}`));
    } else {
      console.log(chalk.yellow('⚠️  Sepolia HTLC address not configured'));
    }
    
    if (hasPrivateKey) {
      console.log(chalk.green('✅ Private key configured'));
    } else {
      console.log(chalk.yellow('⚠️  Private key not configured'));
    }
  } else {
    console.log(chalk.yellow('⚠️  No .env.local file found'));
  }

  // Ask what user wants to do
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Deploy HTLC contract to Sepolia', value: 'deploy-sepolia' },
        { name: '🔍 Check current deployment status', value: 'check-status' },
        { name: '⚙️  Update environment configuration', value: 'update-env' },
        { name: '📋 Show deployment instructions', value: 'show-instructions' }
      ]
    }
  ]);

  switch (action) {
    case 'deploy-sepolia':
      await setupSepoliaDeployment();
      break;
    case 'check-status':
      await verifySetup();
      break;
    case 'update-env':
      await updateEnvironment();
      break;
    case 'show-instructions':
      showInstructions();
      break;
  }
}

async function setupSepoliaDeployment(): Promise<void> {
  console.log(chalk.blue('\n🔧 Setting up Sepolia deployment...'));

  const questions = [];

  questions.push({
    type: 'password',
    name: 'privateKey',
    message: 'Enter your private key for Sepolia deployment (0x...):',
    mask: '*',
    validate: (input: string) => {
      if (!input.startsWith('0x') || input.length !== 66) {
        return 'Private key must start with 0x and be 66 characters long';
      }
      return true;
    }
  });

  questions.push({
    type: 'input',
    name: 'rpcUrl',
    message: 'Enter Sepolia RPC URL (or press enter for default):',
    default: 'https://ethereum-sepolia-rpc.publicnode.com'
  });

  questions.push({
    type: 'input',
    name: 'etherscanApiKey',
    message: 'Enter Etherscan API key for verification (optional):',
    default: ''
  });

  const answers = await inquirer.prompt(questions);

  // Update .env.local
  await updateEnvFile({
    PRIVATE_KEY: answers.privateKey.replace('0x', ''),
    SEPOLIA_RPC_URL: answers.rpcUrl,
    ...(answers.etherscanApiKey && { ETHERSCAN_API_KEY: answers.etherscanApiKey })
  });

  console.log(chalk.green('✅ Environment updated'));

  // Deploy
  const deployConfig: DeploymentConfig = {
    network: 'sepolia',
    privateKey: answers.privateKey,
    rpcUrl: answers.rpcUrl,
    etherscanApiKey: answers.etherscanApiKey
  };

  await deployContract(deployConfig);
}

async function deployContract(config: DeploymentConfig): Promise<void> {
  const spinner = ora();
  
  console.log(chalk.blue(`\n🚀 Deploying HTLC contract to ${config.network}...`));
  
  // Validate balance first
  spinner.start('Checking account balance...');
  
  try {
    // Change to EVM contracts directory
    process.chdir('contracts/evm');
    
    // Install dependencies if needed
    if (!existsSync('node_modules')) {
      spinner.text = 'Installing dependencies...';
      execSync('pnpm install', { stdio: 'inherit' });
    }
    
    // Compile contracts
    spinner.text = 'Compiling contracts...';
    execSync('pnpm hardhat compile', { stdio: 'inherit' });
    
    // Deploy
    spinner.text = `Deploying to ${config.network}...`;
    const deployCommand = `pnpm hardhat run scripts/evm-deploy.ts --network ${config.network}`;
    
    console.log(chalk.gray(`\nRunning: ${deployCommand}`));
    execSync(deployCommand, { stdio: 'inherit' });
    
    spinner.succeed(`Contract deployed to ${config.network} successfully!`);
    
    // Go back to root directory
    process.chdir('../..');
    
    // Verify the deployment
    await verifyDeployment(config.network);
    
  } catch (error) {
    spinner.fail('Deployment failed');
    process.chdir('../..');
    throw error;
  }
}

async function verifyDeployment(network: string): Promise<void> {
  console.log(chalk.blue('\n🔍 Verifying deployment...'));
  
  // Check deployment file
  const deploymentFile = join('contracts', 'evm', 'deployments', `htlc-${getChainId(network)}.json`);
  
  if (existsSync(deploymentFile)) {
    const deployment = JSON.parse(readFileSync(deploymentFile, 'utf8'));
    console.log(chalk.green('✅ Deployment file found'));
    console.log(`   Contract Address: ${chalk.cyan(deployment.address)}`);
    console.log(`   Chain ID: ${chalk.yellow(deployment.chainId)}`);
    console.log(`   Deployer: ${chalk.gray(deployment.deployer)}`);
    
    // Update .env.local with the Sepolia address
    if (network === 'sepolia') {
      await updateEnvFile({
        SEPOLIA_HTLC_ADDRESS: deployment.address
      });
      console.log(chalk.green('✅ Updated .env.local with Sepolia contract address'));
    }
    
  } else {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }
}

async function verifySetup(): Promise<void> {
  console.log(chalk.blue('🔍 Verifying deployment setup...\n'));
  
  const envPath = join(process.cwd(), '.env.local');
  
  if (!existsSync(envPath)) {
    console.log(chalk.red('❌ .env.local file not found'));
    console.log(chalk.yellow('   Run: npm run deploy-setup setup'));
    return;
  }
  
  const envContent = readFileSync(envPath, 'utf8');
  const env = parseEnvFile(envContent);
  
  // Check Sepolia configuration
  console.log(chalk.white('📋 Sepolia Configuration:'));
  checkEnvVar('SEPOLIA_HTLC_ADDRESS', env.SEPOLIA_HTLC_ADDRESS, '0x followed by 40 hex characters');
  checkEnvVar('PRIVATE_KEY', env.PRIVATE_KEY ? '***configured***' : undefined, '64 hex characters');
  checkEnvVar('SEPOLIA_RPC_URL', env.SEPOLIA_RPC_URL, 'HTTP/HTTPS URL');
  
  // Check Cosmos configuration  
  console.log(chalk.white('\n📋 Cosmos Configuration:'));
  checkEnvVar('COSMOS_HTLC_ADDRESS', env.COSMOS_HTLC_ADDRESS, 'cosmos1... address');
  checkEnvVar('COSMOS_CHAIN_ID', env.COSMOS_CHAIN_ID, 'Chain identifier');
  checkEnvVar('COSMOS_CODE_ID', env.COSMOS_CODE_ID, 'Contract code ID');
  
  // Check deployment files
  console.log(chalk.white('\n📋 Deployment Files:'));
  
  const sepoliaDeployment = join('contracts', 'evm', 'deployments', 'htlc-11155111.json');
  if (existsSync(sepoliaDeployment)) {
    console.log(chalk.green('   ✅ Sepolia deployment file found'));
  } else {
    console.log(chalk.red('   ❌ Sepolia deployment file missing'));
    console.log(chalk.yellow('      Run: npm run deploy-setup deploy --network sepolia'));
  }
  
  const localDeployment = join('contracts', 'evm', 'deployments', 'htlc-31337.json');
  if (existsSync(localDeployment)) {
    console.log(chalk.green('   ✅ Local deployment file found'));
  } else {
    console.log(chalk.yellow('   ⚠️  Local deployment file missing (optional)'));
  }
  
  // Final status
  const hasSepoliaAddress = env.SEPOLIA_HTLC_ADDRESS && env.SEPOLIA_HTLC_ADDRESS.match(/^0x[a-fA-F0-9]{40}$/);
  const hasPrivateKey = env.PRIVATE_KEY && env.PRIVATE_KEY.length === 64;
  
  if (hasSepoliaAddress && hasPrivateKey) {
    console.log(chalk.green('\n🎉 Setup appears to be complete!'));
    console.log(chalk.white('You can now run: pnpm cli:swap swap'));
  } else {
    console.log(chalk.yellow('\n⚠️  Setup incomplete. Please resolve the issues above.'));
  }
}

async function updateEnvironment(): Promise<void> {
  console.log(chalk.blue('⚙️  Updating environment configuration...\n'));
  
  const { updates } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'updates',
      message: 'What would you like to update?',
      choices: [
        { name: 'Private Key', value: 'private-key' },
        { name: 'Sepolia RPC URL', value: 'sepolia-rpc' },
        { name: 'Sepolia HTLC Address', value: 'sepolia-address' },
        { name: 'Etherscan API Key', value: 'etherscan-key' }
      ]
    }
  ]);
  
  const updateQuestions = [];
  
  if (updates.includes('private-key')) {
    updateQuestions.push({
      type: 'password',
      name: 'privateKey',
      message: 'Enter new private key (0x...):',
      mask: '*'
    });
  }
  
  if (updates.includes('sepolia-rpc')) {
    updateQuestions.push({
      type: 'input',
      name: 'sepoliaRpc',
      message: 'Enter Sepolia RPC URL:'
    });
  }
  
  if (updates.includes('sepolia-address')) {
    updateQuestions.push({
      type: 'input',
      name: 'sepoliaAddress',
      message: 'Enter Sepolia HTLC contract address (0x...):'
    });
  }
  
  if (updates.includes('etherscan-key')) {
    updateQuestions.push({
      type: 'input',
      name: 'etherscanKey',
      message: 'Enter Etherscan API key:'
    });
  }
  
  if (updateQuestions.length === 0) {
    console.log(chalk.yellow('No updates selected.'));
    return;
  }
  
  const answers = await inquirer.prompt(updateQuestions);
  
  const envUpdates: Record<string, string> = {};
  
  if (answers.privateKey) {
    envUpdates.PRIVATE_KEY = answers.privateKey.replace('0x', '');
  }
  if (answers.sepoliaRpc) {
    envUpdates.SEPOLIA_RPC_URL = answers.sepoliaRpc;
  }
  if (answers.sepoliaAddress) {
    envUpdates.SEPOLIA_HTLC_ADDRESS = answers.sepoliaAddress;
  }
  if (answers.etherscanKey) {
    envUpdates.ETHERSCAN_API_KEY = answers.etherscanKey;
  }
  
  await updateEnvFile(envUpdates);
  console.log(chalk.green('✅ Environment updated successfully'));
}

function showInstructions(): void {
  console.log(chalk.blue('\n📋 Manual Deployment Instructions'));
  console.log(chalk.gray('═'.repeat(50)));
  
  console.log(chalk.white('\n1. Environment Setup:'));
  console.log('   • Copy .env.local.example to .env.local');
  console.log('   • Add your private key (without 0x prefix)');
  console.log('   • Add Sepolia RPC URL');
  console.log('   • Add Etherscan API key (optional)');
  
  console.log(chalk.white('\n2. Deploy to Sepolia:'));
  console.log('   cd contracts/evm');
  console.log('   pnpm install');
  console.log('   pnpm hardhat compile');
  console.log('   pnpm hardhat run scripts/evm-deploy.ts --network sepolia');
  
  console.log(chalk.white('\n3. Verify Setup:'));
  console.log('   cd ../.. # back to root');
  console.log('   npm run deploy-setup verify');
  
  console.log(chalk.white('\n4. Test CLI:'));
  console.log('   pnpm cli:swap swap --dry-run');
  
  console.log(chalk.green('\n✨ That\'s it! Your cross-chain swap CLI should be ready.'));
}

// Helper functions
function getChainId(network: string): number {
  switch (network) {
    case 'sepolia': return 11155111;
    case 'goerli': return 5;
    case 'local': return 31337;
    default: throw new Error(`Unknown network: ${network}`);
  }
}

function checkEnvVar(name: string, value: string | undefined, description: string): void {
  if (value && value.trim() !== '') {
    console.log(chalk.green(`   ✅ ${name}: configured`));
  } else {
    console.log(chalk.red(`   ❌ ${name}: missing (${description})`));
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      result[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return result;
}

async function updateEnvFile(updates: Record<string, string>): Promise<void> {
  const envPath = join(process.cwd(), '.env.local');
  let content = '';
  
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf8');
  }
  
  // Update existing values or add new ones
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (content.match(regex)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  });
  
  writeFileSync(envPath, content.trim() + '\n');
}

async function promptForDeployment(options: any): Promise<DeploymentConfig> {
  const questions = [];
  
  if (!options.network) {
    questions.push({
      type: 'list',
      name: 'network',
      message: 'Select network to deploy to:',
      choices: [
        { name: 'Sepolia Testnet', value: 'sepolia' },
        { name: 'Goerli Testnet', value: 'goerli' },
        { name: 'Local Hardhat', value: 'local' }
      ]
    });
  }
  
  if (!options.privateKey) {
    questions.push({
      type: 'password',
      name: 'privateKey',
      message: 'Enter private key for deployment (0x...):',
      mask: '*'
    });
  }
  
  if (!options.rpcUrl) {
    questions.push({
      type: 'input',
      name: 'rpcUrl',
      message: 'Enter RPC URL (optional):',
      default: ''
    });
  }
  
  const answers = await inquirer.prompt(questions);
  
  return {
    network: options.network || answers.network,
    privateKey: options.privateKey || answers.privateKey,
    rpcUrl: options.rpcUrl || answers.rpcUrl,
  };
}

// Main execution
if (require.main === module) {
  program.parse();
}

export { program };