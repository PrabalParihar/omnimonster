// Core exports
export * from './chains';
export * from './clients/index';
export * from './utils/index';
// Export services except for types that conflict with tokens
export { FusionClient, createFusionClient, RateLimiter } from './services/index';
export type { 
  FusionConfig, 
  QuoteRequest, 
  QuoteResponse, 
  FusionOrder, 
  CreateOrderRequest, 
  SubmitOrderRequest, 
  SubmitOrderResponse, 
  OrderStatus, 
  TokenPricesResponse, 
  GasPriceResponse,
  WSSubscriptionRequest,
  WSMessage,
  APIError,
  FusionEvents
} from './services/index';
// Database exports are server-side only - don't export to avoid browser import issues
// export * from './database';
export * from './tokens';

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