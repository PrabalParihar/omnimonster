/**
 * Custom error classes for better error handling and debugging
 */

export class SwapSageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SwapSageError';
  }
}

export class HTLCError extends SwapSageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'HTLC_ERROR', context);
    this.name = 'HTLCError';
  }
}

export class NetworkError extends SwapSageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends SwapSageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class WalletError extends SwapSageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WALLET_ERROR', context);
    this.name = 'WalletError';
  }
}

export type ErrorHandler = (error: Error, context?: Record<string, unknown>) => void;

/**
 * Utility function to wrap async operations with proper error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler?: ErrorHandler,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error as Error, context);
    }
    throw error;
  }
}

/**
 * Convert unknown errors to structured errors
 */
export function normalizeError(error: unknown, context?: Record<string, unknown>): SwapSageError {
  if (error instanceof SwapSageError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new SwapSageError(error.message, 'UNKNOWN_ERROR', { 
      originalName: error.name, 
      stack: error.stack,
      ...context 
    });
  }
  
  return new SwapSageError(
    String(error), 
    'UNKNOWN_ERROR', 
    { originalError: error, ...context }
  );
}