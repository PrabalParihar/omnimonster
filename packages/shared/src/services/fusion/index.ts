// Export all Fusion service types and classes
import { FusionClient } from './FusionClient.js';
export { FusionClient } from './FusionClient.js';
export { RateLimiter } from './rateLimiter.js';
export * from './types.js';

// Helper function to create a FusionClient with environment variables
export function createFusionClient() {
  const config = {
    apiKey: process.env.FUSION_API_KEY || '',
    restUrl: process.env.FUSION_REST_URL || 'https://api.1inch.dev',
    wsUrl: process.env.FUSION_WS_URL || 'wss://api.1inch.dev/ws',
    chainId: parseInt(process.env.FUSION_CHAIN_ID || '1'),
    timeout: parseInt(process.env.FUSION_TIMEOUT || '30000'),
    retries: parseInt(process.env.FUSION_RETRIES || '3'),
    retryDelay: parseInt(process.env.FUSION_RETRY_DELAY || '1000'),
    rateLimit: {
      requests: parseInt(process.env.FUSION_RATE_LIMIT_REQUESTS || '100'),
      period: parseInt(process.env.FUSION_RATE_LIMIT_PERIOD || '60000'),
    },
  };

  return new FusionClient(config);
}