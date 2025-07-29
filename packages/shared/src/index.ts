// Core exports
export * from './chains';
export * from './clients/index';
export * from './utils/index';
export * from './services/index';

// Re-export commonly used types
export type {
  ChainConfig,
  EvmChainConfig,
  CosmosChainConfig
} from './chains';

export type {
  HTLCDetails,
  CreateHTLCParams,
  CrossChainSwapParams,
  FundedEvent,
  ClaimedEvent,
  RefundedEvent,
  HTLCParams,
  SwapState
} from './utils/index';

// Export client classes as values, not types
export {
  EvmHTLCClient,
  CosmosHTLCClient,
  MockEvmHTLCClient,
  MockCosmosHTLCClient
} from './clients/index';

export type {
  EvmHTLCClientOptions,
  CosmosHTLCClientOptions
} from './clients/index';