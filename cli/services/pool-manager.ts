import axios from 'axios';
import { config, NetworkConfig } from '../config/config';

export interface PoolStatus {
  health: 'healthy' | 'warning' | 'critical';
  totalTokens: number;
  activeReserves: number;
  totalValueUSD: number;
  tokens: TokenStatus[];
  recentActivity: PoolActivity[];
}

export interface TokenStatus {
  address: string;
  symbol: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  usdValue: number;
  status: 'healthy' | 'low' | 'critical';
}

export interface PoolActivity {
  timestamp: string;
  type: 'RESERVE' | 'CLAIM' | 'RELEASE' | 'ADD' | 'REMOVE';
  token: string;
  amount: string;
  txHash?: string;
}

export interface PoolMetrics {
  volume24h: number;
  activeSwaps: number;
  successRate: number;
  avgProcessingTime: number;
}

export interface RebalanceRecommendation {
  action: 'ADD' | 'REMOVE' | 'REDISTRIBUTE';
  token: string;
  amount: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RebalanceAnalysis {
  needsRebalancing: boolean;
  recommendations: RebalanceRecommendation[];
  totalActions: number;
  estimatedCost: string;
}

export class PoolManager {
  private network: NetworkConfig;

  constructor(networkName: string) {
    this.network = config.getNetwork(networkName);
  }

  async getPoolStatus(): Promise<PoolStatus> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/pool/status`, {
        timeout: 10000
      });

      const data = response.data;
      
      // Transform the response structure to match our interface
      const tokens = data.tokens?.map(t => ({
        address: '0x' + t.token.symbol.toLowerCase(), // Mock address for display
        symbol: t.token.symbol,
        totalBalance: t.liquidity?.totalBalance || '0',
        availableBalance: t.liquidity?.availableBalance || '0',
        reservedBalance: t.liquidity?.reservedBalance || '0',
        usdValue: 0, // Would be calculated from price feeds
        status: t.liquidity ? 'healthy' : 'low' as 'healthy' | 'low' | 'critical'
      })) || [];
      
      // Calculate overall health
      const criticalTokens = tokens.filter(t => t.status === 'critical').length;
      const lowTokens = tokens.filter(t => t.status === 'low').length;
      
      let health: 'healthy' | 'warning' | 'critical';
      if (criticalTokens > 0) {
        health = 'critical';
      } else if (lowTokens > 0) {
        health = 'warning';
      } else {
        health = 'healthy';
      }

      return {
        health,
        totalTokens: tokens.length,
        activeReserves: tokens.reduce((sum, t) => sum + parseFloat(t.reservedBalance || '0'), 0),
        totalValueUSD: data.summary?.totalValueUSD || 0,
        tokens,
        recentActivity: data.recentActivity || []
      };
    } catch (error) {
      throw new Error(`Failed to fetch pool status: ${error.message}`);
    }
  }

  async getPoolMetrics(): Promise<PoolMetrics> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/pool/metrics`, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch pool metrics: ${error.message}`);
    }
  }

  async simulateAddLiquidity(tokenAddress: string, amount: string): Promise<any> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/fusion/pool/simulate/add`, {
        tokenAddress,
        amount,
        dryRun: true
      }, {
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Simulation failed: ${error.message}`);
    }
  }

  async addLiquidity(tokenAddress: string, amount: string): Promise<{
    txHash: string;
    gasUsed: string;
    newBalance: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/fusion/pool/add`, {
        tokenAddress,
        amount,
        network: this.network.name
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to add liquidity: ${error.message}`);
    }
  }

  async removeLiquidity(tokenAddress: string, amount: string): Promise<{
    txHash: string;
    gasUsed: string;
    newBalance: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/fusion/pool/remove`, {
        tokenAddress,
        amount,
        network: this.network.name
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to remove liquidity: ${error.message}`);
    }
  }

  async emergencyDrain(tokenAddress: string): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/fusion/pool/emergency-drain`, {
        tokenAddress,
        network: this.network.name
      }, {
        timeout: 60000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Emergency drain failed: ${error.message}`);
    }
  }

  async analyzeRebalancing(): Promise<RebalanceAnalysis> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/pool/analyze-rebalancing`, {
        params: { network: this.network.name },
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Rebalancing analysis failed: ${error.message}`);
    }
  }

  async executeRebalancing(recommendations: RebalanceRecommendation[]): Promise<{
    actions: Array<{
      action: string;
      token: string;
      amount: string;
      txHash: string;
      success: boolean;
    }>;
    totalGasCost: string;
  }> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/fusion/pool/rebalance`, {
        recommendations,
        network: this.network.name
      }, {
        timeout: 120000 // 2 minutes for multiple transactions
      });

      return response.data;
    } catch (error) {
      throw new Error(`Rebalancing execution failed: ${error.message}`);
    }
  }

  async getTokenLiquidity(tokenAddress: string): Promise<{
    totalBalance: string;
    availableBalance: string;
    reservedBalance: string;
    utilization: number;
    recentVolume: string;
  }> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/pool/liquidity/${tokenAddress}`, {
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch token liquidity: ${error.message}`);
    }
  }

  async setMinimumThreshold(tokenAddress: string, threshold: string): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/fusion/pool/set-threshold`, {
        tokenAddress,
        threshold,
        network: this.network.name
      }, {
        timeout: 15000
      });
    } catch (error) {
      throw new Error(`Failed to set minimum threshold: ${error.message}`);
    }
  }

  async pauseToken(tokenAddress: string, reason: string): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/fusion/pool/pause-token`, {
        tokenAddress,
        reason,
        network: this.network.name
      }, {
        timeout: 15000
      });
    } catch (error) {
      throw new Error(`Failed to pause token: ${error.message}`);
    }
  }

  async resumeToken(tokenAddress: string): Promise<void> {
    try {
      await axios.post(`${config.api.baseUrl}/fusion/pool/resume-token`, {
        tokenAddress,
        network: this.network.name
      }, {
        timeout: 15000
      });
    } catch (error) {
      throw new Error(`Failed to resume token: ${error.message}`);
    }
  }
}