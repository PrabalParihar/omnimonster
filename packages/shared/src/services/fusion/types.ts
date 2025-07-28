import { z } from 'zod';

// Base types for 1inch Fusion+ API

// Token schema
export const TokenSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  address: z.string(),
  logoURI: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type Token = z.infer<typeof TokenSchema>;

// Quote request schema
export const QuoteRequestSchema = z.object({
  src: z.string().describe('Source token address'),
  dst: z.string().describe('Destination token address'),
  amount: z.string().describe('Amount to swap in wei'),
  from: z.string().describe('Wallet address'),
  slippage: z.number().min(0).max(50).optional().default(1),
  gasPrice: z.string().optional().describe('Gas price in wei'),
  protocols: z.string().optional().describe('Comma-separated protocol names'),
  fee: z.number().min(0).max(3).optional().describe('Platform fee percentage'),
  gasLimit: z.number().optional().describe('Gas limit for the swap'),
  connectorTokens: z.string().optional().describe('Connector tokens'),
  complexityLevel: z.number().min(0).max(3).optional().describe('Complexity level'),
  mainRouteParts: z.number().optional().describe('Main route parts'),
  parts: z.number().optional().describe('Split parts'),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

// Quote response schema
export const QuoteResponseSchema = z.object({
  fromToken: TokenSchema,
  toToken: TokenSchema,
  toTokenAmount: z.string(),
  fromTokenAmount: z.string(),
  protocols: z.array(z.array(z.array(z.object({
    name: z.string(),
    part: z.number(),
    fromTokenAddress: z.string(),
    toTokenAddress: z.string(),
  })))),
  estimatedGas: z.number(),
  gasPrice: z.string(),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

// Fusion order schema
export const FusionOrderSchema = z.object({
  orderHash: z.string(),
  signature: z.string(),
  quoteId: z.string().optional(),
  order: z.object({
    salt: z.string(),
    maker: z.string(),
    receiver: z.string(),
    makerAsset: z.string(),
    takerAsset: z.string(),
    makingAmount: z.string(),
    takingAmount: z.string(),
    makerTraits: z.string(),
  }),
});

export type FusionOrder = z.infer<typeof FusionOrderSchema>;

// Order creation request schema
export const CreateOrderRequestSchema = z.object({
  src: z.string().describe('Source token address'),
  dst: z.string().describe('Destination token address'),
  amount: z.string().describe('Amount to swap in wei'),
  from: z.string().describe('Maker wallet address'),
  receiver: z.string().optional().describe('Receiver address (defaults to from)'),
  preset: z.enum(['fast', 'medium', 'slow']).optional().default('medium'),
  fee: z.number().min(0).max(3).optional().describe('Platform fee percentage'),
  nonce: z.number().optional().describe('Order nonce'),
  permit: z.string().optional().describe('Permit signature'),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

// Order submission schema
export const SubmitOrderRequestSchema = z.object({
  orderHash: z.string(),
  signature: z.string(),
  quoteId: z.string().optional(),
});

export type SubmitOrderRequest = z.infer<typeof SubmitOrderRequestSchema>;

export const SubmitOrderResponseSchema = z.object({
  orderHash: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
});

export type SubmitOrderResponse = z.infer<typeof SubmitOrderResponseSchema>;

// Order status schema
export const OrderStatusSchema = z.object({
  orderHash: z.string(),
  status: z.enum(['pending', 'filled', 'cancelled', 'expired', 'invalid']),
  remains: z.string(),
  filledPercent: z.number(),
  createDateTime: z.string(),
  fills: z.array(z.object({
    txHash: z.string(),
    filledMakerAmount: z.string(),
    filledTakerAmount: z.string(),
  })).optional(),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Token prices schema
export const TokenPricesResponseSchema = z.record(z.string(), z.object({
  price: z.number(),
  timestamp: z.number(),
}));

export type TokenPricesResponse = z.infer<typeof TokenPricesResponseSchema>;

// Gas price schema
export const GasPriceResponseSchema = z.object({
  standard: z.string(),
  fast: z.string(),
  instant: z.string(),
});

export type GasPriceResponse = z.infer<typeof GasPriceResponseSchema>;

// WebSocket subscription schemas
export const WSSubscriptionRequestSchema = z.object({
  id: z.number(),
  method: z.enum(['subscribe', 'unsubscribe']),
  params: z.object({
    channel: z.enum(['orders', 'prices', 'gasPrice']),
    filters: z.record(z.unknown()).optional(),
  }),
});

export type WSSubscriptionRequest = z.infer<typeof WSSubscriptionRequestSchema>;

export const WSMessageSchema = z.object({
  id: z.number().optional(),
  method: z.string().optional(),
  params: z.object({
    channel: z.string(),
    data: z.unknown(),
  }),
});

export type WSMessage = z.infer<typeof WSMessageSchema>;

// Error schemas
export const APIErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  description: z.string(),
  meta: z.record(z.unknown()).optional(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

// Configuration schema
export const FusionConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  restUrl: z.string().url('Invalid REST URL'),
  wsUrl: z.string().url('Invalid WebSocket URL'),
  chainId: z.number().default(1),
  timeout: z.number().default(30000),
  retries: z.number().default(3),
  retryDelay: z.number().default(1000),
  rateLimit: z.object({
    requests: z.number().default(100),
    period: z.number().default(60000), // 1 minute
  }),
});

export type FusionConfig = z.infer<typeof FusionConfigSchema>;

// Events
export interface FusionEvents {
  orderUpdate: (order: OrderStatus) => void;
  priceUpdate: (prices: TokenPricesResponse) => void;
  gasPriceUpdate: (gasPrice: GasPriceResponse) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
}