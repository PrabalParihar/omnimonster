'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SimpleWalletConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');

  const connectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        // Try to connect with MetaMask
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      } else {
        // Fallback: simulate connection for testing
        const mockAddress = '0x742d35Cc6634C0532925a3b8D098d3b9B8a10d6b';
        setAddress(mockAddress);
        setIsConnected(true);
        alert('MetaMask not detected. Using test wallet for demo purposes.');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      // Fallback: simulate connection for testing
      const mockAddress = '0x742d35Cc6634C0532925a3b8D098d3b9B8a10d6b';
      setAddress(mockAddress);
      setIsConnected(true);
      alert('Using test wallet for demo purposes.');
    }
  };

  const disconnectWallet = () => {
    setAddress('');
    setIsConnected(false);
  };

  if (isConnected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Connected
            </Badge>
            Wallet Connected
          </CardTitle>
          <CardDescription>
            Your wallet is successfully connected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Address:</p>
            <p className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
              {address}
            </p>
          </div>
          <Button 
            onClick={disconnectWallet}
            variant="outline"
            className="w-full"
          >
            Disconnect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connect Your Wallet</CardTitle>
        <CardDescription>
          Connect your wallet to start using Fusion Swap
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button 
            onClick={connectWallet}
            className="w-full"
          >
            🦊 Connect with MetaMask
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Web3Auth integration in progress. Using MetaMask for now.
          </p>
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-gray-400 text-center">
            Note: If MetaMask is not available, a test wallet will be used for demo purposes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}