"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { useToast } from './ui/use-toast';
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Zap,
  RefreshCw,
  BarChart3,
  Loader2,
  Plus,
  Minus,
  Settings,
  Pause,
  Play
} from 'lucide-react';
import { ethers } from 'ethers';

interface PoolLiquidity {
  address: string;
  symbol: string;
  name: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  minThreshold: string;
  utilizationRate: number;
  priceUsd?: string;
  decimals: number;
}

interface PoolMetrics {
  totalValueLocked: string;
  totalSwapsToday: number;
  totalVolumeToday: string;
  activeSwaps: number;
  successRate: number;
  averageProcessingTime: number;
  gasFeesSpent: string;
  revenueGenerated: string;
}

interface ResolverStatus {
  isActive: boolean;
  queueSize: number;
  processing: boolean;
  lastProcessedAt: string;
  errorCount: number;
  swapsProcessed24h: number;
  avgProcessingTime: number;
  successRate: number;
}

interface RecentOperation {
  id: string;
  type: 'SWAP_CREATED' | 'POOL_FULFILLED' | 'USER_CLAIMED' | 'LIQUIDITY_ADDED' | 'LIQUIDITY_REMOVED';
  timestamp: string;
  amount: string;
  token: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  txHash?: string;
}

export const PoolDashboard: React.FC = () => {
  const { toast } = useToast();

  const [poolLiquidity, setPoolLiquidity] = useState<PoolLiquidity[]>([]);
  const [poolMetrics, setPoolMetrics] = useState<PoolMetrics | null>(null);
  const [resolverStatus, setResolverStatus] = useState<ResolverStatus | null>(null);
  const [recentOperations, setRecentOperations] = useState<RecentOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch pool status
      const poolResponse = await fetch('/api/fusion/pool/status');
      const poolData = await poolResponse.json();
      
      if (poolData.success) {
        setPoolLiquidity(poolData.tokens || []);
      }

      // Fetch pool metrics
      const metricsResponse = await fetch('/api/fusion/pool/metrics');
      const metricsData = await metricsResponse.json();
      
      if (metricsData.success) {
        setPoolMetrics(metricsData.metrics);
      }

      // Fetch resolver status
      const resolverResponse = await fetch('/api/fusion/resolver/status');
      const resolverData = await resolverResponse.json();
      
      if (resolverData.success) {
        setResolverStatus(resolverData.status);
      }

      // Fetch recent operations
      const operationsResponse = await fetch('/api/fusion/pool/operations/recent');
      const operationsData = await operationsResponse.json();
      
      if (operationsData.success) {
        setRecentOperations(operationsData.operations || []);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Format large numbers
  const formatNumber = (num: string | number, decimals = 2) => {
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    if (parsed === 0) return '0';
    if (parsed < 0.01) return '< 0.01';
    if (parsed >= 1000000) return `${(parsed / 1000000).toFixed(decimals)}M`;
    if (parsed >= 1000) return `${(parsed / 1000).toFixed(decimals)}K`;
    return parsed.toFixed(decimals);
  };

  // Format token amount
  const formatTokenAmount = (amount: string, decimals: number) => {
    const formatted = ethers.formatUnits(amount, decimals);
    return formatNumber(formatted);
  };

  // Get liquidity status
  const getLiquidityStatus = (pool: PoolLiquidity) => {
    const available = parseFloat(ethers.formatUnits(pool.availableBalance, pool.decimals));
    const threshold = parseFloat(ethers.formatUnits(pool.minThreshold, pool.decimals));
    
    if (available < threshold) {
      return { status: 'low', color: 'text-red-500', icon: AlertTriangle };
    } else if (available < threshold * 2) {
      return { status: 'medium', color: 'text-yellow-500', icon: Clock };
    } else {
      return { status: 'good', color: 'text-green-500', icon: CheckCircle };
    }
  };

  // Get operation icon
  const getOperationIcon = (type: RecentOperation['type']) => {
    switch (type) {
      case 'SWAP_CREATED':
        return <Activity className="h-4 w-4" />;
      case 'POOL_FULFILLED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'USER_CLAIMED':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'LIQUIDITY_ADDED':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'LIQUIDITY_REMOVED':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Format operation type
  const formatOperationType = (type: RecentOperation['type']) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Effects
  useEffect(() => {
    fetchDashboardData();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchDashboardData, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pool Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor liquidity, performance, and system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {poolMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Value Locked</p>
                  <p className="text-2xl font-bold">${formatNumber(poolMetrics.totalValueLocked)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">24h Volume</p>
                  <p className="text-2xl font-bold">${formatNumber(poolMetrics.totalVolumeToday)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Swaps</p>
                  <p className="text-2xl font-bold">{poolMetrics.activeSwaps}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{poolMetrics.successRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Liquidity</CardTitle>
            <CardDescription>Current token balances and utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {poolLiquidity.map((pool) => {
              const status = getLiquidityStatus(pool);
              const StatusIcon = status.icon;
              
              return (
                <div key={pool.address} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className="font-medium">{pool.symbol}</span>
                      <span className="text-sm text-muted-foreground">{pool.name}</span>
                    </div>
                    <Badge variant={status.status === 'low' ? 'destructive' : status.status === 'medium' ? 'secondary' : 'default'}>
                      {status.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Available: {formatTokenAmount(pool.availableBalance, pool.decimals)} {pool.symbol}</span>
                      <span>Reserved: {formatTokenAmount(pool.reservedBalance, pool.decimals)} {pool.symbol}</span>
                    </div>
                    <Progress value={pool.utilizationRate} className="h-2" />
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Utilization: {pool.utilizationRate.toFixed(1)}%
                      </div>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Resolver Status */}
        <Card>
          <CardHeader>
            <CardTitle>Resolver Status</CardTitle>
            <CardDescription>System health and processing metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {resolverStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${resolverStatus.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    {resolverStatus.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {resolverStatus.processing && (
                    <Badge variant="default" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Queue Size:</span>
                    <div className="font-medium">{resolverStatus.queueSize}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <div className="font-medium">{resolverStatus.successRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">24h Processed:</span>
                    <div className="font-medium">{resolverStatus.swapsProcessed24h}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Time:</span>
                    <div className="font-medium">{resolverStatus.avgProcessingTime.toFixed(1)}s</div>
                  </div>
                </div>

                {resolverStatus.errorCount > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">{resolverStatus.errorCount} errors in the last hour</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No resolver data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Operations</CardTitle>
          <CardDescription>Latest pool and swap activities</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOperations.length > 0 ? (
            <div className="space-y-3">
              {recentOperations.slice(0, 10).map((operation) => (
                <div key={operation.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {getOperationIcon(operation.type)}
                    <div>
                      <div className="font-medium">{formatOperationType(operation.type)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(operation.amount)} {operation.token}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant={
                        operation.status === 'SUCCESS' ? 'default' : 
                        operation.status === 'PENDING' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {operation.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(operation.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No recent operations</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};