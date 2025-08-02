"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from './ui/use-toast';
import { useWeb3Auth } from '../lib/web3auth-context';
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { ethers } from 'ethers';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  balance?: string;
}

interface PoolLiquidity {
  address: string;
  symbol: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
}

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  exchangeRate: string;
  priceImpact: string;
  fees: string;
  slippageAdjustedOutput: string;
}

export const FusionSwapInterface: React.FC = () => {
  const { isConnected, accounts, chainId, login } = useWeb3Auth();
  const { toast } = useToast();

  // UI State
  const [sourceToken, setSourceToken] = useState<Token | null>(null);
  const [targetToken, setTargetToken] = useState<Token | null>(null);
  const [sourceAmount, setSourceAmount] = useState('');
  const [slippage, setSlippage] = useState([0.5]); // 0.5%
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Data State
  const [supportedTokens, setSupportedTokens] = useState<Token[]>([]);
  const [poolLiquidity, setPoolLiquidity] = useState<PoolLiquidity[]>([]);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [userBalances, setUserBalances] = useState<Record<string, string>>({});

  // Fetch supported tokens and pool liquidity
  const fetchTokensAndLiquidity = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch supported tokens
      const tokensResponse = await fetch('/api/fusion/tokens');
      const tokensData = await tokensResponse.json();
      setSupportedTokens(tokensData.tokens || []);
      
      // Fetch pool liquidity
      const liquidityResponse = await fetch('/api/fusion/pool/status');
      const liquidityData = await liquidityResponse.json();
      setPoolLiquidity(liquidityData.tokens || []);
      
    } catch (error) {
      console.error('Error fetching tokens and liquidity:', error);
      toast({
        title: "Error",
        description: "Failed to fetch token information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch user token balances
  const fetchUserBalances = useCallback(async () => {
    if (!isConnected || !accounts[0]) return;

    try {
      const balances: Record<string, string> = {};
      
      for (const token of supportedTokens) {
        try {
          const response = await fetch(`/api/fusion/tokens/balance?address=${accounts[0]}&token=${token.address}`);
          const data = await response.json();
          balances[token.address] = data.balance || '0';
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          balances[token.address] = '0';
        }
      }
      
      setUserBalances(balances);
    } catch (error) {
      console.error('Error fetching user balances:', error);
    }
  }, [isConnected, accounts, supportedTokens]);

  // Get swap quote
  const getSwapQuote = useCallback(async () => {
    if (!sourceToken || !targetToken || !sourceAmount || parseFloat(sourceAmount) <= 0) {
      setSwapQuote(null);
      return;
    }

    try {
      const response = await fetch('/api/fusion/swaps/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceToken: sourceToken.address,
          targetToken: targetToken.address,
          amount: ethers.parseUnits(sourceAmount, sourceToken.decimals).toString(),
          slippage: slippage[0] / 100, // Convert percentage to decimal
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSwapQuote(data.quote);
      } else {
        setSwapQuote(null);
        toast({
          title: "Quote Error",
          description: data.error || "Unable to get swap quote",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error getting swap quote:', error);
      setSwapQuote(null);
    }
  }, [sourceToken, targetToken, sourceAmount, slippage, toast]);

  // Execute swap
  const executeSwap = async () => {
    if (!isConnected) {
      await login();
      return;
    }

    if (!sourceToken || !targetToken || !sourceAmount || !swapQuote) {
      toast({
        title: "Invalid Swap",
        description: "Please select tokens and enter an amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSwapping(true);

      const response = await fetch('/api/fusion/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: accounts[0],
          sourceToken: sourceToken.address,
          sourceAmount: ethers.parseUnits(sourceAmount, sourceToken.decimals).toString(),
          targetToken: targetToken.address,
          expectedAmount: swapQuote.slippageAdjustedOutput,
          slippageTolerance: slippage[0] / 100,
          chainId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Swap Initiated",
          description: `Swap request created with ID: ${data.swapId}`,
        });
        
        // Reset form
        setSourceAmount('');
        setSwapQuote(null);
        
        // Refresh balances
        fetchUserBalances();
      } else {
        toast({
          title: "Swap Failed",
          description: data.error || "Failed to create swap",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      toast({
        title: "Swap Error",
        description: "An error occurred while processing your swap",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  // Swap token positions
  const swapTokens = () => {
    const temp = sourceToken;
    setSourceToken(targetToken);
    setTargetToken(temp);
    setSourceAmount('');
    setSwapQuote(null);
  };

  // Set max amount
  const setMaxAmount = () => {
    if (sourceToken && userBalances[sourceToken.address]) {
      const balance = ethers.formatUnits(userBalances[sourceToken.address], sourceToken.decimals);
      setSourceAmount(balance);
    }
  };

  // Check if pool has sufficient liquidity
  const getPoolLiquidity = (tokenAddress: string) => {
    return poolLiquidity.find(p => p.address.toLowerCase() === tokenAddress.toLowerCase());
  };

  // Format large numbers
  const formatNumber = (num: string, decimals = 6) => {
    const parsed = parseFloat(num);
    if (parsed === 0) return '0';
    if (parsed < 0.000001) return '< 0.000001';
    return parsed.toFixed(decimals);
  };

  // Effects
  useEffect(() => {
    fetchTokensAndLiquidity();
  }, [fetchTokensAndLiquidity]);

  useEffect(() => {
    if (supportedTokens.length > 0) {
      fetchUserBalances();
    }
  }, [fetchUserBalances, supportedTokens]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      getSwapQuote();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [getSwapQuote]);

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          Fusion Swap
        </CardTitle>
        <CardDescription>
          Swap tokens instantly with gasless claiming
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Source Token */}
        <div className="space-y-2">
          <Label>From</Label>
          <div className="flex gap-2">
            <Select
              value={sourceToken?.address || ''}
              onValueChange={(value) => {
                const token = supportedTokens.find(t => t.address === value);
                setSourceToken(token || null);
                setSourceAmount('');
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Token" />
              </SelectTrigger>
              <SelectContent>
                {supportedTokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    <div className="flex items-center gap-2">
                      {token.logoUri && (
                        <img src={token.logoUri} alt={token.symbol} className="w-4 h-4 rounded-full" />
                      )}
                      <span>{token.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex-1 relative">
              <Input
                placeholder="0.0"
                value={sourceAmount}
                onChange={(e) => setSourceAmount(e.target.value)}
                className="pr-12"
              />
              {sourceToken && isConnected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 px-2 text-xs"
                  onClick={setMaxAmount}
                >
                  MAX
                </Button>
              )}
            </div>
          </div>
          
          {sourceToken && isConnected && (
            <div className="text-sm text-muted-foreground">
              Balance: {formatNumber(ethers.formatUnits(userBalances[sourceToken.address] || '0', sourceToken.decimals))} {sourceToken.symbol}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={swapTokens}
            className="h-8 w-8"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Target Token */}
        <div className="space-y-2">
          <Label>To</Label>
          <div className="flex gap-2">
            <Select
              value={targetToken?.address || ''}
              onValueChange={(value) => {
                const token = supportedTokens.find(t => t.address === value);
                setTargetToken(token || null);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Token" />
              </SelectTrigger>
              <SelectContent>
                {supportedTokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    <div className="flex items-center gap-2">
                      {token.logoUri && (
                        <img src={token.logoUri} alt={token.symbol} className="w-4 h-4 rounded-full" />
                      )}
                      <span>{token.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex-1">
              <Input
                placeholder="0.0"
                value={swapQuote ? formatNumber(ethers.formatUnits(swapQuote.slippageAdjustedOutput, targetToken?.decimals || 18)) : ''}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
          
          {targetToken && (
            <div className="text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Pool Liquidity:</span>
                <span>
                  {getPoolLiquidity(targetToken.address) ? 
                    formatNumber(ethers.formatUnits(getPoolLiquidity(targetToken.address)!.availableBalance, targetToken.decimals)) :
                    'N/A'
                  } {targetToken.symbol}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Slippage Tolerance */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Slippage Tolerance</Label>
            <span className="text-sm font-medium">{slippage[0]}%</span>
          </div>
          <Slider
            value={slippage}
            onValueChange={setSlippage}
            max={5}
            min={0.1}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Swap Details */}
        {swapQuote && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Exchange Rate</span>
              <span>1 {sourceToken?.symbol} = {formatNumber(swapQuote.exchangeRate)} {targetToken?.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Price Impact</span>
              <span className={parseFloat(swapQuote.priceImpact) > 3 ? 'text-red-500' : 'text-green-500'}>
                {swapQuote.priceImpact}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Estimated Fees</span>
              <span>{formatNumber(ethers.formatEther(swapQuote.fees))} ETH</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={!sourceToken || !targetToken || !sourceAmount || !swapQuote || isSwapping}
          className="w-full"
          size="lg"
        >
          {isSwapping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Swap...
            </>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : !sourceToken || !targetToken ? (
            'Select Tokens'
          ) : !sourceAmount ? (
            'Enter Amount'
          ) : !swapQuote ? (
            'Getting Quote...'
          ) : (
            'Create Swap'
          )}
        </Button>

        {/* Info */}
        {isConnected && (
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>✨ Your tokens will be ready for gasless claiming once the pool fulfills your swap</p>
            <p>🔒 This is an atomic swap - your funds are secure with HTLC contracts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};