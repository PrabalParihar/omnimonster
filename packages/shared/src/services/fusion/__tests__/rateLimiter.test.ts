import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  
  const mockConfig = {
    requests: 5,
    period: 1000, // 1 second
  };

  beforeEach(() => {
    rateLimiter = new RateLimiter(mockConfig);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('canMakeRequest', () => {
    it('should allow requests within limit', () => {
      expect(rateLimiter.canMakeRequest()).toBe(true);
      
      // Make 4 requests (under limit)
      for (let i = 0; i < 4; i++) {
        rateLimiter.recordRequest();
        expect(rateLimiter.canMakeRequest()).toBe(true);
      }
    });

    it('should block requests when limit is reached', () => {
      // Fill up the rate limit
      for (let i = 0; i < mockConfig.requests; i++) {
        rateLimiter.recordRequest();
      }
      
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    it('should allow requests after time window expires', () => {
      // Fill up the rate limit
      for (let i = 0; i < mockConfig.requests; i++) {
        rateLimiter.recordRequest();
      }
      
      expect(rateLimiter.canMakeRequest()).toBe(false);
      
      // Advance time beyond the period
      vi.advanceTimersByTime(mockConfig.period + 1);
      
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should record request timestamp', () => {
      const initialUsage = rateLimiter.getUsage();
      expect(initialUsage.used).toBe(0);
      
      rateLimiter.recordRequest();
      
      const updatedUsage = rateLimiter.getUsage();
      expect(updatedUsage.used).toBe(1);
    });
  });

  describe('getRetryAfter', () => {
    it('should return 0 when requests are allowed', () => {
      expect(rateLimiter.getRetryAfter()).toBe(0);
    });

    it('should return wait time when limit is reached', () => {
      // Fill up the rate limit
      for (let i = 0; i < mockConfig.requests; i++) {
        rateLimiter.recordRequest();
      }
      
      const retryAfter = rateLimiter.getRetryAfter();
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(mockConfig.period);
    });

    it('should return 0 after time window expires', () => {
      // Fill up the rate limit
      for (let i = 0; i < mockConfig.requests; i++) {
        rateLimiter.recordRequest();
      }
      
      // Advance time beyond the period
      vi.advanceTimersByTime(mockConfig.period + 1);
      
      expect(rateLimiter.getRetryAfter()).toBe(0);
    });
  });

  describe('waitForSlot', () => {
    it('should resolve immediately when requests are allowed', async () => {
      const startTime = Date.now();
      await rateLimiter.waitForSlot();
      const endTime = Date.now();
      
      // Should complete almost instantly (within 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should wait when limit is reached', async () => {
      // Fill up the rate limit
      for (let i = 0; i < mockConfig.requests; i++) {
        rateLimiter.recordRequest();
      }
      
      const waitPromise = rateLimiter.waitForSlot();
      
      // Should not resolve immediately
      let resolved = false;
      waitPromise.then(() => { resolved = true; });
      
      // Advance time a little bit
      vi.advanceTimersByTime(100);
      await Promise.resolve(); // Let any pending promises resolve
      expect(resolved).toBe(false);
      
      // Advance time beyond the period
      vi.advanceTimersByTime(mockConfig.period);
      await waitPromise;
      
      expect(resolved).toBe(true);
    });
  });

  describe('getUsage', () => {
    it('should return correct usage stats', () => {
      const initialUsage = rateLimiter.getUsage();
      expect(initialUsage.used).toBe(0);
      expect(initialUsage.limit).toBe(mockConfig.requests);
      expect(typeof initialUsage.resetTime).toBe('number');
      
      // Make some requests
      rateLimiter.recordRequest();
      rateLimiter.recordRequest();
      
      const updatedUsage = rateLimiter.getUsage();
      expect(updatedUsage.used).toBe(2);
      expect(updatedUsage.limit).toBe(mockConfig.requests);
    });

    it('should clean up old requests', () => {
      // Make some requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest();
      }
      
      expect(rateLimiter.getUsage().used).toBe(3);
      
      // Advance time beyond the period
      vi.advanceTimersByTime(mockConfig.period + 1);
      
      // Old requests should be cleaned up
      expect(rateLimiter.getUsage().used).toBe(0);
    });
  });
});