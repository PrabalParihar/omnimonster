#!/usr/bin/env tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables from multiple locations
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

interface SwapConfig {
  sourceChain: {
    name: string;
    chainId: number;
    rpcUrl: string;
    token: {
      name: string;
      address: string;
      symbol: string;
    };
    htlcContract: string;
  };
  destinationChain: {
    name: string;
    chainId: number;
    rpcUrl: string;
    token: {
      name: string;
      address: string;
      symbol: string;
    };
    htlcContract: string;
  };
  amount: string;
  destinationAddress: string;
  slippage: number;
}

// Token configurations
const MONSTER_TOKEN_SEPOLIA = {
  name: 'Monster Token',
  address: (process.env.SEPOLIA_MONSTER_TOKEN || '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E').toLowerCase(),
  symbol: 'MONSTER'
};

const OMNI_TOKEN_MONAD = {
  name: 'Omni Token', 
  address: (process.env.MONAD_OMNI_TOKEN || '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3').toLowerCase(),
  symbol: 'OMNI'
};

// Cross-chain swap configurations
export const CROSS_CHAIN_SWAPS = {
  monsterToOmni: {
    sourceChain: {
      name: 'Sepolia',
      chainId: 11155111,
      rpcUrl: process.env.SEPOLIA_RPC_URL!,
      token: MONSTER_TOKEN_SEPOLIA,
      htlcContract: process.env.SEPOLIA_FUSION_HTLC_CONTRACT!
    },
    destinationChain: {
      name: 'Monad Testnet',
      chainId: 41454,
      rpcUrl: process.env.MONAD_RPC_URL!,
      token: OMNI_TOKEN_MONAD,
      htlcContract: process.env.MONAD_FUSION_HTLC_CONTRACT!
    }
  },
  omniToMonster: {
    sourceChain: {
      name: 'Monad Testnet', 
      chainId: 41454,
      rpcUrl: process.env.MONAD_RPC_URL!,
      token: OMNI_TOKEN_MONAD,
      htlcContract: process.env.MONAD_FUSION_HTLC_CONTRACT!
    },
    destinationChain: {
      name: 'Sepolia',
      chainId: 11155111,
      rpcUrl: process.env.SEPOLIA_RPC_URL!,
      token: MONSTER_TOKEN_SEPOLIA,
      htlcContract: process.env.SEPOLIA_FUSION_HTLC_CONTRACT!
    }
  }
};

class CrossChainSwapTester {
  private sourceProvider: ethers.JsonRpcProvider;
  private destinationProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(private config: SwapConfig) {
    this.sourceProvider = new ethers.JsonRpcProvider(config.sourceChain.rpcUrl);
    this.destinationProvider = new ethers.JsonRpcProvider(config.destinationChain.rpcUrl);
    
    const privateKey = process.env.TEST_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('TEST_WALLET_PRIVATE_KEY environment variable is required');
    }
    
    this.wallet = new ethers.Wallet(privateKey);
  }

  async executeSwap(): Promise<void> {
    console.log(chalk.cyan.bold('🌉 Cross-Chain Swap Test'));
    console.log(chalk.gray('================================'));
    console.log();
    
    console.log(chalk.blue(`Source: ${this.config.sourceChain.name} (${this.config.sourceChain.token.symbol})`));
    console.log(chalk.green(`Destination: ${this.config.destinationChain.name} (${this.config.destinationChain.token.symbol})`));
    console.log(chalk.yellow(`Amount: ${this.config.amount}`));
    console.log(chalk.magenta(`Destination Address: ${this.config.destinationAddress}`));
    console.log();

    try {
      // Step 0: Initialize database and create user
      console.log(chalk.blue('🗄️ Step 0: Setting up database and user...'));
      await this.setupUserAndDatabase();
      console.log(chalk.green('✅ Database and user setup complete'));
      console.log();

      // Step 1: Create swap request in database
      console.log(chalk.blue('📝 Step 1: Creating swap request...'));
      const swapRequest = await this.createSwapRequest();
      console.log(chalk.green(`✅ Swap request created: ${swapRequest.id}`));
      console.log();

      // Step 2: Deploy and fund User HTLC on source chain
      console.log(chalk.blue('🔒 Step 2: Deploying User HTLC on source chain...'));
      const userHTLC = await this.deployUserHTLC(swapRequest);
      console.log(chalk.green(`✅ User HTLC deployed: ${userHTLC.address}`));
      console.log();

      // Step 3: Wait for resolver to detect and match
      console.log(chalk.blue('🔍 Step 3: Waiting for resolver to detect swap...'));
      await this.waitForResolverMatching(swapRequest.id);
      console.log(chalk.green('✅ Resolver matched swap with pool'));
      console.log();

      // Step 4: Wait for pool fulfillment
      console.log(chalk.blue('🏊 Step 4: Waiting for pool fulfillment...'));
      const poolHTLC = await this.waitForPoolFulfillment(swapRequest.id);
      console.log(chalk.green(`✅ Pool HTLC deployed: ${poolHTLC.address}`));
      console.log();

      // Step 5: Gasless claim
      console.log(chalk.blue('⚡ Step 5: Initiating gasless claim...'));
      const claimResult = await this.performGaslessClaim(swapRequest.id, poolHTLC.preimage);
      console.log(chalk.green(`✅ Gasless claim completed: ${claimResult.txHash}`));
      console.log();

      console.log(chalk.green.bold('🎉 Cross-chain swap completed successfully!'));
      console.log(chalk.gray(`Total time: ${Date.now() - swapRequest.createdAt}ms`));

    } catch (error) {
      console.error(chalk.red('❌ Cross-chain swap failed:'), error);
      process.exit(1);
    }
  }

  private async setupUserAndDatabase(): Promise<void> {
    // Create user in database
    console.log(chalk.gray('  Ensuring user exists in database...'));
    const userData = {
      web3authUserId: `test-user-${this.wallet.address}`,
      walletAddress: this.wallet.address,
      loginProvider: 'METAMASK',
      email: 'test@example.com',
      name: 'Test User',
      profileImage: '',
      isSocialLogin: false
    };

    try {
      const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/store-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        // Check if user already exists
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          console.log(chalk.green('  User already exists'));
        } else {
          console.log(chalk.yellow(`  User setup warning: ${errorText}`));
        }
      } else {
        console.log(chalk.green('  User created successfully'));
      }
    } catch (error) {
      console.log(chalk.yellow('  User creation failed, continuing...'));
    }
  }

  private async createSwapRequest(): Promise<any> {
    // For now, use existing API format (single-chain)
    // TODO: Update API to support cross-chain fields
    const swapData = {
      userAddress: this.wallet.address,
      sourceToken: this.config.sourceChain.token.address,
      sourceAmount: ethers.parseEther(this.config.amount).toString(),
      targetToken: this.config.destinationChain.token.address,
      expectedAmount: ethers.parseEther(this.config.amount).toString(), // 1:1 for demo
      slippageTolerance: this.config.slippage,
      expirationTime: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      // Additional cross-chain data (for future API support)
      metadata: {
        sourceChainId: this.config.sourceChain.chainId,
        destinationChainId: this.config.destinationChain.chainId,
        destinationAddress: this.config.destinationAddress,
        crossChain: true
      }
    };

    console.log('Calling API with data:', JSON.stringify(swapData, null, 2));
    console.log('API URL:', `${process.env.NEXT_PUBLIC_API_URL}/fusion/swaps`);

    // Call your API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fusion/swaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(swapData),
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      
      // Let's also check what tokens the API sees
      console.log('Checking token availability...');
      try {
        const tokensResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fusion/tokens`);
        const tokensData = await tokensResponse.json();
        console.log('Available tokens:', tokensData);
      } catch (e) {
        console.log('Could not fetch tokens:', e);
      }
      
      throw new Error(`Failed to create swap request: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async deployUserHTLC(swapRequest: any): Promise<any> {
    const sourceWallet = this.wallet.connect(this.sourceProvider);
    
    // Create HTLC contract call
    const htlcContract = new ethers.Contract(
      this.config.sourceChain.htlcContract,
      ['function fund(bytes32 contractId, address beneficiary, bytes32 hashLock, uint256 timelock) external payable'],
      sourceWallet
    );

    // Generate hash lock and preimage
    const preimage = ethers.randomBytes(32);
    const hashLock = ethers.keccak256(preimage);
    
    const contractId = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'bytes32', 'uint256'],
        [sourceWallet.address, hashLock, swapRequest.expirationTime]
      )
    );

    // Fund the HTLC
    const tx = await htlcContract.fund(
      contractId,
      this.config.destinationAddress, // beneficiary on destination chain
      hashLock,
      swapRequest.expirationTime,
      { value: ethers.parseEther(this.config.amount) }
    );

    await tx.wait();

    return {
      address: this.config.sourceChain.htlcContract,
      contractId,
      preimage: ethers.hexlify(preimage),
      hashLock: ethers.hexlify(hashLock),
      txHash: tx.hash
    };
  }

  private async waitForResolverMatching(swapId: string): Promise<void> {
    const maxWaitTime = 60000; // 1 minute
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fusion/swaps/${swapId}`);
      const swap = await response.json();
      
      if (swap.status === 'MATCHED' || swap.status === 'POOL_FULFILLED') {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
    
    throw new Error('Resolver failed to match swap within timeout');
  }

  private async waitForPoolFulfillment(swapId: string): Promise<any> {
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fusion/swaps/${swapId}`);
      const swap = await response.json();
      
      if (swap.status === 'POOL_FULFILLED') {
        return {
          address: swap.poolHTLCContract,
          preimage: swap.preimage
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    }
    
    throw new Error('Pool failed to fulfill swap within timeout');
  }

  private async performGaslessClaim(swapId: string, preimage: string): Promise<any> {
    const claimData = {
      swapId,
      preimage,
      beneficiary: this.config.destinationAddress
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fusion/claims/gasless`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claimData),
    });

    if (!response.ok) {
      throw new Error(`Gasless claim failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Execute based on command line arguments
async function main() {
  const args = process.argv.slice(2);
  const swapType = args[0];
  const amount = args[1] || '1';
  const destinationAddress = args[2] || process.env.TEST_WALLET_ADDRESS;

  if (!swapType || !['monster-to-omni', 'omni-to-monster'].includes(swapType)) {
    console.error(chalk.red('Usage: npm run swap:cross-chain <monster-to-omni|omni-to-monster> [amount] [destinationAddress]'));
    process.exit(1);
  }

  if (!destinationAddress) {
    console.error(chalk.red('Destination address is required'));
    process.exit(1);
  }

  const swapConfig = swapType === 'monster-to-omni' 
    ? CROSS_CHAIN_SWAPS.monsterToOmni 
    : CROSS_CHAIN_SWAPS.omniToMonster;

  const config: SwapConfig = {
    ...swapConfig,
    amount,
    destinationAddress,
    slippage: 0.5 // 0.5%
  };

  const swapTester = new CrossChainSwapTester(config);
  await swapTester.executeSwap();
}

if (require.main === module) {
  main().catch(console.error);
}

export { CrossChainSwapTester };