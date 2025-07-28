import { describe, it, expect } from 'vitest';
import {
  QuoteRequestSchema,
  QuoteResponseSchema,
  FusionOrderSchema,
  CreateOrderRequestSchema,
  SubmitOrderRequestSchema,
  SubmitOrderResponseSchema,
  OrderStatusSchema,
  TokenPricesResponseSchema,
  GasPriceResponseSchema,
  WSSubscriptionRequestSchema,
  WSMessageSchema,
  APIErrorSchema,
  FusionConfigSchema,
  TokenSchema,
} from '../types';

describe('Fusion Types', () => {
  describe('TokenSchema', () => {
    it('should validate valid token', () => {
      const validToken = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        address: '0x0000000000000000000000000000000000000000',
        logoURI: 'https://example.com/eth.png',
        tags: ['native'],
      };

      expect(() => TokenSchema.parse(validToken)).not.toThrow();
    });

    it('should validate minimal token', () => {
      const minimalToken = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        address: '0x0000000000000000000000000000000000000000',
      };

      expect(() => TokenSchema.parse(minimalToken)).not.toThrow();
    });

    it('should reject invalid token', () => {
      const invalidToken = {
        symbol: 'ETH',
        // missing name
        decimals: 18,
        address: '0x0000000000000000000000000000000000000000',
      };

      expect(() => TokenSchema.parse(invalidToken)).toThrow();
    });
  });

  describe('QuoteRequestSchema', () => {
    it('should validate valid quote request', () => {
      const validRequest = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        slippage: 1,
        gasPrice: '20000000000',
      };

      const result = QuoteRequestSchema.parse(validRequest);
      expect(result.slippage).toBe(1);
    });

    it('should use default slippage', () => {
      const requestWithoutSlippage = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
      };

      const result = QuoteRequestSchema.parse(requestWithoutSlippage);
      expect(result.slippage).toBe(1);
    });

    it('should reject invalid slippage', () => {
      const invalidRequest = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        slippage: 100, // Too high
      };

      expect(() => QuoteRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('CreateOrderRequestSchema', () => {
    it('should validate valid create order request', () => {
      const validRequest = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        preset: 'fast',
        fee: 0.5,
      };

      const result = CreateOrderRequestSchema.parse(validRequest);
      expect(result.preset).toBe('fast');
    });

    it('should use default preset', () => {
      const requestWithoutPreset = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
      };

      const result = CreateOrderRequestSchema.parse(requestWithoutPreset);
      expect(result.preset).toBe('medium');
    });

    it('should reject invalid preset', () => {
      const invalidRequest = {
        src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        amount: '1000000000000000000',
        from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        preset: 'invalid',
      };

      expect(() => CreateOrderRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('OrderStatusSchema', () => {
    it('should validate valid order status', () => {
      const validStatus = {
        orderHash: '0x123456789abcdef',
        status: 'pending',
        remains: '1000000000000000000',
        filledPercent: 25.5,
        createDateTime: '2023-01-01T00:00:00Z',
        fills: [
          {
            txHash: '0xabcdef123456789',
            filledMakerAmount: '250000000000000000',
            filledTakerAmount: '500000000',
          },
        ],
      };

      expect(() => OrderStatusSchema.parse(validStatus)).not.toThrow();
    });

    it('should reject invalid status', () => {
      const invalidStatus = {
        orderHash: '0x123456789abcdef',
        status: 'invalid_status',
        remains: '1000000000000000000',
        filledPercent: 25.5,
        createDateTime: '2023-01-01T00:00:00Z',
      };

      expect(() => OrderStatusSchema.parse(invalidStatus)).toThrow();
    });
  });

  describe('WSSubscriptionRequestSchema', () => {
    it('should validate valid subscription request', () => {
      const validRequest = {
        id: 1,
        method: 'subscribe',
        params: {
          channel: 'orders',
          filters: {
            maker: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
          },
        },
      };

      expect(() => WSSubscriptionRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid method', () => {
      const invalidRequest = {
        id: 1,
        method: 'invalid_method',
        params: {
          channel: 'orders',
        },
      };

      expect(() => WSSubscriptionRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid channel', () => {
      const invalidRequest = {
        id: 1,
        method: 'subscribe',
        params: {
          channel: 'invalid_channel',
        },
      };

      expect(() => WSSubscriptionRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('FusionConfigSchema', () => {
    it('should validate valid config', () => {
      const validConfig = {
        apiKey: 'test-api-key',
        restUrl: 'https://api.1inch.dev',
        wsUrl: 'wss://api.1inch.dev/ws',
        chainId: 1,
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        rateLimit: {
          requests: 100,
          period: 60000,
        },
      };

      expect(() => FusionConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should use default values', () => {
      const minimalConfig = {
        apiKey: 'test-api-key',
        restUrl: 'https://api.1inch.dev',
        wsUrl: 'wss://api.1inch.dev/ws',
      };

      const result = FusionConfigSchema.parse(minimalConfig);
      expect(result.chainId).toBe(1);
      expect(result.timeout).toBe(30000);
      expect(result.retries).toBe(3);
      expect(result.retryDelay).toBe(1000);
      expect(result.rateLimit.requests).toBe(100);
      expect(result.rateLimit.period).toBe(60000);
    });

    it('should reject empty api key', () => {
      const invalidConfig = {
        apiKey: '',
        restUrl: 'https://api.1inch.dev',
        wsUrl: 'wss://api.1inch.dev/ws',
      };

      expect(() => FusionConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid URLs', () => {
      const invalidConfig = {
        apiKey: 'test-api-key',
        restUrl: 'not-a-url',
        wsUrl: 'wss://api.1inch.dev/ws',
      };

      expect(() => FusionConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('TokenPricesResponseSchema', () => {
    it('should validate valid token prices response', () => {
      const validResponse = {
        '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2': {
          price: 2000.50,
          timestamp: 1672531200000,
        },
        '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3': {
          price: 1.00,
          timestamp: 1672531200000,
        },
      };

      expect(() => TokenPricesResponseSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('GasPriceResponseSchema', () => {
    it('should validate valid gas price response', () => {
      const validResponse = {
        standard: '20000000000',
        fast: '25000000000',
        instant: '30000000000',
      };

      expect(() => GasPriceResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject incomplete gas price response', () => {
      const invalidResponse = {
        standard: '20000000000',
        // missing fast and instant
      };

      expect(() => GasPriceResponseSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe('APIErrorSchema', () => {
    it('should validate valid API error', () => {
      const validError = {
        statusCode: 400,
        error: 'Bad Request',
        description: 'Invalid parameters provided',
        meta: {
          field: 'amount',
          reason: 'must be positive',
        },
      };

      expect(() => APIErrorSchema.parse(validError)).not.toThrow();
    });

    it('should validate minimal API error', () => {
      const minimalError = {
        statusCode: 500,
        error: 'Internal Server Error',
        description: 'Something went wrong',
      };

      expect(() => APIErrorSchema.parse(minimalError)).not.toThrow();
    });
  });
});