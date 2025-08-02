"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  BarChart3, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Droplets,
  Settings
} from 'lucide-react';
import { toast } from './ui/use-toast';
import { formatEther } from 'ethers';

interface PoolToken {
  address: string;
  symbol: string;
  name: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  utilizationRate: number;
  dailyVolume: string;
  weeklyVolume: string;
  totalSwaps: number;
  pendingSwaps: number;
  averageSwapSize: string;
  priceUSD: number;
  network: string;
}

interface PoolStats {
  totalValueLocked: string;
  totalVolume24h: string;
  totalVolume7d: string;
  totalSwaps: number;
  activeUsers: number;
  averageGasSavings: string;
  totalGasSavings: string;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: number;
}

interface RecentActivity {
  id: string;
  type: 'swap' | 'claim' | 'deposit' | 'withdrawal';
  user: string;
  sourceToken: string;
  targetToken: string;
  amount: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  gasSaved?: string;
}

export function PoolMonitor() {
  const { isConnected, user, accounts, login } = useWeb3Auth();
  
  const [poolTokens, setPoolTokens] = useState<PoolToken[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load pool data
  const loadPoolData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tokensRes, statsRes, activityRes] = await Promise.all([
        fetch('/api/fusion/pool/status'),
        fetch(`/api/fusion/pool/stats?timeframe=${selectedTimeframe}`),
        fetch('/api/fusion/pool/activity?limit=20')
      ]);

      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        setPoolTokens(tokensData.tokens || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setPoolStats(statsData);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData.activities || []);
      }
    } catch (error) {
      console.error('Error loading pool data:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load pool monitoring data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTimeframe]);

  // Get system health display
  const getSystemHealthDisplay = (health: PoolStats['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900',
          icon: <CheckCircle className="h-4 w-4" />,
          text: 'Healthy'
        };
      case 'warning':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900',
          icon: <AlertTriangle className="h-4 w-4" />,
          text: 'Warning'
        };
      case 'critical':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900',
          icon: <AlertTriangle className="h-4 w-4" />,
          text: 'Critical'
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900',
          icon: <Clock className="h-4 w-4" />,
          text: 'Unknown'
        };
    }
  };

  // Get utilization color
  const getUtilizationColor = (rate: number) => {
    if (rate < 50) return 'bg-green-500';
    if (rate < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Format activity type
  const formatActivityType = (type: RecentActivity['type']) => {
    switch (type) {
      case 'swap': return { icon: <Activity className="h-4 w-4" />, label: 'Swap' };
      case 'claim': return { icon: <Zap className="h-4 w-4" />, label: 'Claim' };
      case 'deposit': return { icon: <TrendingUp className="h-4 w-4" />, label: 'Deposit' };
      case 'withdrawal': return { icon: <TrendingDown className="h-4 w-4" />, label: 'Withdrawal' };
      default: return { icon: <Activity className="h-4 w-4" />, label: 'Unknown' };
    }
  };

  // Format status badge
  const getStatusBadge = (status: RecentActivity['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Unknown</Badge>;
    }
  };

  // Load data on mount and timeframe change
  useEffect(() => {
    loadPoolData();
  }, [loadPoolData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadPoolData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadPoolData]);

  // Login prompt for non-connected users
  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center space-x-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <span>Pool Monitor</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to access pool monitoring dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => login()} size="lg" className="w-full">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <span>Pool Monitor</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring of Fusion Swap liquidity pools
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Auto-refresh:</label>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
          
          <Button
            onClick={loadPoolData}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health & Stats */}
      {poolStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(poolStats.totalValueLocked)}</div>
                  <div className="text-sm text-gray-500">Total Value Locked</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(poolStats.totalVolume24h)}</div>
                  <div className="text-sm text-gray-500">24h Volume</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{poolStats.activeUsers}</div>
                  <div className="text-sm text-gray-500">Active Users</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(poolStats.totalGasSavings)}</div>
                  <div className="text-sm text-gray-500">Gas Savings</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Health */}
      {poolStats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-lg font-medium">System Health</div>
                {(() => {
                  const health = getSystemHealthDisplay(poolStats.systemHealth);
                  return (
                    <Badge className={health.bgColor}>
                      {health.icon}
                      <span className="ml-1">{health.text}</span>
                    </Badge>
                  );
                })()}
              </div>
              <div className="text-sm text-gray-500">
                Uptime: {poolStats.uptime.toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="tokens" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tokens">Pool Tokens</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Pool Tokens Tab */}
        <TabsContent value="tokens" className="space-y-4">
          {isLoading && poolTokens.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading pool tokens...</span>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {poolTokens.map((token) => (
                <Card key={`${token.address}-${token.network}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <Droplets className="h-5 w-5 text-blue-500" />
                        <span>{token.symbol}</span>
                      </CardTitle>
                      <Badge variant="outline">{token.network}</Badge>
                    </div>
                    <CardDescription>{token.name}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Balances */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-1">Total</div>
                        <div className="font-medium">{formatEther(token.totalBalance)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">Available</div>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatEther(token.availableBalance)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">Reserved</div>
                        <div className="font-medium text-orange-600 dark:text-orange-400">
                          {formatEther(token.reservedBalance)}
                        </div>
                      </div>
                    </div>

                    {/* Utilization */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Utilization</span>
                        <span className="text-sm font-medium">{token.utilizationRate.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={token.utilizationRate} 
                        className={`h-2 ${getUtilizationColor(token.utilizationRate)}`}
                      />
                    </div>

                    {/* Volume & Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 mb-1">24h Volume</div>
                        <div className="font-medium">${formatEther(token.dailyVolume)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">7d Volume</div>
                        <div className="font-medium">${formatEther(token.weeklyVolume)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">Total Swaps</div>
                        <div className="font-medium">{token.totalSwaps}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">Pending</div>
                        <div className="font-medium text-yellow-600 dark:text-yellow-400">
                          {token.pendingSwaps}
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-gray-500">Current Price</span>
                      <span className="text-sm font-medium">${token.priceUSD.toFixed(4)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest pool interactions and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => {
                    const activityType = formatActivityType(activity.type);
                    return (
                      <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            {activityType.icon}
                          </div>
                          <div>
                            <div className="font-medium">
                              {activityType.label}: {activity.sourceToken} → {activity.targetToken}
                            </div>
                            <div className="text-sm text-gray-500">
                              {activity.user.slice(0, 6)}...{activity.user.slice(-4)} • 
                              {formatEther(activity.amount)} • 
                              ${formatEther(activity.value)}
                              {activity.gasSaved && (
                                <span className="text-green-600 dark:text-green-400">
                                  {' '}• Saved ${formatEther(activity.gasSaved)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(activity.status)}
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(activity.timestamp * 1000).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timeframe Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Analytics Timeframe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  {(['24h', '7d', '30d'] as const).map((timeframe) => (
                    <Button
                      key={timeframe}
                      variant={selectedTimeframe === timeframe ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTimeframe(timeframe)}
                    >
                      {timeframe}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {poolStats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Average Gas Savings</span>
                      <span className="font-medium">${formatEther(poolStats.averageGasSavings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Swaps</span>
                      <span className="font-medium">{poolStats.totalSwaps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">System Uptime</span>
                      <span className="font-medium">{poolStats.uptime.toFixed(2)}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Volume Chart</CardTitle>
              <CardDescription>Trading volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-center text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  <div>Chart visualization coming soon</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PoolMonitor;