// Core exports
export * from './chains.js';
export * from './clients/index.js';
export * from './utils/index.js';
export * from './services/index.js';

// Re-export commonly used types
export type {
  ChainConfig,
  EvmChainConfig,
  CosmosChainConfig
} from './chains.js';

export type {
  HTLCDetails,
  CreateHTLCParams,
  CrossChainSwapParams,
  FundedEvent,
  ClaimedEvent,
  RefundedEvent,
  HTLCParams,
  SwapState
} from './utils/index.js';

export type {
  EvmHTLCClient,
  EvmHTLCClientOptions,
  CosmosHTLCClient,
  CosmosHTLCClientOptions,
  MockEvmHTLCClient,
  MockCosmosHTLCClient
} from './clients/index.js';