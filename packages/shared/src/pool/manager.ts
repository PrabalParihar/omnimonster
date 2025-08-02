import { ethers } from 'ethers';
import { FusionDatabase, FusionDAO, PoolLiquidity, SupportedToken } from '../database';
import { EventEmitter } from 'events';

export interface PoolConfig {
  rpcUrl: string;
  chainId: number;
  ownerPrivateKey: string;
  rebalanceThreshold: number; // Percentage threshold for rebalancing
  minLiquidityUSD: number; // Minimum liquidity in USD
  maxSlippagePercent: number; // Maximum allowed slippage
}

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  balance: string;
  balanceUSD: number;
  decimals: number;
}

export interface RebalanceRecommendation {
  tokenAddress: string;
  symbol: string;
  currentBalance: string;
  targetBalance: string;
  action: 'ADD' | 'REMOVE';
  amountUSD: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class FusionPoolManager extends EventEmitter {
  private dao: FusionDAO;
  private provider: ethers.JsonRpcProvider;
  private ownerWallet: ethers.Wallet;
  private supportedTokens: Map<string, SupportedToken> = new Map();

  constructor(
    private config: PoolConfig,
    database: FusionDatabase
  ) {
    super();
    this.dao = new FusionDAO(database);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.ownerWallet = new ethers.Wallet(config.ownerPrivateKey, this.provider);
  }

  /**
   * Initialize the pool manager
   */
  async initialize(): Promise<void> {
    console.log('Initializing Fusion Pool Manager...');
    
    // Load supported tokens
    await this.loadSupportedTokens();
    
    // Initialize pool liquidity tracking for all supported tokens
    await this.initializePoolLiquidity();
    
    console.log(`Pool manager initialized for ${this.supportedTokens.size} tokens`);
    this.emit('initialized');
  }

  /**
   * Load supported tokens from database
   */
  private async loadSupportedTokens(): Promise<void> {
    const tokens = await this.dao.getSupportedTokens(this.config.chainId);
    
    this.supportedTokens.clear();
    for (const token of tokens) {
      this.supportedTokens.set(token.tokenAddress.toLowerCase(), token);
    }
    
    console.log(`Loaded ${tokens.length} supported tokens`);
  }

  /**
   * Initialize pool liquidity tracking
   */
  private async initializePoolLiquidity(): Promise<void> {
    for (const [address, token] of this.supportedTokens) {
      try {
        // Check if liquidity record exists
        let liquidity = await this.dao.getPoolLiquidity(address);
        
        if (!liquidity) {
          // Create initial liquidity record
          const balance = await this.getTokenBalance(address);
          
          await this.dao.updatePoolLiquidity(address, {
            tokenAddress: address,
            totalBalance: balance,
            availableBalance: balance,
            reservedBalance: '0',
            minThreshold: token.minSwapAmount
          });
          
          console.log(`Initialized liquidity tracking for ${token.symbol}: ${balance}`);
        }
      } catch (error) {
        console.error(`Failed to initialize liquidity for ${token.symbol}:`, error);
      }
    }
  }

  /**
   * Get token balance from blockchain
   */
  private async getTokenBalance(tokenAddress: string): Promise<string> {
    if (tokenAddress === ethers.ZeroAddress) {
      // ETH balance
      const balance = await this.provider.getBalance(this.ownerWallet.address);
      return balance.toString();
    } else {
      // ERC20 balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) external view returns (uint256)'],
        this.provider
      );
      
      const balance = await tokenContract.balanceOf(this.ownerWallet.address);
      return balance.toString();
    }
  }

  /**
   * Update pool liquidity from blockchain
   */
  async updatePoolLiquidity(tokenAddress: string): Promise<PoolLiquidity> {
    const token = this.supportedTokens.get(tokenAddress.toLowerCase());
    if (!token) {
      throw new Error(`Token ${tokenAddress} not supported`);
    }

    const balance = await this.getTokenBalance(tokenAddress);
    const currentLiquidity = await this.dao.getPoolLiquidity(tokenAddress);
    
    if (!currentLiquidity) {
      throw new Error(`Liquidity record not found for ${tokenAddress}`);
    }

    // Calculate available balance (total - reserved)
    const totalBalance = BigInt(balance);
    const reservedBalance = BigInt(currentLiquidity.reservedBalance);
    const availableBalance = totalBalance - reservedBalance;

    const updatedLiquidity = await this.dao.updatePoolLiquidity(tokenAddress, {
      tokenAddress,
      totalBalance: totalBalance.toString(),
      availableBalance: availableBalance.toString(),
      reservedBalance: currentLiquidity.reservedBalance,
      minThreshold: currentLiquidity.minThreshold
    });

    this.emit('liquidityUpdated', tokenAddress, updatedLiquidity);
    return updatedLiquidity;
  }

  /**
   * Get all pool balances
   */
  async getAllPoolBalances(): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    
    for (const [address, token] of this.supportedTokens) {
      try {
        const liquidity = await this.dao.getPoolLiquidity(address);
        if (liquidity) {
          const balanceNum = parseFloat(liquidity.totalBalance) / Math.pow(10, token.decimals);
          
          // Get USD value (simplified - would integrate with price feeds)
          const balanceUSD = balanceNum * 1; // Placeholder for price lookup
          
          balances.push({
            tokenAddress: address,
            symbol: token.symbol,
            balance: liquidity.totalBalance,
            balanceUSD,
            decimals: token.decimals
          });
        }
      } catch (error) {
        console.error(`Error getting balance for ${token.symbol}:`, error);
      }
    }
    
    return balances;
  }

  /**
   * Check liquidity levels and get rebalance recommendations
   */
  async getRebalanceRecommendations(): Promise<RebalanceRecommendation[]> {
    const recommendations: RebalanceRecommendation[] = [];
    
    for (const [address, token] of this.supportedTokens) {
      try {
        const liquidity = await this.dao.getPoolLiquidity(address);
        if (!liquidity) continue;

        const totalBalance = BigInt(liquidity.totalBalance);
        const minThreshold = BigInt(liquidity.minThreshold);
        const balanceNum = parseFloat(liquidity.totalBalance) / Math.pow(10, token.decimals);
        const thresholdNum = parseFloat(liquidity.minThreshold) / Math.pow(10, token.decimals);
        
        // Check if below minimum threshold
        if (totalBalance < minThreshold) {
          const needed = thresholdNum - balanceNum;
          const neededUSD = needed * 1; // Placeholder for price conversion
          
          recommendations.push({
            tokenAddress: address,
            symbol: token.symbol,
            currentBalance: liquidity.totalBalance,
            targetBalance: liquidity.minThreshold,
            action: 'ADD',
            amountUSD: neededUSD,
            priority: neededUSD > this.config.minLiquidityUSD ? 'HIGH' : 'MEDIUM'
          });
        }
        
        // Check if too much liquidity (could be used elsewhere)
        const maxRecommendedBalance = minThreshold * BigInt(5); // 5x minimum
        if (totalBalance > maxRecommendedBalance) {
          const excess = balanceNum - (thresholdNum * 5);
          const excessUSD = excess * 1; // Placeholder for price conversion
          
          recommendations.push({
            tokenAddress: address,
            symbol: token.symbol,
            currentBalance: liquidity.totalBalance,
            targetBalance: maxRecommendedBalance.toString(),
            action: 'REMOVE',
            amountUSD: excessUSD,
            priority: 'LOW'
          });
        }
        
      } catch (error) {
        console.error(`Error analyzing ${token.symbol} liquidity:`, error);
      }
    }
    
    // Sort by priority and amount
    recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.amountUSD - a.amountUSD;
    });
    
    return recommendations;
  }

  /**
   * Add liquidity to the pool
   */
  async addLiquidity(tokenAddress: string, amount: string): Promise<void> {
    const token = this.supportedTokens.get(tokenAddress.toLowerCase());
    if (!token) {
      throw new Error(`Token ${tokenAddress} not supported`);
    }

    try {
      if (tokenAddress === ethers.ZeroAddress) {
        // ETH - just need to have it in wallet
        const balance = await this.provider.getBalance(this.ownerWallet.address);
        if (balance < BigInt(amount)) {
          throw new Error('Insufficient ETH balance');
        }
      } else {
        // ERC20 - transfer to pool wallet if needed
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            'function balanceOf(address) external view returns (uint256)',
            'function transfer(address to, uint256 amount) external returns (bool)'
          ],
          this.ownerWallet
        );
        
        const balance = await tokenContract.balanceOf(this.ownerWallet.address);
        if (balance < BigInt(amount)) {
          throw new Error(`Insufficient ${token.symbol} balance`);
        }
      }

      // Update liquidity tracking
      await this.updatePoolLiquidity(tokenAddress);
      
      console.log(`Added ${amount} ${token.symbol} to pool`);
      this.emit('liquidityAdded', tokenAddress, amount);
      
    } catch (error) {
      console.error(`Failed to add liquidity for ${token.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Remove liquidity from the pool
   */
  async removeLiquidity(tokenAddress: string, amount: string): Promise<void> {
    const token = this.supportedTokens.get(tokenAddress.toLowerCase());
    if (!token) {
      throw new Error(`Token ${tokenAddress} not supported`);
    }

    const liquidity = await this.dao.getPoolLiquidity(tokenAddress);
    if (!liquidity) {
      throw new Error(`No liquidity record for ${token.symbol}`);
    }

    const availableBalance = BigInt(liquidity.availableBalance);
    if (availableBalance < BigInt(amount)) {
      throw new Error(`Insufficient available ${token.symbol} liquidity`);
    }

    try {
      if (tokenAddress === ethers.ZeroAddress) {
        // ETH transfer
        const tx = await this.ownerWallet.sendTransaction({
          to: this.ownerWallet.address, // Or to external address
          value: amount,
          gasLimit: 21000
        });
        await tx.wait();
      } else {
        // ERC20 transfer  
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function transfer(address to, uint256 amount) external returns (bool)'],
          this.ownerWallet
        );
        
        const tx = await tokenContract.transfer(this.ownerWallet.address, amount);
        await tx.wait();
      }

      // Update liquidity tracking
      await this.updatePoolLiquidity(tokenAddress);
      
      console.log(`Removed ${amount} ${token.symbol} from pool`);
      this.emit('liquidityRemoved', tokenAddress, amount);
      
    } catch (error) {
      console.error(`Failed to remove liquidity for ${token.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get pool statistics and health metrics
   */
  async getPoolStats(): Promise<{
    totalValueUSD: number;
    tokenCount: number;
    healthScore: number;
    utilizationRate: number;
    lowLiquidityTokens: string[];
  }> {
    const balances = await this.getAllPoolBalances();
    const recommendations = await this.getRebalanceRecommendations();
    
    const totalValueUSD = balances.reduce((sum, b) => sum + b.balanceUSD, 0);
    const lowLiquidityTokens = recommendations
      .filter(r => r.action === 'ADD' && r.priority === 'HIGH')
      .map(r => r.symbol);
    
    // Calculate utilization rate (simplified)
    let totalReserved = 0;
    let totalAvailable = 0;
    
    for (const [address] of this.supportedTokens) {
      const liquidity = await this.dao.getPoolLiquidity(address);
      if (liquidity) {
        totalReserved += parseFloat(liquidity.reservedBalance);
        totalAvailable += parseFloat(liquidity.availableBalance);
      }
    }
    
    const utilizationRate = totalReserved / (totalReserved + totalAvailable);
    
    // Health score based on liquidity levels and balance distribution
    const healthScore = Math.max(0, Math.min(100, 
      100 - (lowLiquidityTokens.length * 20) - (utilizationRate > 0.8 ? 20 : 0)
    ));
    
    return {
      totalValueUSD,
      tokenCount: this.supportedTokens.size,
      healthScore,
      utilizationRate,
      lowLiquidityTokens
    };
  }

  /**
   * Emergency drain all liquidity
   */
  async emergencyDrain(recipientAddress: string): Promise<void> {
    console.log(`Emergency drain initiated to ${recipientAddress}`);
    
    for (const [address, token] of this.supportedTokens) {
      try {
        const balance = await this.getTokenBalance(address);
        
        if (BigInt(balance) > 0) {
          if (address === ethers.ZeroAddress) {
            // ETH transfer
            const tx = await this.ownerWallet.sendTransaction({
              to: recipientAddress,
              value: balance,
              gasLimit: 21000
            });
            await tx.wait();
          } else {
            // ERC20 transfer
            const tokenContract = new ethers.Contract(
              address,
              ['function transfer(address to, uint256 amount) external returns (bool)'],
              this.ownerWallet
            );
            
            const tx = await tokenContract.transfer(recipientAddress, balance);
            await tx.wait();
          }
          
          console.log(`Drained ${balance} ${token.symbol}`);
        }
      } catch (error) {
        console.error(`Failed to drain ${token.symbol}:`, error);
      }
    }
    
    this.emit('emergencyDrain', recipientAddress);
  }

  /**
   * Refresh all pool data
   */
  async refresh(): Promise<void> {
    await this.loadSupportedTokens();
    
    for (const [address] of this.supportedTokens) {
      try {
        await this.updatePoolLiquidity(address);
      } catch (error) {
        console.error(`Failed to refresh liquidity for ${address}:`, error);
      }
    }
    
    this.emit('refreshed');
  }
}

export default FusionPoolManager;