interface RateLimitConfig {
  requests: number;
  period: number; // milliseconds
}

interface RequestRecord {
  timestamp: number;
}

export class RateLimiter {
  private requests: RequestRecord[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if we can make a request within rate limits
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    const cutoff = now - this.config.period;
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(req => req.timestamp > cutoff);
    
    // Check if we're under the limit
    return this.requests.length < this.config.requests;
  }

  /**
   * Record a new request
   */
  recordRequest(): void {
    this.requests.push({ timestamp: Date.now() });
  }

  /**
   * Get time until next request is allowed
   */
  getRetryAfter(): number {
    if (this.canMakeRequest()) {
      return 0;
    }
    
    const now = Date.now();
    const oldestRequest = this.requests[0];
    const retryAfter = (oldestRequest.timestamp + this.config.period) - now;
    
    return Math.max(0, retryAfter);
  }

  /**
   * Wait until we can make a request
   */
  async waitForSlot(): Promise<void> {
    const retryAfter = this.getRetryAfter();
    if (retryAfter > 0) {
      await new Promise(resolve => setTimeout(resolve, retryAfter));
    }
  }

  /**
   * Get current usage stats
   */
  getUsage(): { used: number; limit: number; resetTime: number } {
    const now = Date.now();
    const cutoff = now - this.config.period;
    
    // Clean up old requests
    this.requests = this.requests.filter(req => req.timestamp > cutoff);
    
    const resetTime = this.requests.length > 0 
      ? this.requests[0].timestamp + this.config.period
      : now;
    
    return {
      used: this.requests.length,
      limit: this.config.requests,
      resetTime,
    };
  }
}