import { ethers } from 'ethers';
import axios from 'axios';
import { config, NetworkConfig } from '../config/config';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  responseTime?: number;
  message?: string;
  details?: any;
}

export interface DatabaseHealth extends HealthStatus {
  connectionCount?: number;
  version?: string;
}

export interface APIHealth extends HealthStatus {
  endpoints: {
    total: number;
    healthy: number;
    failed: string[];
  };
}

export interface ContractHealth extends HealthStatus {
  total: number;
  deployed: number;
  contracts: Record<string, {
    deployed: boolean;
    address?: string;
    error?: string;
  }>;
}

export interface ServicesHealth extends HealthStatus {
  total: number;
  healthy: number;
  services: Record<string, HealthStatus>;
}

export class HealthChecker {
  private network: NetworkConfig;
  private provider: ethers.JsonRpcProvider;

  constructor(networkName: string) {
    this.network = config.getNetwork(networkName);
    this.provider = new ethers.JsonRpcProvider(this.network.rpcUrl);
  }

  async checkDatabase(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    
    try {
      // Check if we can connect to the API that uses the database
      const response = await axios.get(`${config.api.baseUrl}/test-db`, {
        timeout: config.api.timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200 && response.data.message && response.data.message.includes('successful')) {
        return {
          status: 'healthy',
          responseTime,
          connectionCount: response.data.connectionCount,
          version: response.data.version,
          message: 'Database connection successful'
        };
      } else {
        return {
          status: 'error',
          responseTime,
          message: 'Database connection failed',
          details: response.data
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        message: error.message,
        details: error
      };
    }
  }

  async checkAPI(): Promise<APIHealth> {
    const endpoints = [
      '/fusion/swaps',
      '/fusion/pool/status', 
      '/fusion/pool/liquidity',
      '/fusion/resolver/status',
      '/auth/store-user'
    ];

    const results = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        try {
          const response = await axios.get(`${config.api.baseUrl}${endpoint}`, {
            timeout: 10000,
            validateStatus: (status) => status < 500 // Accept 4xx as "healthy" API
          });
          return { endpoint, success: true, status: response.status };
        } catch (error) {
          return { endpoint, success: false, error: error.message };
        }
      })
    );

    const healthyCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failedEndpoints = results
      .filter(result => result.status === 'rejected' || !result.value.success)
      .map(result => {
        if (result.status === 'rejected') {
          return result.reason;
        }
        return `${result.value.endpoint}: ${result.value.error}`;
      });

    return {
      status: healthyCount === endpoints.length ? 'healthy' : 
              healthyCount > endpoints.length / 2 ? 'degraded' : 'error',
      endpoints: {
        total: endpoints.length,
        healthy: healthyCount,
        failed: failedEndpoints
      }
    };
  }

  async checkContracts(): Promise<ContractHealth> {
    const contracts = this.network.contracts;
    const contractNames = Object.keys(contracts);
    const results: Record<string, any> = {};

    for (const name of contractNames) {
      const address = contracts[name];
      
      if (!address) {
        results[name] = {
          deployed: false,
          error: 'Contract address not configured'
        };
        continue;
      }

      try {
        // Check if contract exists at address
        const code = await this.provider.getCode(address);
        
        if (code === '0x') {
          results[name] = {
            deployed: false,
            address,
            error: 'No contract code at address'
          };
        } else {
          // Try to call a basic function to verify it's working
          try {
            await this.provider.call({
              to: address,
              data: '0x' // Empty call data
            });
            results[name] = {
              deployed: true,
              address
            };
          } catch (callError) {
            // Contract exists but may not be responsive
            results[name] = {
              deployed: true,
              address,
              error: `Contract not responsive: ${callError.message}`
            };
          }
        }
      } catch (error) {
        results[name] = {
          deployed: false,
          address,
          error: `Provider error: ${error.message}`
        };
      }
    }

    const deployedCount = Object.values(results).filter(r => r.deployed).length;

    return {
      status: deployedCount === contractNames.length ? 'healthy' :
              deployedCount > 0 ? 'degraded' : 'error',
      total: contractNames.length,
      deployed: deployedCount,
      contracts: results
    };
  }

  async checkServices(): Promise<ServicesHealth> {
    const services = {
      resolver: this.checkResolverService(),
      gasRelayer: this.checkGasRelayerService(),
      poolManager: this.checkPoolManagerService(),
      database: this.checkDatabaseService()
    };

    const results = await Promise.allSettled(Object.values(services));
    const serviceResults: Record<string, HealthStatus> = {};
    const serviceNames = Object.keys(services);

    results.forEach((result, index) => {
      const serviceName = serviceNames[index];
      if (result.status === 'fulfilled') {
        serviceResults[serviceName] = result.value;
      } else {
        serviceResults[serviceName] = {
          status: 'error',
          message: result.reason?.message || 'Service check failed'
        };
      }
    });

    const healthyCount = Object.values(serviceResults).filter(s => s.status === 'healthy').length;

    return {
      status: healthyCount === serviceNames.length ? 'healthy' :
              healthyCount > serviceNames.length / 2 ? 'degraded' : 'error',
      total: serviceNames.length,
      healthy: healthyCount,
      services: serviceResults
    };
  }

  private async checkResolverService(): Promise<HealthStatus> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/resolver/status`, {
        timeout: 10000
      });

      if (response.status === 200 && response.data.health) {
        const healthStatus = response.data.health.status;
        return {
          status: healthStatus === 'HEALTHY' ? 'healthy' : 'degraded',
          message: `Resolver ${healthStatus.toLowerCase()}`,
          details: response.data
        };
      }

      return {
        status: 'error',
        message: 'Resolver status check failed'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Resolver service error: ${error.message}`
      };
    }
  }

  private async checkGasRelayerService(): Promise<HealthStatus> {
    try {
      // Check if gas relayer has sufficient balance
      if (this.network.contracts.gasRelayer) {
        const balance = await this.provider.getBalance(this.network.contracts.gasRelayer);
        const balanceEth = ethers.formatEther(balance);
        
        if (parseFloat(balanceEth) > 0.1) { // Minimum 0.1 ETH
          return {
            status: 'healthy',
            message: `Gas relayer funded (${balanceEth} ETH)`,
            details: { balance: balanceEth }
          };
        } else {
          return {
            status: 'degraded',
            message: `Gas relayer low balance (${balanceEth} ETH)`,
            details: { balance: balanceEth }
          };
        }
      }

      return {
        status: 'error',
        message: 'Gas relayer contract not configured'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Gas relayer check failed: ${error.message}`
      };
    }
  }

  private async checkPoolManagerService(): Promise<HealthStatus> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/fusion/pool/status`, {
        timeout: 10000
      });

      if (response.status === 200) {
        const data = response.data;
        const hasLiquidity = data.tokens && data.tokens.length > 0;
        
        return {
          status: hasLiquidity ? 'healthy' : 'degraded',
          message: hasLiquidity ? 'Pool manager operational' : 'No pool liquidity',
          details: data
        };
      }

      return {
        status: 'error',
        message: 'Pool manager status check failed'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Pool manager error: ${error.message}`
      };
    }
  }

  private async checkDatabaseService(): Promise<HealthStatus> {
    try {
      const response = await axios.get(`${config.api.baseUrl}/test-db`, {
        timeout: 10000
      });

      if (response.status === 200 && response.data.message && response.data.message.includes('successful')) {
        return {
          status: 'healthy',
          message: 'Database service operational',
          details: response.data
        };
      }

      return {
        status: 'error',
        message: 'Database service check failed'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Database service error: ${error.message}`
      };
    }
  }

  calculateOverallHealth(results: Record<string, HealthStatus>): { status: string; score: number } {
    const services = Object.values(results);
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const score = Math.round((healthyCount / services.length) * 100);

    let status: string;
    if (score >= 90) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'degraded';
    } else {
      status = 'error';
    }

    return { status, score };
  }
}