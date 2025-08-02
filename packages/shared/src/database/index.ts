import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export class FusionDatabase {
  private pool: Pool;
  private static instance: FusionDatabase;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  static getInstance(config?: DatabaseConfig): FusionDatabase {
    if (!FusionDatabase.instance) {
      if (!config) {
        throw new Error('Database config required for first initialization');
      }
      FusionDatabase.instance = new FusionDatabase(config);
    }
    return FusionDatabase.instance;
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initializeSchema(): Promise<void> {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      await this.query(schema);
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing database schema:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Database Models and Types
export interface UserAuth {
  id: string;
  web3authUserId: string;
  email?: string;
  name?: string;
  profileImage?: string;
  loginProvider: string;
  walletAddress: string;
  isSocialLogin: boolean;
  createdAt: Date;
  lastLogin: Date;
}

export interface SwapRequest {
  id: string;
  userAddress: string;
  sourceToken: string;
  sourceAmount: string;
  targetToken: string;
  expectedAmount: string;
  slippageTolerance: number;
  userHtlcContract?: string;
  poolHtlcContract?: string;
  hashLock: string;
  preimageHash: string;
  expirationTime: number;
  status: SwapStatus;
  poolClaimedAt?: Date;
  userClaimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SwapStatus {
  PENDING = 'PENDING',
  POOL_FULFILLED = 'POOL_FULFILLED',
  USER_CLAIMED = 'USER_CLAIMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export interface PoolLiquidity {
  id: string;
  tokenAddress: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  minThreshold: string;
  lastRebalance: Date;
  updatedAt: Date;
}

export interface ResolverOperation {
  id: string;
  swapRequestId: string;
  operationType: ResolverOperationType;
  status: OperationStatus;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  metadata?: any;
}

export enum ResolverOperationType {
  DETECT_SWAP = 'DETECT_SWAP',
  VALIDATE_POOL = 'VALIDATE_POOL',
  MATCH_SWAP = 'MATCH_SWAP',
  DEPLOY_HTLC = 'DEPLOY_HTLC',
  CLAIM_TOKENS = 'CLAIM_TOKENS',
  FINALIZE = 'FINALIZE'
}

export enum OperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING'
}

export interface GaslessClaim {
  id: string;
  swapRequestId: string;
  claimerAddress: string;
  htlcContract: string;
  contractId: string;
  preimage: string;
  signature: string;
  status: OperationStatus;
  txHash?: string;
  gasUsed?: number;
  gasPrice?: number;
  relayFee?: string;
  gasCompensation?: string;
  nonce?: number;
  deadline?: number;
  errorMessage?: string;
  createdAt: Date;
  executedAt?: Date;
}

export interface SupportedToken {
  id: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  isActive: boolean;
  minSwapAmount: string;
  maxSwapAmount: string;
  feePercentage: number;
  oraclePriceFeed?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Export database configuration from environment
export const getDatabaseConfig = (): DatabaseConfig => {
  // If DATABASE_URL is provided, parse it
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1), // Remove leading slash
      username: url.username,
      password: url.password,
      ssl: url.searchParams.get('sslmode') === 'require',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
    };
  }
  
  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fusion_swap',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
  };
};

// Export DAO
export { FusionDAO } from './dao';

export default FusionDatabase;