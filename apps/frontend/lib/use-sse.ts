import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '../components/ui/use-toast';

export interface SSEOptions {
  onOpen?: (event: Event) => void;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onClose?: (event: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface SSEState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: any;
  reconnectAttempts: number;
}

export function useSSE(url: string | null, options: SSEOptions = {}) {
  const {
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [state, setState] = useState<SSEState>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!url || !mountedRef.current) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = (event) => {
        if (!mountedRef.current) return;
        
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          reconnectAttempts: 0,
        }));
        
        onOpen?.(event);
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          setState(prev => ({ ...prev, lastMessage: data }));
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (event) => {
        if (!mountedRef.current) return;
        
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'Connection failed',
        }));

        onError?.(event);

        // Auto-reconnect if enabled and under max attempts
        if (reconnect && state.reconnectAttempts < maxReconnectAttempts) {
          setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && eventSourceRef.current?.readyState !== EventSource.OPEN) {
              connect();
            }
          }, reconnectInterval);
        }
      };

      eventSource.onclose = (event) => {
        if (!mountedRef.current) return;
        
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
        }));
        
        onClose?.(event);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [url, onOpen, onMessage, onError, onClose, reconnect, reconnectInterval, maxReconnectAttempts, state.reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
    }));
  }, []);

  const retry = useCallback(() => {
    disconnect();
    setState(prev => ({ ...prev, reconnectAttempts: 0, error: null }));
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [url, connect, disconnect]);

  return {
    ...state,
    retry,
    disconnect,
  };
}

// Specialized hook for swap status updates
export function useSwapStatusSSE(swapId: string | null) {
  const [swapStatus, setSwapStatus] = useState<any>(null);
  
  const { connected, connecting, error, retry } = useSSE(
    swapId ? `/api/fusion/swaps/${swapId}/events` : null,
    {
      onMessage: (data) => {
        if (data.type === 'swap_status_update') {
          setSwapStatus(data.payload);
          
          // Show notification for important status changes
          if (data.payload.status === 'completed') {
            toast({
              title: "Swap Completed!",
              description: "Your tokens are ready to be claimed gaslessly.",
            });
          } else if (data.payload.status === 'failed') {
            toast({
              title: "Swap Failed",
              description: data.payload.error || "Your swap could not be completed.",
              variant: "destructive",
            });
          }
        }
      },
      onError: () => {
        console.error('Swap status SSE connection failed');
      },
    }
  );

  return {
    swapStatus,
    connected,
    connecting,
    error,
    retry,
  };
}

// Hook for pool status updates
export function usePoolStatusSSE() {
  const [poolStatus, setPoolStatus] = useState<any>(null);
  
  const { connected, connecting, error, retry } = useSSE('/api/fusion/pool/events', {
    onMessage: (data) => {
      if (data.type === 'pool_status_update') {
        setPoolStatus(data.payload);
      } else if (data.type === 'pool_alert') {
        // Show critical pool alerts
        if (data.payload.severity === 'critical') {
          toast({
            title: "Pool Alert",
            description: data.payload.message,
            variant: "destructive",
          });
        }
      }
    },
    onError: () => {
      console.error('Pool status SSE connection failed');
    },
  });

  return {
    poolStatus,
    connected,
    connecting,
    error,
    retry,
  };
}

// Hook for user notifications
export function useNotificationSSE(userAddress: string | null) {
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const { connected, connecting, error, retry } = useSSE(
    userAddress ? `/api/fusion/notifications/${userAddress}/events` : null,
    {
      onMessage: (data) => {
        if (data.type === 'notification') {
          setNotifications(prev => [data.payload, ...prev].slice(0, 50)); // Keep last 50
          
          // Show toast for new notifications
          toast({
            title: data.payload.title,
            description: data.payload.message,
          });
        }
      },
      onError: () => {
        console.error('Notification SSE connection failed');
      },
    }
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  return {
    notifications,
    connected,
    connecting,
    error,
    retry,
    clearNotifications,
    markAsRead,
  };
}

// Hook for system health monitoring
export function useSystemHealthSSE() {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  
  const { connected, connecting, error, retry } = useSSE('/api/fusion/system/health/events', {
    onMessage: (data) => {
      if (data.type === 'health_update') {
        setSystemHealth(data.payload);
        
        // Show alerts for system issues
        if (data.payload.status === 'degraded' || data.payload.status === 'down') {
          toast({
            title: "System Alert",
            description: data.payload.message || "System performance is degraded",
            variant: "destructive",
          });
        }
      }
    },
    onError: () => {
      console.error('System health SSE connection failed');
    },
    reconnectInterval: 5000, // Longer interval for system health
  });

  return {
    systemHealth,
    connected,
    connecting,
    error,
    retry,
  };
}

export default useSSE;