import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import WebSocket from 'isomorphic-ws';
import { EventEmitter } from 'events';
import { RateLimiter } from './rateLimiter';
import {
  FusionConfig,
  FusionConfigSchema,
  QuoteRequest,
  QuoteRequestSchema,
  QuoteResponse,
  QuoteResponseSchema,
  CreateOrderRequest,
  CreateOrderRequestSchema,
  FusionOrder,
  FusionOrderSchema,
  SubmitOrderRequest,
  SubmitOrderRequestSchema,
  SubmitOrderResponse,
  SubmitOrderResponseSchema,
  OrderStatus,
  OrderStatusSchema,
  TokenPricesResponse,
  TokenPricesResponseSchema,
  GasPriceResponse,
  GasPriceResponseSchema,
  WSSubscriptionRequest,
  WSSubscriptionRequestSchema,
  WSMessage,
  WSMessageSchema,
  APIError,
  APIErrorSchema,
  FusionEvents,
} from './types';

export class FusionClient extends EventEmitter {
  private config: FusionConfig;
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private websocket: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private wsMaxReconnectAttempts = 5;
  private wsReconnectDelay = 1000;

  constructor(config: Partial<FusionConfig>) {
    super();
    
    // Validate and set default config
    this.config = FusionConfigSchema.parse(config);
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      requests: this.config.rateLimit.requests,
      period: this.config.rateLimit.period,
    });

    // Setup Axios client
    this.client = axios.create({
      baseURL: this.config.restUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Setup request interceptor for rate limiting
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      await this.rateLimiter.waitForSlot();
      this.rateLimiter.recordRequest();
      return config;
    });

    // Setup response interceptor for retry logic
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: any) => {
        const config = error.config;
        
        if (!config._retry) {
          config._retry = 0;
        }

        if (config._retry < this.config.retries && this.isRetryableError(error)) {
          config._retry++;
          
          const delay = this.config.retryDelay * Math.pow(2, config._retry - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.client.request(config);
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Get a quote for a token swap
   */
  async getFusionQuote(params: QuoteRequest): Promise<QuoteResponse> {
    const validatedParams = QuoteRequestSchema.parse(params);
    
    try {
      const response: AxiosResponse<QuoteResponse> = await this.client.get('/v5.2/1/quote', {
        params: validatedParams,
      });
      
      return QuoteResponseSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Create a Fusion order and return signed payload
   */
  async createFusionOrder(params: CreateOrderRequest): Promise<FusionOrder> {
    const validatedParams = CreateOrderRequestSchema.parse(params);
    
    try {
      const response: AxiosResponse<FusionOrder> = await this.client.post('/v2.0/1/fusion/order', validatedParams);
      
      return FusionOrderSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Submit a signed order to the network
   */
  async submitOrder(params: SubmitOrderRequest): Promise<SubmitOrderResponse> {
    const validatedParams = SubmitOrderRequestSchema.parse(params);
    
    try {
      const response: AxiosResponse<SubmitOrderResponse> = await this.client.post('/v2.0/1/fusion/submit', validatedParams);
      
      return SubmitOrderResponseSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Get the status of an order
   */
  async getOrderStatus(orderHash: string): Promise<OrderStatus> {
    if (!orderHash) {
      throw new Error('Order hash is required');
    }
    
    try {
      const response: AxiosResponse<OrderStatus> = await this.client.get(`/v2.0/1/fusion/orders/${orderHash}`);
      
      return OrderStatusSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Get current token prices
   */
  async getTokenPrices(tokenAddresses: string[]): Promise<TokenPricesResponse> {
    if (!tokenAddresses || tokenAddresses.length === 0) {
      throw new Error('Token addresses are required');
    }
    
    try {
      const response: AxiosResponse<TokenPricesResponse> = await this.client.get('/v5.2/1/prices', {
        params: {
          tokens: tokenAddresses.join(','),
        },
      });
      
      return TokenPricesResponseSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Get current gas prices
   */
  async getGasPrice(): Promise<GasPriceResponse> {
    try {
      const response: AxiosResponse<GasPriceResponse> = await this.client.get('/v5.2/1/gasPrice');
      
      return GasPriceResponseSchema.parse(response.data);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Subscribe to WebSocket updates
   */
  async websocketSubscribe(subscriptions: WSSubscriptionRequest[]): Promise<void> {
    if (!subscriptions || subscriptions.length === 0) {
      throw new Error('Subscriptions are required');
    }

    // Validate subscriptions
    subscriptions.forEach(sub => WSSubscriptionRequestSchema.parse(sub));

    if (this.websocket) {
      await this.websocketDisconnect();
    }

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.wsUrl, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        });

        this.websocket.onopen = () => {
          this.wsReconnectAttempts = 0;
          this.emit('connected');
          
          // Send subscription requests
          subscriptions.forEach(subscription => {
            this.websocket?.send(JSON.stringify(subscription));
          });
          
          resolve();
        };

        this.websocket.onmessage = (event: any) => {
          try {
            const message = WSMessageSchema.parse(JSON.parse(event.data.toString()));
            this.handleWebSocketMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Invalid WebSocket message: ${error}`));
          }
        };

        this.websocket.onerror = (error: any) => {
          this.emit('error', error);
          reject(error);
        };

        this.websocket.onclose = () => {
          this.emit('disconnected');
          this.handleWebSocketReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  async websocketDisconnect(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  /**
   * Get current rate limiter usage
   */
  getRateLimitUsage() {
    return this.rateLimiter.getUsage();
  }

  /**
   * Destroy the client and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.websocketDisconnect();
    this.removeAllListeners();
  }

  private handleWebSocketMessage(message: WSMessage): void {
    if (!message.params) return;

    const { channel, data } = message.params;

    switch (channel) {
      case 'orders':
        try {
          const orderStatus = OrderStatusSchema.parse(data);
          this.emit('orderUpdate', orderStatus);
        } catch (error) {
          this.emit('error', new Error(`Invalid order update: ${error}`));
        }
        break;

      case 'prices':
        try {
          const prices = TokenPricesResponseSchema.parse(data);
          this.emit('priceUpdate', prices);
        } catch (error) {
          this.emit('error', new Error(`Invalid price update: ${error}`));
        }
        break;

      case 'gasPrice':
        try {
          const gasPrice = GasPriceResponseSchema.parse(data);
          this.emit('gasPriceUpdate', gasPrice);
        } catch (error) {
          this.emit('error', new Error(`Invalid gas price update: ${error}`));
        }
        break;

      default:
        this.emit('error', new Error(`Unknown channel: ${channel}`));
    }
  }

  private handleWebSocketReconnect(): void {
    if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
      this.emit('error', new Error('Max WebSocket reconnection attempts reached'));
      return;
    }

    this.wsReconnectAttempts++;
    const delay = this.wsReconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);

    setTimeout(async () => {
      try {
        // Re-establish connection with previous subscriptions
        // Note: In a real implementation, you'd want to store the subscriptions
        // and reuse them here
        this.emit('error', new Error('WebSocket reconnection not fully implemented'));
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }, delay);
  }

  private isRetryableError(error: any): boolean {
    if (!error.response) return true; // Network errors are retryable
    
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors and rate limits
  }

  private normalizeError(error: any): Error {
    if (error.response?.data) {
      try {
        const apiError = APIErrorSchema.parse(error.response.data);
        return new Error(`API Error (${apiError.statusCode}): ${apiError.description}`);
      } catch {
        // Fall back to generic error handling
      }
    }

    if (error.message) {
      return new Error(error.message);
    }

    return new Error('Unknown error occurred');
  }
}

// TypeScript declaration merging for EventEmitter
export declare interface FusionClient {
  on<K extends keyof FusionEvents>(event: K, listener: FusionEvents[K]): this;
  emit<K extends keyof FusionEvents>(event: K, ...args: Parameters<FusionEvents[K]>): boolean;
}