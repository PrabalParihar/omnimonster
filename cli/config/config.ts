import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from current and parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

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

export class Config {
  private static instance: Config;

  public readonly networks: Record<string, NetworkConfig> = {
    sepolia: {
      name: 'Sepolia',
      rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      chainId: 11155111,
      contracts: {
        htlc: process.env.SEPOLIA_HTLC_CONTRACT,
        fusionHTLC: process.env.SEPOLIA_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.SEPOLIA_GAS_RELAYER_CONTRACT,
        forwarder: process.env.SEPOLIA_FORWARDER_CONTRACT,
      }
    },
    polygonAmoy: {
      name: 'Polygon Amoy',
      rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      contracts: {
        htlc: process.env.POLYGON_AMOY_HTLC_CONTRACT,
        fusionHTLC: process.env.POLYGON_AMOY_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.POLYGON_AMOY_GAS_RELAYER_CONTRACT,
        forwarder: process.env.POLYGON_AMOY_FORWARDER_CONTRACT,
      }
    },
    monadTestnet: {
      name: 'Monad Testnet',
      rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet1.monad.xyz',
      chainId: 41454,
      contracts: {
        htlc: process.env.MONAD_HTLC_CONTRACT,
        fusionHTLC: process.env.MONAD_FUSION_HTLC_CONTRACT,
        gasRelayer: process.env.MONAD_GAS_RELAYER_CONTRACT,
        forwarder: process.env.MONAD_FORWARDER_CONTRACT,
      }
    }
  };

  public readonly database: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fusion_swap',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true'
  };

  public readonly api: APIConfig = {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    retries: parseInt(process.env.API_RETRIES || '3')
  };

  public readonly testWallet = {
    privateKey: process.env.TEST_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY,
    mnemonic: process.env.TEST_WALLET_MNEMONIC
  };

  public readonly oneInch = {
    apiKey: process.env.ONEINCH_API_KEY,
    baseUrl: process.env.ONEINCH_API_URL || 'https://api.1inch.dev'
  };

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  getNetwork(name: string): NetworkConfig {
    const network = this.networks[name];
    if (!network) {
      throw new Error(`Unknown network: ${name}`);
    }
    return network;
  }

  getAvailableNetworks(): string[] {
    return Object.keys(this.networks);
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    // Check database config
    if (!this.database.host) errors.push('DB_HOST is required');
    if (!this.database.database) errors.push('DB_NAME is required');
    if (!this.database.username) errors.push('DB_USER is required');

    // Check test wallet
    if (!this.testWallet.privateKey && !this.testWallet.mnemonic) {
      errors.push('Either TEST_WALLET_PRIVATE_KEY or TEST_WALLET_MNEMONIC is required');
    }

    // Check network RPC URLs
    for (const [name, network] of Object.entries(this.networks)) {
      if (!network.rpcUrl || network.rpcUrl.includes('YOUR_PROJECT_ID')) {
        errors.push(`${name.toUpperCase()}_RPC_URL is required`);
      }
    }

    return errors;
  }
}

export const config = Config.getInstance();