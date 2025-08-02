"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Add your error logging service here
      console.error('Production error:', { error, errorInfo });
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return <DefaultErrorFallback error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

export function DefaultErrorFallback({ error, retry }: ErrorFallbackProps) {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription>
            We're sorry, but something unexpected happened.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Error Details (Development):
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col space-y-2">
            <Button onClick={retry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button onClick={handleGoHome} variant="outline" className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-gray-500">
              If this problem persists, please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading components
export function LoadingSpinner({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
    </div>
  );
}

export function LoadingCard({ title, description }: { title?: string; description?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-8">
        <LoadingSpinner size="lg" />
        {title && <h3 className="mt-4 text-lg font-medium">{title}</h3>}
        {description && <p className="mt-2 text-sm text-gray-500 text-center">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function FullPageLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

// Network error component
export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardContent className="flex items-center space-x-3 p-4">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Connection Error
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            Unable to connect to the server. Please check your connection.
          </p>
        </div>
        <Button onClick={onRetry} size="sm" variant="outline">
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// Transaction error component
export function TransactionError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              Transaction Failed
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">
              {error}
            </p>
            {onRetry && (
              <Button onClick={onRetry} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state component
export function EmptyState({ 
  icon: Icon = AlertTriangle, 
  title, 
  description, 
  action 
}: {
  icon?: React.ComponentType<any>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {description}
      </p>
      {action && action}
    </div>
  );
}

export default ErrorBoundary;