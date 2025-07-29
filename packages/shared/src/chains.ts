import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env.local
dotenvConfig({ path: '.env.local' });

export interface ChainConfig {
  chainId: string | number;
  name: string;
  type: 'evm' | 'cosmos';
  rpcUrl: string;
  htlcAddress: string;
  nativeDenom?: string;
  blockExplorer?: string;
  faucetUrl?: string;
}

export interface EvmChainConfig extends ChainConfig {
  type: 'evm';
  chainId: number;
}

export interface CosmosChainConfig extends ChainConfig {
  type: 'cosmos';
  chainId: string;
  nativeDenom: string;
  addressPrefix: string;
  codeId?: string;
}

// Environment variables with fallbacks
const getEnvVar = (key: string, defaultValue?: string): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue || '';
  }
  return defaultValue || '';
};

// EVM Chains Configuration
export const evmChains: Record<string, EvmChainConfig> = {
  hardhat: {
    chainId: 31337,
    name: 'Hardhat Local',
    type: 'evm',
    rpcUrl: getEnvVar('HARDHAT_RPC_URL', 'http://127.0.0.1:8545'),
    htlcAddress: getEnvVar('EVM_HTLC_ADDRESS', '0x5FbDB2315678afecb367f032d93F642f64180aa3'),
    blockExplorer: 'http://localhost:8545',
    faucetUrl: 'Built-in accounts with 10000 ETH'
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    type: 'evm',
    rpcUrl: getEnvVar('SEPOLIA_RPC_URL', 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3'),
    htlcAddress: getEnvVar('SEPOLIA_HTLC_ADDRESS', '0x095077a72ecF85023cF4317CcD42e43658516774'),
    blockExplorer: 'https://sepolia.etherscan.io',
    faucetUrl: 'https://sepoliafaucet.com'
  },
  
  polygonAmoy: {
    chainId: 80002,
    name: 'Polygon Amoy Testnet',
    type: 'evm',
    rpcUrl: getEnvVar('POLYGON_AMOY_RPC_URL', 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3'),
    htlcAddress: getEnvVar('POLYGON_AMOY_HTLC_ADDRESS', '0x04139d1fCC2E6f8b964C257eFceEA99a783Df422'),
    blockExplorer: 'https://amoy.polygonscan.com',
    faucetUrl: 'https://faucet.polygon.technology'
  }
};

// Cosmos Chains Configuration
export const cosmosChains: Record<string, CosmosChainConfig> = {
  local: {
    chainId: 'swap-sage-1',
    name: 'Local Wasmd',
    type: 'cosmos',
    rpcUrl: getEnvVar('COSMOS_RPC_URL', 'http://localhost:26657'),
    htlcAddress: getEnvVar('COSMOS_HTLC_ADDRESS', 'cosmos1m7h2n6jj4d5khp6lq9k9r8s9k6j4h5t6u7a8b9c0d1e2f3'),
    nativeDenom: 'stake',
    addressPrefix: 'cosmos',
    codeId: getEnvVar('COSMOS_CODE_ID', '1'),
    blockExplorer: 'http://localhost:26657',
    faucetUrl: 'Local development accounts'
  },
  osmosisTestnet: {
    chainId: 'osmo-test-5',
    name: 'Osmosis Testnet',
    type: 'cosmos',
    rpcUrl: getEnvVar('OSMOSIS_TESTNET_RPC_URL', 'https://rpc.osmotest5.osmosis.zone'),
    htlcAddress: getEnvVar('OSMOSIS_TESTNET_HTLC_ADDRESS', ''),
    nativeDenom: 'uosmo',
    addressPrefix: 'osmo',
    codeId: getEnvVar('OSMOSIS_TESTNET_CODE_ID', ''),
    blockExplorer: 'https://testnet.mintscan.io/osmosis-testnet',
    faucetUrl: 'https://faucet.osmotest5.osmosis.zone'
  },
  cosmosTestnet: {
    chainId: 'theta-testnet-001',
    name: 'Cosmos Hub Testnet',
    type: 'cosmos',
    rpcUrl: getEnvVar('COSMOS_TESTNET_RPC_URL', 'https://rpc.sentry-01.theta-testnet.polypore.xyz'),
    htlcAddress: getEnvVar('COSMOS_TESTNET_HTLC_ADDRESS', ''),
    nativeDenom: 'uatom',
    addressPrefix: 'cosmos',
    codeId: getEnvVar('COSMOS_TESTNET_CODE_ID', ''),
    blockExplorer: 'https://explorer.theta-testnet.polypore.xyz',
    faucetUrl: 'Contact in Discord for testnet tokens'
  }
};

// All chains combined
export const allChains: Record<string, ChainConfig> = {
  ...evmChains,
  ...cosmosChains
};

// Helper functions
export const getChainById = (chainId: string | number): ChainConfig | undefined => {
  return Object.values(allChains).find(chain => chain.chainId === chainId);
};

export const getEvmChainById = (chainId: number): EvmChainConfig | undefined => {
  return Object.values(evmChains).find(chain => chain.chainId === chainId);
};

export const getCosmosChainById = (chainId: string): CosmosChainConfig | undefined => {
  return Object.values(cosmosChains).find(chain => chain.chainId === chainId);
};

export const getChainByName = (name: string): ChainConfig | undefined => {
  return allChains[name.toLowerCase()];
};

// Chain validation
export const isEvmChain = (chain: ChainConfig): chain is EvmChainConfig => {
  return chain.type === 'evm';
};

export const isCosmosChain = (chain: ChainConfig): chain is CosmosChainConfig => {
  return chain.type === 'cosmos';
};

// Default chains for development
export const DEFAULT_EVM_CHAIN = evmChains.hardhat;
export const DEFAULT_COSMOS_CHAIN = cosmosChains.local;