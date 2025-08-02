"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  User, 
  Activity, 
  Zap, 
  History, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  DollarSign,
  Gift
} from 'lucide-react';
import { toast } from './ui/use-toast';
import { formatEther } from 'ethers';

interface UserSwap {
  id: string;
  sourceToken: {
    symbol: string;
    name: string;
  };
  targetToken: {
    symbol: string;
    name: string;
  };
  sourceAmount: string;
  targetAmount: string;
  status: 'pending' | 'completed' | 'claiming' | 'claimed' | 'expired';
  createdAt: number;
  claimableAt?: number;
  txHash?: string;
  gasSavings?: string;
}

interface UserStats {
  totalSwaps: number;
  totalVolume: string;
  totalGasSaved: string;
  successRate: number;
  pendingClaims: number;
  claimedValue: string;
}

export function UserDashboard() {
  const { isConnected, user, accounts, login } = useWeb3Auth();
  
  const [userSwaps, setUserSwaps] = useState<UserSwap[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'swaps' | 'claims'>('overview');

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!isConnected || !accounts[0]) return;

    setIsLoading(true);
    try {
      // Load user swaps
      const swapsResponse = await fetch(`/api/fusion/swaps?userAddress=${accounts[0]}&limit=20`);
      if (swapsResponse.ok) {
        const swapsData = await swapsResponse.json();
        setUserSwaps(swapsData.swaps || []);
      }

      // Load user stats
      const statsResponse = await fetch(`/api/fusion/stats/user?address=${accounts[0]}`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setUserStats(statsData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load your dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, accounts]);

  // Get status display
  const getStatusDisplay = (status: UserSwap['status']) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          icon: <Clock className="h-3 w-3" />,
          text: 'Processing'
        };
      case 'completed':
        return {
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Ready to Claim'
        };
      case 'claiming':
        return {
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          icon: <Zap className="h-3 w-3" />,
          text: 'Claiming'
        };
      case 'claimed':
        return {
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Claimed'
        };
      case 'expired':
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Expired'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Unknown'
        };
    }
  };

  // Load data on mount
  useEffect(() => {
    if (isConnected) {
      loadUserData();
    }
  }, [isConnected, loadUserData]);

  // Login prompt for non-connected users
  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center space-x-2">
            <User className="h-6 w-6 text-blue-500" />
            <span>Dashboard</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your swap history and statistics
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
            <User className="h-6 w-6 text-blue-500" />
            <span>Your Dashboard</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back, {user?.name || 'Anonymous User'}
          </p>
        </div>
        <Button
          onClick={loadUserData}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{userStats.totalSwaps}</div>
                  <div className="text-sm text-gray-500">Total Swaps</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(userStats.totalVolume)}</div>
                  <div className="text-sm text-gray-500">Total Volume</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(userStats.totalGasSaved)}</div>
                  <div className="text-sm text-gray-500">Gas Saved</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Gift className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{userStats.pendingClaims}</div>
                  <div className="text-sm text-gray-500">Pending Claims</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="swaps">Swap History</TabsTrigger>
          <TabsTrigger value="claims">Claimable</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest swaps and claims</CardDescription>
              </CardHeader>
              <CardContent>
                {userSwaps.slice(0, 5).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userSwaps.slice(0, 5).map((swap) => {
                      const status = getStatusDisplay(swap.status);
                      return (
                        <div key={swap.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <ArrowUpDown className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-sm">
                                {swap.sourceToken.symbol} → {swap.targetToken.symbol}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatEther(swap.sourceAmount)} → {formatEther(swap.targetAmount)}
                              </div>
                            </div>
                          </div>
                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.text}</span>
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Your swap statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userStats && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{userStats.successRate.toFixed(1)}%</span>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Value Claimed</span>
                      <span className="font-medium">${formatEther(userStats.claimedValue)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Average Gas Savings</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        ${userStats.totalSwaps > 0 ? (parseFloat(formatEther(userStats.totalGasSaved)) / userStats.totalSwaps).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Swap History Tab */}
        <TabsContent value="swaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Swap History</CardTitle>
              <CardDescription>All your swap transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {userSwaps.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No swaps yet</h3>
                  <p className="text-gray-500">
                    Your swap history will appear here after you make your first swap.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userSwaps.map((swap) => {
                    const status = getStatusDisplay(swap.status);
                    return (
                      <div key={swap.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <ArrowUpDown className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {swap.sourceToken.symbol} → {swap.targetToken.symbol}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(swap.createdAt * 1000).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.text}</span>
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Source Amount:</span>
                            <div className="font-medium">
                              {formatEther(swap.sourceAmount)} {swap.sourceToken.symbol}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Target Amount:</span>
                            <div className="font-medium">
                              {formatEther(swap.targetAmount)} {swap.targetToken.symbol}
                            </div>
                          </div>
                        </div>
                        
                        {swap.gasSavings && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-500">Gas Savings:</span>
                            <span className="font-medium text-green-600 dark:text-green-400 ml-2">
                              ${formatEther(swap.gasSavings)}
                            </span>
                          </div>
                        )}
                        
                        {swap.txHash && (
                          <div className="mt-2 text-xs text-gray-500">
                            TX: {swap.txHash.slice(0, 10)}...{swap.txHash.slice(-10)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claimable Tab */}
        <TabsContent value="claims" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Claimable Tokens</CardTitle>
              <CardDescription>Tokens ready to be claimed gaslessly</CardDescription>
            </CardHeader>
            <CardContent>
              {userSwaps.filter(s => s.status === 'completed' || s.status === 'claiming').length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No claimable tokens</h3>
                  <p className="text-gray-500">
                    Tokens ready for gasless claiming will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userSwaps.filter(s => s.status === 'completed' || s.status === 'claiming').map((swap) => {
                    const status = getStatusDisplay(swap.status);
                    return (
                      <div key={swap.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Gift className="h-5 w-5 text-green-500" />
                            <div>
                              <div className="font-medium">
                                {formatEther(swap.targetAmount)} {swap.targetToken.symbol}
                              </div>
                              <div className="text-sm text-gray-500">
                                Ready to claim gaslessly
                              </div>
                            </div>
                          </div>
                          <Button size="sm" disabled={swap.status === 'claiming'}>
                            <Zap className="h-4 w-4 mr-1" />
                            {swap.status === 'claiming' ? 'Claiming...' : 'Claim'}
                          </Button>
                        </div>
                        
                        {swap.gasSavings && (
                          <div className="text-sm text-green-600 dark:text-green-400">
                            Gas savings: ${formatEther(swap.gasSavings)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UserDashboard;