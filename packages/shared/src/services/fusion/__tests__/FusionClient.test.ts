import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import axios from 'axios';
import { FusionClient } from '../FusionClient';
import {
  QuoteRequest,
  QuoteResponse,
  CreateOrderRequest,
  FusionOrder,
  SubmitOrderRequest,
  SubmitOrderResponse,
  OrderStatus,
  TokenPricesResponse,
  GasPriceResponse,
} from '../types';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null as any,
  onclose: null as any,
  onmessage: null as any,
  onerror: null as any,
};

vi.mock('isomorphic-ws', () => {
  return {
    default: vi.fn(() => mockWebSocket),
  };
});

describe('FusionClient', () => {
  let fusionClient: FusionClient;
  let mockAxiosInstance: any;

  const mockConfig = {
    apiKey: 'test-api-key',
    restUrl: 'https://api.test.com',
    wsUrl: 'wss://api.test.com/ws',
    chainId: 1,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    rateLimit: {
      requests: 100,
      period: 60000,
    },
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    fusionClient = new FusionClient(mockConfig);
  });

  afterEach(async () => {
    await fusionClient.destroy();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(fusionClient).toBeInstanceOf(FusionClient);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.restUrl,
        timeout: mockConfig.timeout,
        headers: {
          'Authorization': `Bearer ${mockConfig.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    });

    it('should throw error with invalid config', () => {
      expect(() => new FusionClient({})).toThrow();
    });
  });

  describe('getFusionQuote', () => {
    const mockQuoteRequest: QuoteRequest = {
      src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
      dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
      amount: '1000000000000000000',
      from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
    };

    const mockQuoteResponse: QuoteResponse = {
      fromToken: {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        address: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
      },
      toToken: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        address: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
      },
      toTokenAmount: '2000000000',
      fromTokenAmount: '1000000000000000000',
      protocols: [],
      estimatedGas: 150000,
      gasPrice: '20000000000',
    };

    it('should get quote successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockQuoteResponse });

      const result = await fusionClient.getFusionQuote(mockQuoteRequest);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v5.2/1/quote', {
        params: mockQuoteRequest,
      });
      expect(result).toEqual(mockQuoteResponse);
    });

    it('should throw error for invalid request', async () => {
      await expect(
        fusionClient.getFusionQuote({} as QuoteRequest)
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      await expect(
        fusionClient.getFusionQuote(mockQuoteRequest)
      ).rejects.toThrow('API Error');
    });
  });

  describe('createFusionOrder', () => {
    const mockCreateOrderRequest: CreateOrderRequest = {
      src: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
      dst: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
      amount: '1000000000000000000',
      from: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
    };

    const mockFusionOrder: FusionOrder = {
      orderHash: '0x123456789abcdef',
      signature: '0xsignature',
      order: {
        salt: '12345',
        maker: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        receiver: '0xc0d86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d4',
        makerAsset: '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
        takerAsset: '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000',
        makerTraits: '0x0',
      },
    };

    it('should create order successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockFusionOrder });

      const result = await fusionClient.createFusionOrder(mockCreateOrderRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v2.0/1/fusion/order',
        mockCreateOrderRequest
      );
      expect(result).toEqual(mockFusionOrder);
    });
  });

  describe('submitOrder', () => {
    const mockSubmitRequest: SubmitOrderRequest = {
      orderHash: '0x123456789abcdef',
      signature: '0xsignature',
    };

    const mockSubmitResponse: SubmitOrderResponse = {
      orderHash: '0x123456789abcdef',
      success: true,
      message: 'Order submitted successfully',
    };

    it('should submit order successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockSubmitResponse });

      const result = await fusionClient.submitOrder(mockSubmitRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v2.0/1/fusion/submit',
        mockSubmitRequest
      );
      expect(result).toEqual(mockSubmitResponse);
    });
  });

  describe('getOrderStatus', () => {
    const orderHash = '0x123456789abcdef';
    const mockOrderStatus: OrderStatus = {
      orderHash,
      status: 'pending',
      remains: '1000000000000000000',
      filledPercent: 0,
      createDateTime: '2023-01-01T00:00:00Z',
    };

    it('should get order status successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockOrderStatus });

      const result = await fusionClient.getOrderStatus(orderHash);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/v2.0/1/fusion/orders/${orderHash}`
      );
      expect(result).toEqual(mockOrderStatus);
    });

    it('should throw error for empty order hash', async () => {
      await expect(fusionClient.getOrderStatus('')).rejects.toThrow(
        'Order hash is required'
      );
    });
  });

  describe('getTokenPrices', () => {
    const tokenAddresses = [
      '0xa0b86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d2',
      '0xb0c86a33e6c9b82c95b3b5c12a08f0a2a0e7f3d3',
    ];

    const mockTokenPrices: TokenPricesResponse = {
      [tokenAddresses[0]]: {
        price: 2000,
        timestamp: Date.now(),
      },
      [tokenAddresses[1]]: {
        price: 1,
        timestamp: Date.now(),
      },
    };

    it('should get token prices successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockTokenPrices });

      const result = await fusionClient.getTokenPrices(tokenAddresses);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v5.2/1/prices', {
        params: {
          tokens: tokenAddresses.join(','),
        },
      });
      expect(result).toEqual(mockTokenPrices);
    });

    it('should throw error for empty token addresses', async () => {
      await expect(fusionClient.getTokenPrices([])).rejects.toThrow(
        'Token addresses are required'
      );
    });
  });

  describe('getGasPrice', () => {
    const mockGasPrice: GasPriceResponse = {
      standard: '20000000000',
      fast: '25000000000',
      instant: '30000000000',
    };

    it('should get gas price successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockGasPrice });

      const result = await fusionClient.getGasPrice();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v5.2/1/gasPrice');
      expect(result).toEqual(mockGasPrice);
    });
  });

  describe('websocketSubscribe', () => {
    const mockSubscriptions = [
      {
        id: 1,
        method: 'subscribe' as const,
        params: {
          channel: 'orders' as const,
        },
      },
    ];

    it('should establish websocket connection', async () => {
      const promise = fusionClient.websocketSubscribe(mockSubscriptions);
      
      // Simulate websocket open
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({} as Event);
      }
      
      await promise;
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(mockSubscriptions[0])
      );
    });

    it('should throw error for empty subscriptions', async () => {
      await expect(fusionClient.websocketSubscribe([])).rejects.toThrow(
        'Subscriptions are required'
      );
    });
  });

  describe('getRateLimitUsage', () => {
    it('should return rate limit usage', () => {
      const usage = fusionClient.getRateLimitUsage();
      
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('limit');
      expect(usage).toHaveProperty('resetTime');
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.limit).toBe('number');
      expect(typeof usage.resetTime).toBe('number');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', async () => {
      await fusionClient.destroy();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
});