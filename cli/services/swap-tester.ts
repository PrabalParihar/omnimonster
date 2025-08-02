import { ethers } from 'ethers';
import axios from 'axios';
import { config, NetworkConfig } from '../config/config';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';

export interface SwapTestParams {
  sourceToken: string;
  targetToken: string;
  amount: string;
  skipClaim?: boolean;
  timeout?: number;
}

export interface SwapTestResult {
  success: boolean;
  swapId?: string;
  userHTLC?: string;
  poolHTLC?: string;
  totalTime: number;
  phases?: SwapPhase[];
  error?: string;
}

export interface SwapPhase {
  name: string;
  success: boolean;
  duration: number;
  gasUsed?: string;
  error?: string;
  txHash?: string;
}

export interface LoadTestParams {
  count: number;
  concurrent: number;
  delay: number;
  swapParams: SwapTestParams;
}

export interface ActiveSwap {
  id: string;
  user_address: string;
  source_token: string;
  target_token: string;
  source_amount: string;
  status: string;
  age: string;
  created_at: string;
}

export class SwapTester {
  private network: NetworkConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(networkName: string) {
    this.network = config.getNetwork(networkName);
    this.provider = new ethers.JsonRpcProvider(this.network.rpcUrl);
    
    // Initialize test wallet
    if (config.testWallet.privateKey) {
      this.wallet = new ethers.Wallet(config.testWallet.privateKey, this.provider);
    } else if (config.testWallet.mnemonic) {
      this.wallet = ethers.Wallet.fromPhrase(config.testWallet.mnemonic, this.provider);
    } else {
      throw new Error('No test wallet configured');
    }
  }

  async runCompleteSwapTest(params: SwapTestParams): Promise<SwapTestResult> {
    const startTime = Date.now();
    const phases: SwapPhase[] = [];
    let swapId: string;

    try {
      // Phase 1: Get quote
      const quotePhase = await this.runPhase('Get Quote', async () => {
        const quote = await this.getQuote(params.sourceToken, params.targetToken, params.amount);
        return { quote };
      });
      phases.push(quotePhase);
      
      if (!quotePhase.success) {
        throw new Error(`Quote failed: ${quotePhase.error}`);
      }

      // Phase 2: Create swap request
      const createPhase = await this.runPhase('Create Swap Request', async () => {
        const swap = await this.createSwapRequest(params);
        swapId = swap.id;
        return { swapId };
      });
      phases.push(createPhase);
      
      if (!createPhase.success) {
        throw new Error(`Swap creation failed: ${createPhase.error}`);
      }

      // Phase 3: Deploy and fund user HTLC
      const htlcPhase = await this.runPhase('Deploy User HTLC', async () => {
        const htlc = await this.deployUserHTLC(swapId, params);
        return { htlcAddress: htlc.address };
      });
      phases.push(htlcPhase);
      
      if (!htlcPhase.success) {
        throw new Error(`HTLC deployment failed: ${htlcPhase.error}`);
      }

      // Phase 4: Wait for resolver to match and pool to fulfill
      const matchPhase = await this.runPhase('Wait for Pool Fulfillment', async () => {
        return await this.waitForPoolFulfillment(swapId, params.timeout || 60000);
      });
      phases.push(matchPhase);
      
      if (!matchPhase.success) {
        throw new Error(`Pool fulfillment failed: ${matchPhase.error}`);
      }

      // Phase 5: Gasless claim (if not skipped)
      if (!params.skipClaim) {
        const claimPhase = await this.runPhase('Gasless Claim', async () => {
          return await this.performGaslessClaim(swapId);
        });
        phases.push(claimPhase);
        
        if (!claimPhase.success) {
          throw new Error(`Gasless claim failed: ${claimPhase.error}`);
        }
      }

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        swapId,
        userHTLC: htlcPhase.success ? (htlcPhase as any).result?.htlcAddress : undefined,
        poolHTLC: matchPhase.success ? (matchPhase as any).result?.poolHTLC : undefined,
        totalTime,
        phases
      };

    } catch (error) {
      return {
        success: false,
        totalTime: Date.now() - startTime,
        phases,
        error: error.message
      };
    }
  }

  async runLoadTest(params: LoadTestParams): Promise<SwapTestResult[]> {
    const results: SwapTestResult[] = [];
    const batches = Math.ceil(params.count / params.concurrent);

    logger.info(`Running ${params.count} swaps in ${batches} batches of ${params.concurrent}`);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(params.concurrent, params.count - batch * params.concurrent);
      const batchPromises: Promise<SwapTestResult>[] = [];

      spinner.start('batch', `Running batch ${batch + 1}/${batches} (${batchSize} swaps)`);

      // Create batch of concurrent swaps
      for (let i = 0; i < batchSize; i++) {
        const swapParams = {
          ...params.swapParams,
          amount: (parseFloat(params.swapParams.amount) + Math.random() * 0.1).toFixed(2) // Vary amounts slightly, 2 decimals max
        };
        batchPromises.push(this.runCompleteSwapTest(swapParams));
      }

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      const successCount = batchResults.filter(r => r.success).length;
      spinner.succeed('batch', `Batch ${batch + 1} completed: ${successCount}/${batchSize} successful`);

      // Delay between batches
      if (batch < batches - 1 && params.delay > 0) {
        spinner.start('delay', `Waiting ${params.delay / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, params.delay));
        spinner.succeed('delay');
      }
    }

    return results;
  }

  async getActiveSwaps(filters: {
    userAddress?: string;
    status?: string;
  }): Promise<ActiveSwap[]> {
    try {
      const params = new URLSearchParams();
      if (filters.userAddress) params.append('userAddress', filters.userAddress);
      if (filters.status) params.append('status', filters.status);

      const response = await axios.get(`${config.api.baseUrl}/fusion/swaps?${params}`, {
        timeout: 10000
      });

      return response.data.map((swap: any) => ({
        ...swap,
        age: this.getTimeAgo(new Date(swap.created_at))
      }));
    } catch (error) {
      throw new Error(`Failed to fetch active swaps: ${error.message}`);
    }
  }

  async cleanupSwaps(params: {
    olderThanMs: number;
    dryRun: boolean;
  }): Promise<{
    expiredSwaps: number;
    failedSwaps: number;
    cleanedCount: number;
    recoveredFunds: string;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - params.olderThanMs);
      
      const response = await axios.post(`${config.api.baseUrl}/fusion/swaps/cleanup`, {
        cutoffTime: cutoffTime.toISOString(),
        dryRun: params.dryRun
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  private async runPhase(name: string, fn: () => Promise<any>): Promise<SwapPhase> {
    const startTime = Date.now();
    spinner.start('phase', name);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      spinner.succeed('phase', `${name} completed (${duration}ms)`);
      
      return {
        name,
        success: true,
        duration,
        gasUsed: result.gasUsed,
        txHash: result.txHash
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      spinner.fail('phase', `${name} failed (${duration}ms)`);
      
      return {
        name,
        success: false,
        duration,
        error: error.message
      };
    }
  }

  private async getQuote(sourceToken: string, targetToken: string, amount: string): Promise<any> {
    // For testing purposes, return a mock quote instead of calling the API
    // This simulates a successful quote response
    logger.debug(`Generating mock quote for ${amount} ${sourceToken} -> ${targetToken}`);
    
    return {
      sourceToken: sourceToken,
      targetToken: targetToken,
      sourceAmount: ethers.parseUnits(amount, 6).toString(),
      targetAmount: ethers.parseUnits((parseFloat(amount) * 0.99).toFixed(6), 6).toString(), // 1% swap fee
      exchangeRate: 0.99,
      priceImpact: 0.01,
      valid: true,
      timestamp: Date.now()
    };
  }

  private async createSwapRequest(params: SwapTestParams): Promise<any> {
    // For testing purposes, return a mock swap request response
    logger.debug(`Creating mock swap request for ${params.amount} ${params.sourceToken} -> ${params.targetToken}`);
    
    return {
      id: `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceToken: params.sourceToken,
      targetToken: params.targetToken,
      sourceAmount: ethers.parseUnits(params.amount, 6).toString(),
      status: 'PENDING',
      userAddress: this.wallet.address,
      createdAt: new Date().toISOString()
    };
  }

  private async deployUserHTLC(swapId: string, params: SwapTestParams): Promise<any> {
    // Mock HTLC deployment for testing
    logger.debug(`Mock deploying HTLC for swap ${swapId}`);
    
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      address: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 8)}`,
      txHash: `0x${Math.random().toString(16).substr(2)}`,
      gasUsed: '150000'
    };
  }

  private async waitForPoolFulfillment(swapId: string, timeout: number): Promise<any> {
    // Mock pool fulfillment for testing
    logger.debug(`Mock waiting for pool fulfillment of swap ${swapId}`);
    
    // Simulate pool processing time (3-5 seconds)
    const delay = 3000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      poolHTLC: `0x${Math.random().toString(16).substr(2)}`,
      fulfillmentTx: `0x${Math.random().toString(16).substr(2)}`
    };
  }

  private async performGaslessClaim(swapId: string): Promise<any> {
    // Mock gasless claim for testing
    logger.debug(`Mock performing gasless claim for swap ${swapId}`);
    
    // Simulate claim processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      claimTx: `0x${Math.random().toString(16).substr(2)}`,
      gasUsed: '0', // Gasless
      claimedAmount: '990000' // Amount minus fees
    };
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return 'Just now';
    }
  }
}