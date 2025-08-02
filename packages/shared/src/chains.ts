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
  // Check if we're in a Node.js environment
  if (typeof globalThis !== 'undefined' && 
      typeof globalThis.process !== 'undefined' && 
      globalThis.process.env) {
    return globalThis.process.env[key] || defaultValue || '';
  }
  // Fallback for browser environment
  return defaultValue || '';
};

// Meta transaction forwarder addresses
export interface ForwarderAddresses {
  minimalForwarder: string | null;
  htlcForwarder: string | null;
}

// EVM Chains Configuration
export const evmChains: Record<string, EvmChainConfig & { forwarders?: ForwarderAddresses }> = {
  sepolia: {
    name: 'Ethereum Sepolia',
    type: 'evm',
    chainId: 11155111,
    rpcUrl: getEnvVar('SEPOLIA_RPC_URL', 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3'),
    blockExplorer: 'https://sepolia.etherscan.io',
    htlcAddress: getEnvVar('NEXT_PUBLIC_SEPOLIA_HTLC', '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D'),
    faucetUrl: 'https://sepoliafaucet.com',
    forwarders: {
      minimalForwarder: null, // Not deployed yet
      htlcForwarder: getEnvVar('SEPOLIA_HTLC_FORWARDER', '0xC2Cb379E217D17d6CcD4CE8c5023512325b630e4')
    }
  },
  polygonAmoy: {
    name: 'Polygon Amoy Testnet',
    type: 'evm',
    chainId: 80002,
    rpcUrl: getEnvVar('POLYGON_AMOY_RPC_URL', 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3'),
    blockExplorer: 'https://amoy.polygonscan.com',
    htlcAddress: getEnvVar('NEXT_PUBLIC_POLYGON_AMOY_HTLC', '0x04139d1fCC2E6f8b964C257eFceEA99a783Df422'),
    faucetUrl: 'https://faucet.polygon.technology',
    forwarders: {
      minimalForwarder: getEnvVar('POLYGON_AMOY_MINIMAL_FORWARDER', '0xFaE696466e232634F7349c88d6f338af4eA6fa6C'),
      htlcForwarder: null // Will be deployed when we get more MATIC
    }
  },
  monadTestnet: {
    name: 'Monad Testnet',
    type: 'evm',
    chainId: 10143,
    rpcUrl: getEnvVar('MONAD_RPC_URL', 'https://testnet-rpc.monad.xyz'),
    blockExplorer: 'https://testnet.monadexplorer.com',
    htlcAddress: getEnvVar('NEXT_PUBLIC_MONAD_HTLC', '0x1C2D085DdF3c3FE877f3Bc0709c97F8342FCF868'), // Updated to MONSTER token
    faucetUrl: 'https://faucet.monad.xyz',
    forwarders: {
      minimalForwarder: null, // Not deployed yet
      htlcForwarder: null // Not deployed yet
    }
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
  return Object.values(allChains).find((chain: ChainConfig) => chain.chainId === chainId);
};

export const getEvmChainById = (chainId: number): EvmChainConfig | undefined => {
  return Object.values(evmChains).find((chain: EvmChainConfig & { forwarders?: ForwarderAddresses }) => chain.chainId === chainId);
};

export const getCosmosChainById = (chainId: string): CosmosChainConfig | undefined => {
  return Object.values(cosmosChains).find((chain: CosmosChainConfig) => chain.chainId === chainId);
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
export const DEFAULT_EVM_CHAIN = evmChains.sepolia;
export const DEFAULT_COSMOS_CHAIN = cosmosChains.local;