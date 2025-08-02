'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { toast } from '@/components/ui/use-toast';

// Network configurations with actual deployed contracts
const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlcAddress: '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D',
    tokens: {
      MONSTER: '0x1111111111111111111111111111111111111111' // Placeholder
    }
  },
  monad: {
    chainId: 10143,
    name: 'Monad Testnet',
    symbol: 'MON',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    htlcAddress: '0x1C2D085DdF3c3FE877f3Bc0709c97F8342FCF868',
    tokens: {
      MONSTER: '0x1C2D085DdF3c3FE877f3Bc0709c97F8342FCF868',
      OMNIMONSTER: '0x242BD3e422a946b5D2EB83C8c9A9B5c6499EEcFa'
    }
  }
} as const;

const SWAP_ROUTES = [
  {
    id: 'monster-to-omni',
    from: { network: 'sepolia', token: 'MONSTER', symbol: 'MONSTER' },
    to: { network: 'monad', token: 'OMNIMONSTER', symbol: 'OMNIMONSTER' },
    rate: 0.95,
    description: 'Sepolia MONSTER → Monad OMNIMONSTER'
  },
  {
    id: 'omni-to-monster',
    from: { network: 'monad', token: 'OMNIMONSTER', symbol: 'OMNIMONSTER' },
    to: { network: 'sepolia', token: 'MONSTER', symbol: 'MONSTER' },
    rate: 0.95,
    description: 'Monad OMNIMONSTER → Sepolia MONSTER'
  }
] as const;

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

interface SwapState {
  selectedRoute: string;
  amount: string;
  isLoading: boolean;
  step: 'input' | 'approve' | 'lock' | 'waiting' | 'claim' | 'complete';
  transactionHash?: string;
  swapId?: string;
}

export function CrossChainSwap() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [swapState, setSwapState] = useState<SwapState>({
    selectedRoute: '',
    amount: '',
    isLoading: false,
    step: 'input'
  });

  const [balances, setBalances] = useState<Record<string, string>>({});

  const selectedSwapRoute = SWAP_ROUTES.find(route => route.id === swapState.selectedRoute);
  const expectedAmount = selectedSwapRoute && swapState.amount 
    ? (parseFloat(swapState.amount) * selectedSwapRoute.rate).toString()
    : '0';

  // Load token balances
  useEffect(() => {
    if (!address || !isConnected) return;

    const loadBalances = async () => {
      try {
        // Load Monad balances (we have real tokens there)
        const monadProvider = new ethers.JsonRpcProvider(NETWORKS.monad.rpcUrl);
        
        const monsterContract = new ethers.Contract(
          NETWORKS.monad.tokens.MONSTER,
          ERC20_ABI,
          monadProvider
        );
        
        const omniContract = new ethers.Contract(
          NETWORKS.monad.tokens.OMNIMONSTER,
          ERC20_ABI,
          monadProvider
        );

        const [monsterBalance, omniBalance] = await Promise.all([
          monsterContract.balanceOf(address),
          omniContract.balanceOf(address)
        ]);

        setBalances({
          'monad-MONSTER': ethers.formatEther(monsterBalance),
          'monad-OMNIMONSTER': ethers.formatEther(omniBalance),
          'sepolia-MONSTER': '0' // Placeholder
        });

      } catch (error) {
        console.error('Failed to load balances:', error);
      }
    };

    loadBalances();
  }, [address, isConnected]);

  const handleSwap = async () => {
    if (!selectedSwapRoute || !address || !swapState.amount) {
      toast({
        title: 'Invalid Input',
        description: 'Please select a route and enter an amount',
        variant: 'destructive'
      });
      return;
    }

    setSwapState(prev => ({ ...prev, isLoading: true, step: 'approve' }));

    try {
      // Step 1: Check if we're on the correct source chain
      const sourceNetwork = NETWORKS[selectedSwapRoute.from.network as keyof typeof NETWORKS];
      
      if (chainId !== sourceNetwork.chainId) {
        toast({
          title: 'Switch Network',
          description: `Please switch to ${sourceNetwork.name}`,
        });
        
        await switchChain({ chainId: sourceNetwork.chainId });
        return;
      }

      // Step 2: Create swap request in our backend
      setSwapState(prev => ({ ...prev, step: 'lock' }));
      
      const swapRequest = {
        userAddress: address,
        sourceToken: selectedSwapRoute.from.token === 'MONSTER' 
          ? NETWORKS[selectedSwapRoute.from.network as keyof typeof NETWORKS].tokens.MONSTER
          : NETWORKS[selectedSwapRoute.from.network as keyof typeof NETWORKS].tokens.OMNIMONSTER,
        sourceAmount: ethers.parseEther(swapState.amount).toString(),
        targetToken: selectedSwapRoute.to.token === 'MONSTER'
          ? NETWORKS[selectedSwapRoute.to.network as keyof typeof NETWORKS].tokens.MONSTER  
          : NETWORKS[selectedSwapRoute.to.network as keyof typeof NETWORKS].tokens.OMNIMONSTER,
        expectedAmount: ethers.parseEther(expectedAmount).toString(),
        slippageTolerance: 0.05,
        expirationTime: Math.floor(Date.now() / 1000) + 7200, // 2 hours for cross-chain
        sourceChainId: sourceNetwork.chainId,
        targetChainId: NETWORKS[selectedSwapRoute.to.network as keyof typeof NETWORKS].chainId
      };

      // Call our backend API to initiate the swap
      const response = await fetch('/api/fusion/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest)
      });

      if (!response.ok) {
        throw new Error('Failed to create swap request');
      }

      const swapResult = await response.json();
      
      setSwapState(prev => ({ 
        ...prev, 
        step: 'waiting',
        swapId: swapResult.id,
        transactionHash: swapResult.userTxHash
      }));

      toast({
        title: 'Swap Initiated!',
        description: 'Your cross-chain swap has been created. The resolver will process it shortly.',
      });

      // Step 3: Poll for swap completion
      pollSwapStatus(swapResult.id);

    } catch (error) {
      console.error('Swap failed:', error);
      toast({
        title: 'Swap Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
      
      setSwapState(prev => ({ ...prev, isLoading: false, step: 'input' }));
    }
  };

  const pollSwapStatus = async (swapId: string) => {
    const maxPolls = 30; // 5 minutes
    let polls = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/fusion/swaps/${swapId}`);
        const swap = await response.json();

        if (swap.status === 'POOL_FULFILLED') {
          setSwapState(prev => ({ ...prev, step: 'claim' }));
          toast({
            title: 'Ready to Claim!',
            description: 'Your tokens are ready to claim on the destination chain.',
          });
        } else if (swap.status === 'USER_CLAIMED') {
          setSwapState(prev => ({ ...prev, step: 'complete', isLoading: false }));
          toast({
            title: 'Swap Complete!',
            description: 'Your cross-chain swap has been completed successfully.',
          });
          return;
        }

        polls++;
        if (polls < maxPolls) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          throw new Error('Swap timeout - please check manually');
        }
      } catch (error) {
        console.error('Polling failed:', error);
        toast({
          title: 'Status Check Failed',
          description: 'Unable to check swap status. Please refresh and check manually.',
          variant: 'destructive'
        });
      }
    };

    poll();
  };

  const getStepStatus = (step: string) => {
    const currentStepIndex = ['input', 'approve', 'lock', 'waiting', 'claim', 'complete'].indexOf(swapState.step);
    const stepIndex = ['input', 'approve', 'lock', 'waiting', 'claim', 'complete'].indexOf(step);
    
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🌉 Cross-Chain Swap
            <Badge variant="outline">Sepolia ↔ Monad</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Swap Route Selection */}
          <div className="space-y-2">
            <Label>Swap Route</Label>
            <Select 
              value={swapState.selectedRoute} 
              onValueChange={(value) => setSwapState(prev => ({ ...prev, selectedRoute: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a swap route" />
              </SelectTrigger>
              <SelectContent>
                {SWAP_ROUTES.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{route.description}</span>
                      <Badge variant="secondary" className="ml-2">
                        {(route.rate * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSwapRoute && (
            <>
              {/* Amount Input */}
              <div className="space-y-2">
                <Label>Amount to Swap</Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={swapState.amount}
                    onChange={(e) => setSwapState(prev => ({ ...prev, amount: e.target.value }))}
                    className="pr-20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {selectedSwapRoute.from.symbol}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Balance: {balances[`${selectedSwapRoute.from.network}-${selectedSwapRoute.from.token}`] || '0'} {selectedSwapRoute.from.symbol}
                </div>
              </div>

              {/* Swap Preview */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>You pay:</span>
                  <span className="font-medium">{swapState.amount || '0'} {selectedSwapRoute.from.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>You receive:</span>
                  <span className="font-medium">{expectedAmount} {selectedSwapRoute.to.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate:</span>
                  <span className="text-sm text-muted-foreground">
                    1 {selectedSwapRoute.from.symbol} = {selectedSwapRoute.rate} {selectedSwapRoute.to.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Route:</span>
                  <span className="text-sm text-muted-foreground">
                    {NETWORKS[selectedSwapRoute.from.network as keyof typeof NETWORKS].name} → {NETWORKS[selectedSwapRoute.to.network as keyof typeof NETWORKS].name}
                  </span>
                </div>
              </div>

              {/* Swap Progress */}
              {swapState.step !== 'input' && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">Swap Progress</h4>
                    <div className="space-y-2">
                      {[
                        { step: 'approve', label: 'Approve tokens' },
                        { step: 'lock', label: 'Lock tokens in HTLC' },
                        { step: 'waiting', label: 'Resolver processing' },
                        { step: 'claim', label: 'Ready to claim' },
                        { step: 'complete', label: 'Swap complete' }
                      ].map(({ step, label }) => (
                        <div key={step} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            getStepStatus(step) === 'completed' ? 'bg-green-500' :
                            getStepStatus(step) === 'current' ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <span className={`text-sm ${
                            getStepStatus(step) === 'current' ? 'font-medium' : ''
                          }`}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button 
                onClick={handleSwap}
                disabled={!isConnected || !swapState.amount || swapState.isLoading || swapState.step !== 'input'}
                className="w-full"
                size="lg"
              >
                {!isConnected ? 'Connect Wallet' :
                 swapState.isLoading ? 'Processing...' :
                 swapState.step !== 'input' ? 'Swap in Progress' :
                 'Start Cross-Chain Swap'}
              </Button>

              {/* Transaction Links */}
              {swapState.transactionHash && (
                <div className="text-center">
                  <a 
                    href={`${NETWORKS[selectedSwapRoute.from.network as keyof typeof NETWORKS].blockExplorer || '#'}/tx/${swapState.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    View transaction →
                  </a>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cross-Chain Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Atomic Swaps</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Gasless Claims</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Pool Liquidity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Auto Resolution</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}