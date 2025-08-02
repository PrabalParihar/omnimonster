import React, { useState, useCallback } from 'react';
import { toast } from '../components/ui/use-toast';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface ApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export function useApi<T = any>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (
    apiCall: () => Promise<Response>,
    options: ApiOptions = {}
  ) => {
    const {
      onSuccess,
      onError,
      showSuccessToast = false,
      showErrorToast = true,
      successMessage = 'Operation completed successfully',
      errorMessage,
    } = options;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall();
      
      if (!response.ok) {
        let errorMsg = errorMessage || 'An error occurred';
        
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch {
          // If response is not JSON, use status text
          errorMsg = response.statusText || errorMsg;
        }
        
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (showSuccessToast) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      onSuccess?.(data);
      return data;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState({
        data: null,
        loading: false,
        error: errorMsg,
      });

      if (showErrorToast) {
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }

      onError?.(errorMsg);
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specialized hooks for common API patterns
export function useApiMutation<T = any>(options: ApiOptions = {}) {
  return useApi<T>();
}

export function useApiQuery<T = any>(
  apiCall: () => Promise<Response>,
  dependencies: any[] = [],
  options: ApiOptions = {}
) {
  const api = useApi<T>();

  const refetch = useCallback(() => {
    return api.execute(apiCall, options);
  }, [api, apiCall, options]);

  // Auto-execute on mount and dependency changes
  React.useEffect(() => {
    refetch();
  }, dependencies);

  return {
    ...api,
    refetch,
  };
}

// HTTP method helpers
export const apiClient = {
  get: (url: string, options?: RequestInit) =>
    fetch(url, { method: 'GET', ...options }),
    
  post: (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
    
  put: (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
    
  delete: (url: string, options?: RequestInit) =>
    fetch(url, { method: 'DELETE', ...options }),
};

// Error types for better error handling
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

// Error handler utility
export function handleApiError(error: any): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error instanceof NetworkError) {
    return 'Connection failed. Please check your internet connection.';
  }
  
  if (error instanceof ValidationError) {
    return error.message;
  }
  
  if (error?.code === 'NETWORK_ERROR') {
    return 'Unable to connect to the server. Please try again.';
  }
  
  if (error?.code === 'TIMEOUT') {
    return 'Request timed out. Please try again.';
  }
  
  return error?.message || 'An unexpected error occurred';
}

// Retry utility with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export default useApi;