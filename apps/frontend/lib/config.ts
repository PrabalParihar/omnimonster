import dotenv from 'dotenv';

// Load environment variables in development
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.local' });
}

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  contracts: {
    htlc?: string;
    fusionHTLC?: string;
    gasRelayer?: string;
    forwarder?: string;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export class FrontendConfig {
  private static instance: FrontendConfig;

  public readonly networks: Record<string, NetworkConfig> = {
    sepolia: {
      name: 'Sepolia',
      rpcUrl: process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      chainId: 11155111,
      contracts: {
        htlc: process.env.SEPOLIA_HTLC_CONTRACT || process.env.NEXT_PUBLIC_SEPOLIA_HTLC_CONTRACT,
        fusionHTLC: process.env.SEPOLIA_FUSION_HTLC_CONTRACT || process.env.NEXT_PUBLIC_SEPOLIA_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.SEPOLIA_GAS_RELAYER_CONTRACT || process.env.NEXT_PUBLIC_SEPOLIA_GAS_RELAYER_CONTRACT,
        forwarder: process.env.SEPOLIA_FORWARDER_CONTRACT || process.env.NEXT_PUBLIC_SEPOLIA_FORWARDER_CONTRACT,
      }
    },
    polygonAmoy: {
      name: 'Polygon Amoy',
      rpcUrl: process.env.POLYGON_AMOY_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      contracts: {
        htlc: process.env.POLYGON_AMOY_HTLC_CONTRACT || process.env.NEXT_PUBLIC_POLYGON_AMOY_HTLC_CONTRACT,
        fusionHTLC: process.env.POLYGON_AMOY_FUSION_HTLC_CONTRACT || process.env.NEXT_PUBLIC_POLYGON_AMOY_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.POLYGON_AMOY_GAS_RELAYER_CONTRACT || process.env.NEXT_PUBLIC_POLYGON_AMOY_GAS_RELAYER_CONTRACT,
        forwarder: process.env.POLYGON_AMOY_FORWARDER_CONTRACT || process.env.NEXT_PUBLIC_POLYGON_AMOY_FORWARDER_CONTRACT,
      }
    },
    monadTestnet: {
      name: 'Monad Testnet',
      rpcUrl: process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet1.monad.xyz',
      chainId: 41454,
      contracts: {
        htlc: process.env.MONAD_HTLC_CONTRACT || process.env.NEXT_PUBLIC_MONAD_HTLC_CONTRACT,
        fusionHTLC: process.env.MONAD_FUSION_HTLC_CONTRACT || process.env.NEXT_PUBLIC_MONAD_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.MONAD_GAS_RELAYER_CONTRACT || process.env.NEXT_PUBLIC_MONAD_GAS_RELAYER_CONTRACT,
        forwarder: process.env.MONAD_FORWARDER_CONTRACT || process.env.NEXT_PUBLIC_MONAD_FORWARDER_CONTRACT,
      }
    }
  };

  // Database configuration is now handled by the shared package

  public readonly api: APIConfig = {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    retries: parseInt(process.env.API_RETRIES || '3')
  };

  public readonly testWallet = {
    privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
    mnemonic: process.env.TEST_WALLET_MNEMONIC
  };

  public readonly oneInch = {
    apiKey: process.env.ONEINCH_API_KEY,
    baseUrl: process.env.ONEINCH_API_URL || 'https://api.1inch.dev'
  };

  public readonly web3Auth = {
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "BPXfjkJJ0qf7cPqIiNiV5-MCwZLm2wxWXfHjE35nsYQ1Clm_89Ge63xvkvzKHc0QVZATf9EaaRcxg9VVmWSopLA"
  };

  static getInstance(): FrontendConfig {
    if (!FrontendConfig.instance) {
      FrontendConfig.instance = new FrontendConfig();
    }
    return FrontendConfig.instance;
  }

  getNetwork(name: string): NetworkConfig {
    const network = this.networks[name];
    if (!network) {
      throw new Error(`Unknown network: ${name}. Available networks: ${this.getAvailableNetworks().join(', ')}`);
    }
    return network;
  }

  getAvailableNetworks(): string[] {
    return Object.keys(this.networks);
  }

  getNetworkByChainId(chainId: number): NetworkConfig | undefined {
    return Object.values(this.networks).find(network => network.chainId === chainId);
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    // Check database config (for server-side components)
    if (typeof window === 'undefined') {
      if (!this.database.host) errors.push('DB_HOST is required');
      if (!this.database.database) errors.push('DB_NAME is required');
      if (!this.database.username) errors.push('DB_USER is required');
    }

    // Check network RPC URLs
    for (const [name, network] of Object.entries(this.networks)) {
      if (!network.rpcUrl || network.rpcUrl.includes('YOUR_PROJECT_ID')) {
        errors.push(`${name.toUpperCase()}_RPC_URL is required`);
      }
    }

    return errors;
  }

  // Helper method to get chain configuration for wagmi/rainbowkit
  getChainConfigs() {
    return Object.values(this.networks).map(network => ({
      id: network.chainId,
      name: network.name,
      rpcUrls: {
        default: { http: [network.rpcUrl] },
        public: { http: [network.rpcUrl] }
      },
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      testnet: true
    }));
  }
}

export const frontendConfig = FrontendConfig.getInstance();