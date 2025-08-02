"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  ArrowUpDown, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  RefreshCw,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import { toast } from './ui/use-toast';
import { formatEther, parseEther } from 'ethers';

// Supported chains configuration - matches CLI setup
const SUPPORTED_CHAINS = {
  11155111: { name: 'Sepolia Testnet', symbol: 'ETH', rpcUrl: process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL },
  80002: { name: 'Polygon Amoy', symbol: 'MATIC', rpcUrl: process.env.POLYGON_AMOY_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL },
  41454: { name: 'Monad Testnet', symbol: 'MON', rpcUrl: process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC_URL },
};

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  minSwapAmount: string;
  maxSwapAmount: string;
  feePercentage: number;
  isActive: boolean;
  poolBalance?: {
    totalBalance: string;
    availableBalance: string;
    reservedBalance: string;
    utilizationRate: number;
    healthStatus: 'HEALTHY' | 'LOW' | 'UNKNOWN';
  };
}

interface SwapQuote {
  sourceToken: string;
  targetToken: string;
  sourceAmount: string;
  targetAmount: string;
  minReceiveAmount: string;
  exchangeRate: number;
  priceImpact: number;
  poolLiquidity: string;
  estimatedGasSavings: string;
  fee: {
    percentage: number;
    amount: string;
  };
  expirationTime: number;
  valid: boolean;
  timestamp: number;
}

interface PoolLiquidity {
  token: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  utilizationRate: number;
}

export function FusionSwapForm() {
  const { isConnected, user, login } = useWeb3Auth();
  
  // Use the custom context directly
  const actualIsConnected = isConnected;
  
  // Form state - Cross-chain swap flow
  const [sourceChainId, setSourceChainId] = useState<number>(11155111); // Source network
  const [destinationChainId, setDestinationChainId] = useState<number>(80002); // Destination network
  const [sourceTokens, setSourceTokens] = useState<Token[]>([]);
  const [destinationTokens, setDestinationTokens] = useState<Token[]>([]);
  const [sourceToken, setSourceToken] = useState<Token | null>(null);
  const [destinationToken, setDestinationToken] = useState<Token | null>(null);
  const [sourceAmount, setSourceAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState(0.5); // 0.5%
  const [customSlippage, setCustomSlippage] = useState('');
  const [useCustomSlippage, setUseCustomSlippage] = useState(false);
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [swapStep, setSwapStep] = useState<'input' | 'review' | 'executing' | 'completed'>('input');
  const [swapResult, setSwapResult] = useState<any>(null);

  // Load supported tokens for source and destination chains
  const loadSourceTokens = useCallback(async () => {
    try {
      const response = await fetch(`/api/fusion/tokens?chainId=${sourceChainId}&includeBalance=true`);
      if (response.ok) {
        const data = await response.json();
        const activeTokens = data.tokens.filter((token: Token) => token.isActive);
        setSourceTokens(activeTokens);
      } else {
        console.error('Failed to load source tokens');
        toast({
          title: "Loading Error",
          description: "Failed to load source tokens",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading source tokens:', error);
    }
  }, [sourceChainId]);

  const loadDestinationTokens = useCallback(async () => {
    try {
      const response = await fetch(`/api/fusion/tokens?chainId=${destinationChainId}&includeBalance=true`);
      if (response.ok) {
        const data = await response.json();
        const activeTokens = data.tokens.filter((token: Token) => token.isActive);
        setDestinationTokens(activeTokens);
      } else {
        console.error('Failed to load destination tokens');
        toast({
          title: "Loading Error",
          description: "Failed to load destination tokens",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading destination tokens:', error);
    }
  }, [destinationChainId]);

  // Get quote from pool
  const getQuote = useCallback(async () => {
    if (!sourceToken || !destinationToken || !sourceAmount || parseFloat(sourceAmount) <= 0) {
      setQuote(null);
      return;
    }

    setIsQuoting(true);
    try {
      const effectiveSlippageTolerance = (useCustomSlippage ? parseFloat(customSlippage) : slippageTolerance) / 100; // Convert percentage to decimal
      const response = await fetch('/api/fusion/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceChainId,
          sourceToken: sourceToken.address,
          destinationChainId,
          targetToken: destinationToken.address,
          sourceAmount: parseEther(sourceAmount).toString(),
          slippageTolerance: effectiveSlippageTolerance,
        }),
      });

      if (response.ok) {
        const quoteData = await response.json();
        setQuote(quoteData);
      } else {
        const error = await response.json();
        toast({
          title: "Quote Error",
          description: error.error || "Failed to get quote",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      toast({
        title: "Quote Error",
        description: "Failed to get quote from pool",
        variant: "destructive",
      });
    } finally {
      setIsQuoting(false);
    }
  }, [sourceToken, destinationToken, sourceAmount, slippageTolerance, customSlippage, useCustomSlippage]);

  // Execute swap
  const executeSwap = async () => {
    if (!actualIsConnected || !quote || !sourceToken || !destinationToken || !destinationAddress || !user?.verifierId) {
      return;
    }

    setIsLoading(true);
    setSwapStep('executing');

    try {
      const effectiveSlippageTolerance = (useCustomSlippage ? parseFloat(customSlippage) : slippageTolerance) / 100;
      
      // Create cross-chain swap request
      const response = await fetch('/api/fusion/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: user.verifierId, // Use the verifierId as user address
          sourceChainId,
          sourceToken: sourceToken.address,
          sourceAmount: quote.sourceAmount,
          destinationChainId,
          targetToken: destinationToken.address,
          destinationAddress,
          expectedAmount: quote.targetAmount,
          slippageTolerance: effectiveSlippageTolerance,
          expirationTime: quote.expirationTime,
        }),
      });

      if (response.ok) {
        const swapData = await response.json();
        setSwapResult(swapData);
        setSwapStep('completed');
        
        toast({
          title: "Swap Created Successfully!",
          description: `Swap ID: ${swapData.swap.id}. Your tokens will be available for gasless claiming.`,
        });

        // Reset form
        setSourceAmount('');
        setQuote(null);
        
        // Refresh tokens to update pool balances
        loadSourceTokens();
        loadDestinationTokens();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create swap');
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to execute swap",
        variant: "destructive",
      });
      setSwapStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  // Load supported tokens when chains change or component mounts
  useEffect(() => {
    loadSourceTokens();
  }, [loadSourceTokens]);

  useEffect(() => {
    loadDestinationTokens();
  }, [loadDestinationTokens]);

  // Reset token selection when chains change
  useEffect(() => {
    setSourceToken(null);
    setSourceAmount('');
    setQuote(null);
  }, [sourceChainId]);

  useEffect(() => {
    setDestinationToken(null);
    setQuote(null);
  }, [destinationChainId]);

  // Auto-quote when inputs change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getQuote();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [getQuote]);

  // Handle network/token swap
  const handleNetworkTokenSwap = () => {
    // Swap source and destination chains
    const tempChainId = sourceChainId;
    setSourceChainId(destinationChainId);
    setDestinationChainId(tempChainId);
    
    // Swap tokens
    const tempToken = sourceToken;
    setSourceToken(destinationToken);
    setDestinationToken(tempToken);
    
    // Reset form
    setSourceAmount('');
    setQuote(null);
  };

  // Handle slippage change
  const handleSlippageChange = (value: string) => {
    if (value === 'custom') {
      setUseCustomSlippage(true);
    } else {
      setUseCustomSlippage(false);
      setSlippageTolerance(parseFloat(value));
    }
  };

  // Get pool liquidity for token from the token's poolBalance
  const getTokenLiquidity = (token: Token) => {
    return token.poolBalance;
  };

  // Login prompt for non-connected users
  if (!actualIsConnected) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
          <CardDescription>
            Connect your wallet to start using Fusion Swap
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
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Fusion Swap</span>
          </CardTitle>
          <CardDescription>
            Create swap requests against our pool - claim gaslessly when fulfilled
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Source Network & Token */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <Label className="text-sm font-medium">Source Network & Token</Label>
            </div>
            
            {/* Source Network Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">From Network</Label>
              <Select
                value={sourceChainId.toString()}
                onValueChange={(value) => setSourceChainId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Source Network" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORTED_CHAINS).map(([chainId, chain]) => (
                    <SelectItem key={chainId} value={chainId}>
                      <div className="flex items-center space-x-2">
                        <span>{chain.name}</span>
                        <Badge variant="outline">{chain.symbol}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Token & Amount */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">From Token & Amount</Label>
              <div className="flex space-x-2">
                <Select
                  value={sourceToken?.address || ''}
                  onValueChange={(value) => {
                    const token = sourceTokens.find(t => t.address === value);
                    setSourceToken(token || null);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Token" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTokens.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{token.symbol}</span>
                          <Badge 
                            variant={token.poolBalance?.healthStatus === 'HEALTHY' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {token.poolBalance?.healthStatus || 'NO POOL'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={sourceAmount}
                    onChange={(e) => setSourceAmount(e.target.value)}
                    className="pr-16"
                  />
                  {sourceToken && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                      onClick={() => {
                        if (sourceToken.poolBalance?.availableBalance) {
                          setSourceAmount(formatEther(sourceToken.poolBalance.availableBalance));
                        }
                      }}
                    >
                      MAX
                    </Button>
                  )}
                </div>
              </div>
              {sourceToken && (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>{sourceToken.name}</div>
                  {sourceToken.poolBalance && (
                    <div className="flex justify-between">
                      <span>Available: {formatEther(sourceToken.poolBalance.availableBalance)} {sourceToken.symbol}</span>
                      <span>Utilization: {sourceToken.poolBalance.utilizationRate.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Arrow Divider */}
          <div className="flex justify-center py-2">
            <ArrowUpDown className="h-6 w-6 text-gray-400" />
          </div>

          {/* Destination Network & Token */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <Label className="text-sm font-medium">Destination Network & Token</Label>
            </div>
            
            {/* Destination Network Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">To Network</Label>
              <Select
                value={destinationChainId.toString()}
                onValueChange={(value) => setDestinationChainId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Destination Network" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORTED_CHAINS).map(([chainId, chain]) => (
                    <SelectItem key={chainId} value={chainId}>
                      <div className="flex items-center space-x-2">
                        <span>{chain.name}</span>
                        <Badge variant="outline">{chain.symbol}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destination Token */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">To Token</Label>
              <div className="flex space-x-2">
                <Select
                  value={destinationToken?.address || ''}
                  onValueChange={(value) => {
                    const token = destinationTokens.find(t => t.address === value);
                    setDestinationToken(token || null);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Token" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationTokens.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{token.symbol}</span>
                          <Badge 
                            variant={token.poolBalance?.healthStatus === 'HEALTHY' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {token.poolBalance?.healthStatus || 'NO POOL'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={quote ? formatEther(quote.targetAmount) : ''}
                  readOnly
                  className="flex-1 bg-gray-50 dark:bg-gray-900"
                />
              </div>
              {destinationToken && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {destinationToken.name}
                </div>
              )}
            </div>

            {/* Destination Address */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Destination Address</Label>
              <Input
                type="text"
                placeholder="Enter recipient address (0x...)"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Address on {SUPPORTED_CHAINS[destinationChainId]?.name} where tokens will be sent
              </div>
            </div>
          </div>

          {/* Slippage Tolerance */}
          <div className="space-y-2">
            <Label>Slippage Tolerance</Label>
            <div className="flex space-x-2">
              <Select
                value={useCustomSlippage ? 'custom' : slippageTolerance.toString()}
                onValueChange={handleSlippageChange}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">0.1%</SelectItem>
                  <SelectItem value="0.5">0.5%</SelectItem>
                  <SelectItem value="1.0">1.0%</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {useCustomSlippage && (
                <Input
                  type="number"
                  placeholder="0.5"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  className="w-20"
                  step="0.1"
                  min="0.1"
                  max="50"
                />
              )}
            </div>
          </div>

          {/* Quote Information */}
          {isQuoting && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Getting quote...</span>
            </div>
          )}

          {quote && !isQuoting && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Exchange Rate</span>
                <span className="text-sm font-medium">
                  1 {sourceToken?.symbol} = {quote.exchangeRate.toFixed(6)} {destinationToken?.symbol}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Price Impact</span>
                <Badge variant={quote.priceImpact > 3 ? "destructive" : "secondary"}>
                  {quote.priceImpact.toFixed(2)}%
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Fee</span>
                <span className="text-sm font-medium">
                  {quote.fee.percentage.toFixed(2)}% ({quote.fee.amount} {sourceToken?.symbol})
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pool Liquidity</span>
                <span className="text-sm font-medium">
                  {formatEther(quote.poolLiquidity)} {destinationToken?.symbol}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Min Receive</span>
                <span className="text-sm font-medium">
                  {formatEther(quote.minReceiveAmount)} {destinationToken?.symbol}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                  <Zap className="h-3 w-3 mr-1" />
                  Gas Savings
                </span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  ~${formatEther(quote.estimatedGasSavings)}
                </span>
              </div>
            </div>
          )}

          {/* Pool Status */}
          {destinationToken && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Pool Status</span>
              </div>
              {(() => {
                const liquidity = getTokenLiquidity(destinationToken);
                if (!liquidity) {
                  return (
                    <div className="text-sm text-gray-500">
                      No pool data available
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Available Liquidity</span>
                      <span className="font-medium">
                        {formatEther(liquidity.availableBalance)} {destinationToken.symbol}
                      </span>
                    </div>
                    <Progress value={100 - liquidity.utilizationRate} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{(100 - liquidity.utilizationRate).toFixed(1)}% available</span>
                      <Badge 
                        variant={liquidity.healthStatus === 'HEALTHY' ? 'default' : liquidity.healthStatus === 'LOW' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {liquidity.healthStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <Separator />

          {/* Fusion Swap Benefits */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Fusion Swap Benefits:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>Gasless claiming</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3 text-green-500" />
                <span>Atomic security</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 text-blue-500" />
                <span>Instant fulfillment</span>
              </div>
              <div className="flex items-center space-x-1">
                <RefreshCw className="h-3 w-3 text-purple-500" />
                <span>Pool liquidity</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={executeSwap}
            disabled={!quote || isLoading || !sourceToken || !destinationToken || !sourceAmount || !destinationAddress}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Cross-Chain Swap...
              </>
            ) : (
              'Create Cross-Chain Swap Request'
            )}
          </Button>

          {/* Swap Result */}
          {swapResult && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Swap created successfully!</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Swap ID: {swapResult.swap.id}</div>
                <div>Hash Lock: {swapResult.swap.hashLock.slice(0, 10)}...{swapResult.swap.hashLock.slice(-10)}</div>
                <div>Status: {swapResult.swap.status}</div>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-2 rounded">
                <div className="font-medium mb-1">✅ Cross-Chain Swap Request Created!</div>
                <div>• Pool will automatically fulfill your request</div>
                <div>• Tokens will be sent to {destinationAddress}</div>
                <div>• You'll receive {destinationToken?.symbol} on {SUPPORTED_CHAINS[destinationChainId]?.name}</div>
                <div>• Visit the Claims page to monitor progress</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FusionSwapForm;