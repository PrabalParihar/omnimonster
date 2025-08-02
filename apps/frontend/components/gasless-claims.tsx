"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  Zap, 
  Loader2, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  Gift
} from 'lucide-react';
import { toast } from './ui/use-toast';
import { formatEther } from 'ethers';

interface ClaimableSwap {
  id: string;
  sourceToken: {
    address: string;
    symbol: string;
    name: string;
  };
  targetToken: {
    address: string;
    symbol: string;
    name: string;
  };
  amount: string;
  claimableAmount: string;
  status: 'pending' | 'ready' | 'claiming' | 'claimed' | 'expired';
  expirationTime: number;
  gasCostSavings: string;
  txHash?: string;
  createdAt: number;
  network: string;
}

interface GaslessClaimStats {
  totalClaims: number;
  totalSavings: string;
  pendingClaims: number;
  successRate: number;
}

export function GaslessClaims() {
  const { isConnected, user, accounts, login } = useWeb3Auth();
  
  const [claimableSwaps, setClaimableSwaps] = useState<ClaimableSwap[]>([]);
  const [stats, setStats] = useState<GaslessClaimStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Load claimable swaps for user
  const loadClaimableSwaps = useCallback(async () => {
    if (!isConnected || !accounts[0]) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/fusion/claims/gasless?userAddress=${accounts[0]}`);
      if (response.ok) {
        const data = await response.json();
        setClaimableSwaps(data.swaps || []);
        setStats(data.stats || null);
      } else {
        console.error('Failed to load claimable swaps');
      }
    } catch (error) {
      console.error('Error loading claimable swaps:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load your claimable swaps",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, accounts]);

  // Execute gasless claim
  const executeClaim = async (swapId: string) => {
    if (!isConnected) return;

    setClaimingIds(prev => new Set(prev).add(swapId));
    
    try {
      const response = await fetch('/api/fusion/claims/gasless', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swapId,
          userAddress: accounts[0],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: "Claim Successful!",
          description: `Tokens claimed gaslessly. TX: ${result.txHash?.slice(0, 8)}...`,
        });

        // Update the swap status
        setClaimableSwaps(prev => 
          prev.map(swap => 
            swap.id === swapId 
              ? { ...swap, status: 'claimed' as const, txHash: result.txHash }
              : swap
          )
        );

        // Refresh data
        setTimeout(() => {
          loadClaimableSwaps();
        }, 2000);

      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim tokens');
      }
    } catch (error) {
      console.error('Claim execution error:', error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim tokens",
        variant: "destructive",
      });
    } finally {
      setClaimingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(swapId);
        return newSet;
      });
    }
  };

  // Copy transaction hash
  const copyTxHash = async (txHash: string) => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedTxId(txHash);
      toast({
        title: "Copied!",
        description: "Transaction hash copied to clipboard",
      });
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy transaction hash",
        variant: "destructive",
      });
    }
  };

  // Get status color and icon
  const getStatusDisplay = (status: ClaimableSwap['status']) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          icon: <Clock className="h-3 w-3" />,
          text: 'Processing'
        };
      case 'ready':
        return {
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          icon: <Gift className="h-3 w-3" />,
          text: 'Ready to Claim'
        };
      case 'claiming':
        return {
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
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

  // Calculate time remaining
  const getTimeRemaining = (expirationTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expirationTime - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Load data on mount and when connected
  useEffect(() => {
    if (isConnected) {
      loadClaimableSwaps();
    }
  }, [isConnected, loadClaimableSwaps]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      loadClaimableSwaps();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, loadClaimableSwaps]);

  // Login prompt for non-connected users
  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center space-x-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            <span>Gasless Claims</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to view and claim your tokens without gas fees
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
            <Zap className="h-6 w-6 text-yellow-500" />
            <span>Gasless Claims</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Claim your tokens without paying gas fees
          </p>
        </div>
        <Button
          onClick={loadClaimableSwaps}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Gift className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalClaims}</div>
                  <div className="text-sm text-gray-500">Total Claims</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">${formatEther(stats.totalSavings)}</div>
                  <div className="text-sm text-gray-500">Total Savings</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.pendingClaims}</div>
                  <div className="text-sm text-gray-500">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Claimable Swaps */}
      <div className="space-y-4">
        {isLoading && claimableSwaps.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading your claimable swaps...</span>
            </CardContent>
          </Card>
        ) : claimableSwaps.length === 0 ? (
          <Card>
            <CardContent className="text-center p-8">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Claimable Swaps</h3>
              <p className="text-gray-500">
                You don't have any swaps ready to claim yet. Start a swap to see claims here.
              </p>
            </CardContent>
          </Card>
        ) : (
          claimableSwaps.map((swap) => {
            const status = getStatusDisplay(swap.status);
            const isClaiming = claimingIds.has(swap.id);
            const timeRemaining = getTimeRemaining(swap.expirationTime);
            
            return (
              <Card key={swap.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-lg font-medium">
                        {formatEther(swap.claimableAmount)} {swap.targetToken.symbol}
                      </div>
                      <Badge className={status.color}>
                        {status.icon}
                        <span className="ml-1">{status.text}</span>
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(swap.createdAt * 1000).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Swap Details</div>
                      <div className="text-sm">
                        {formatEther(swap.amount)} {swap.sourceToken.symbol} → {swap.targetToken.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        Network: {swap.network}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500 mb-1">Gas Savings</div>
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                        ~${formatEther(swap.gasCostSavings)} saved
                      </div>
                      <div className="text-xs text-gray-400">
                        Expires: {timeRemaining}
                      </div>
                    </div>
                  </div>

                  {swap.txHash && (
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="text-sm text-gray-500">Transaction:</div>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {swap.txHash.slice(0, 8)}...{swap.txHash.slice(-8)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyTxHash(swap.txHash!)}
                        className="h-6 w-6 p-0"
                      >
                        {copiedTxId === swap.txHash ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-6 w-6 p-0"
                      >
                        <a
                          href={`https://etherscan.io/tx/${swap.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  )}

                  <Separator className="mb-4" />

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Swap ID: {swap.id.slice(0, 8)}...{swap.id.slice(-8)}
                    </div>
                    
                    {swap.status === 'ready' && (
                      <Button
                        onClick={() => executeClaim(swap.id)}
                        disabled={isClaiming}
                        className="flex items-center space-x-2"
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Claiming...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            <span>Claim Gaslessly</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Gasless Claims Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <div>
              <div className="font-medium">Create Swap Request</div>
              <div className="text-sm text-gray-500">
                Submit your swap request to the Fusion pool
              </div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
            </div>
            <div>
              <div className="font-medium">Pool Processing</div>
              <div className="text-sm text-gray-500">
                Our liquidity pool processes your swap automatically
              </div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <div>
              <div className="font-medium">Gasless Claim</div>
              <div className="text-sm text-gray-500">
                Claim your tokens without paying any gas fees - we cover the costs!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GaslessClaims;