"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from './ui/use-toast';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  Loader2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Zap,
  Gift,
  ArrowRight
} from 'lucide-react';
import { ethers } from 'ethers';

interface SwapRequest {
  id: string;
  sourceToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  targetToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  sourceAmount: string;
  expectedAmount: string;
  slippageTolerance: number;
  userHtlcContract?: string;
  poolHtlcContract?: string;
  hashLock: string;
  status: 'PENDING' | 'POOL_FULFILLED' | 'USER_CLAIMED' | 'EXPIRED' | 'CANCELLED';
  poolClaimedAt?: string;
  userClaimedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClaimableSwap extends SwapRequest {
  canClaim: boolean;
  claimSignature?: string;
  estimatedGas?: string;
}

export const GaslessClaimInterface: React.FC = () => {
  const { isConnected, accounts } = useWeb3Auth();
  const { toast } = useToast();

  const [claimableSwaps, setClaimableSwaps] = useState<ClaimableSwap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [claimingSwaps, setClaimingSwaps] = useState<Set<string>>(new Set());

  // Fetch claimable swaps
  const fetchClaimableSwaps = useCallback(async () => {
    if (!isConnected || !accounts[0]) return;

    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/fusion/swaps/claimable?userAddress=${accounts[0]}`);
      const data = await response.json();
      
      if (data.success) {
        setClaimableSwaps(data.swaps || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch claimable swaps",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching claimable swaps:', error);
      toast({
        title: "Error",
        description: "Failed to fetch claimable swaps",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, accounts, toast]);

  // Execute gasless claim
  const executeClaim = async (swap: ClaimableSwap) => {
    if (!swap.canClaim || !swap.poolHtlcContract) {
      toast({
        title: "Cannot Claim",
        description: "This swap is not ready for claiming yet",
        variant: "destructive",
      });
      return;
    }

    try {
      setClaimingSwaps(prev => new Set(prev).add(swap.id));

      // Generate claim signature
      const response = await fetch('/api/fusion/claims/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swapId: swap.id,
          userAddress: accounts[0],
        }),
      });

      const prepareData = await response.json();

      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare claim');
      }

      // Execute gasless claim
      const claimResponse = await fetch('/api/fusion/claims/gasless', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swapId: swap.id,
          htlcContract: swap.poolHtlcContract,
          contractId: prepareData.contractId,
          preimage: prepareData.preimage,
          beneficiary: accounts[0],
          signature: prepareData.signature,
        }),
      });

      const claimData = await claimResponse.json();

      if (claimData.success) {
        toast({
          title: "Claim Successful! 🎉",
          description: `Successfully claimed ${ethers.formatUnits(swap.expectedAmount, swap.targetToken.decimals)} ${swap.targetToken.symbol}`,
        });

        // Remove from claimable list
        setClaimableSwaps(prev => prev.filter(s => s.id !== swap.id));
      } else {
        toast({
          title: "Claim Failed",
          description: claimData.error || "Failed to execute gasless claim",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error executing claim:', error);
      toast({
        title: "Claim Error",
        description: "An error occurred while claiming your tokens",
        variant: "destructive",
      });
    } finally {
      setClaimingSwaps(prev => {
        const newSet = new Set(prev);
        newSet.delete(swap.id);
        return newSet;
      });
    }
  };

  // Format time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format amount
  const formatAmount = (amount: string, decimals: number) => {
    const formatted = ethers.formatUnits(amount, decimals);
    const parsed = parseFloat(formatted);
    if (parsed < 0.000001) return '< 0.000001';
    return parsed.toFixed(6);
  };

  // Get status badge
  const getStatusBadge = (status: SwapRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'POOL_FULFILLED':
        return <Badge variant="default" className="gap-1 bg-green-500"><Gift className="h-3 w-3" /> Ready to Claim</Badge>;
      case 'USER_CLAIMED':
        return <Badge variant="default" className="gap-1 bg-blue-500"><CheckCircle className="h-3 w-3" /> Claimed</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Expired</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Effects
  useEffect(() => {
    fetchClaimableSwaps();
    
    // Set up polling for updates
    const interval = setInterval(fetchClaimableSwaps, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, [fetchClaimableSwaps]);

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Gasless Claims
          </CardTitle>
          <CardDescription>
            Please connect your wallet to view claimable tokens
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Gasless Claims
          </CardTitle>
          <CardDescription>
            Claim your tokens without paying gas fees. Pool-fulfilled swaps are ready for claiming.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading claimable swaps...</span>
            </div>
          </CardContent>
        </Card>
      ) : claimableSwaps.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Claimable Swaps</h3>
              <p className="text-muted-foreground">
                You don't have any swaps ready for claiming. Create a swap to get started!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claimableSwaps.map((swap) => (
            <Card key={swap.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Swap #{swap.id.slice(-8)}</h3>
                      {getStatusBadge(swap.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {formatTime(swap.createdAt)}
                    </p>
                  </div>
                  
                  {swap.canClaim && (
                    <Button
                      onClick={() => executeClaim(swap)}
                      disabled={claimingSwaps.has(swap.id)}
                      className="gap-2"
                    >
                      {claimingSwaps.has(swap.id) ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Claim Gaslessly
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Swap Details */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="font-semibold">
                          {formatAmount(swap.sourceAmount, swap.sourceToken.decimals)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {swap.sourceToken.symbol}
                        </div>
                      </div>
                      
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      
                      <div className="text-center">
                        <div className="font-semibold">
                          {formatAmount(swap.expectedAmount, swap.targetToken.decimals)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {swap.targetToken.symbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Slippage Tolerance:</span>
                      <div className="font-medium">{(swap.slippageTolerance * 100).toFixed(2)}%</div>
                    </div>
                    
                    {swap.poolClaimedAt && (
                      <div>
                        <span className="text-muted-foreground">Pool Claimed:</span>
                        <div className="font-medium">{formatTime(swap.poolClaimedAt)}</div>
                      </div>
                    )}
                    
                    {swap.userClaimedAt && (
                      <div>
                        <span className="text-muted-foreground">User Claimed:</span>
                        <div className="font-medium">{formatTime(swap.userClaimedAt)}</div>
                      </div>
                    )}
                  </div>

                  {/* Contract Links */}
                  {(swap.userHtlcContract || swap.poolHtlcContract) && (
                    <>
                      <Separator />
                      <div className="flex gap-4 text-xs">
                        {swap.userHtlcContract && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${swap.userHtlcContract}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline"
                          >
                            User HTLC <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {swap.poolHtlcContract && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${swap.poolHtlcContract}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline"
                          >
                            Pool HTLC <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-blue-900">How Gasless Claims Work</h4>
              <p className="text-sm text-blue-700">
                Once the pool fulfills your swap, you can claim your tokens without paying gas fees. 
                Our relayer service covers the transaction costs for you!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};