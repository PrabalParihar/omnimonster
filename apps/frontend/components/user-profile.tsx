"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useWeb3Auth } from '../lib/web3auth-context';
import { 
  User, 
  LogOut, 
  Copy, 
  ExternalLink, 
  Settings, 
  Wallet, 
  RefreshCw,
  ChevronDown,
  Check
} from 'lucide-react';
import { toast } from './ui/use-toast';


interface UserProfileProps {
  compact?: boolean;
  showChainSelector?: boolean;
}

export function UserProfile({ compact = false, showChainSelector = true }: UserProfileProps) {
  const { isConnected, user, logout, isLoading } = useWeb3Auth();
  
  // Use the custom context directly
  const actualIsConnected = isConnected;
  const walletAddress = user?.email || '';
  const currentChain = 'ethereum'; // Default for now

  const [balance, setBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load balance on wallet/chain change
  useEffect(() => {
    if (isConnected && walletAddress) {
      loadBalance();
    }
  }, [isConnected, walletAddress, currentChain]);

  const loadBalance = async () => {
    if (!walletAddress) return;
    
    setIsLoadingBalance(true);
    try {
      // TODO: Implement balance loading with proper Web3 provider
      setBalance('0.0 ETH');
    } catch (error) {
      console.error('Error loading balance:', error);
      setBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Disconnected",
        description: "Your wallet has been disconnected",
      });
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  const handleSwitchChain = async (chainKey: string) => {
    try {
      // TODO: Implement chain switching with proper Web3 provider
      toast({
        title: "Chain Switch",
        description: `Chain switching not yet implemented`,
      });
    } catch (error) {
      toast({
        title: "Chain Switch Failed",
        description: error instanceof Error ? error.message : "Failed to switch chain",
        variant: "destructive",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'twitter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'github':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'metamask':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!actualIsConnected) {
    return null;
  }

  // TODO: Implement proper chain support
  const supportedChains = [{ key: 'ethereum', displayName: 'Ethereum', nativeCurrency: { symbol: 'ETH' } }];
  const chainConfig = { displayName: 'Ethereum', nativeCurrency: { symbol: 'ETH' } };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user?.profileImage} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">
              {formatAddress(walletAddress || '')}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-80">
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.profileImage} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {user?.name || 'Anonymous User'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email}
                </div>
              </div>
            </div>
            
            <Separator className="my-3" />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Wallet</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-mono">
                    {formatAddress(walletAddress || '')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAddress}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-mono">
                    {isLoadingBalance ? '...' : `${parseFloat(balance).toFixed(4)} ${chainConfig.ticker}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadBalance}
                    className="h-6 w-6 p-0"
                    disabled={isLoadingBalance}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Provider</span>
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                  Web3Auth
                </Badge>
              </div>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userInfo?.profileImage} />
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <span>Wallet Connected</span>
        </CardTitle>
        <CardDescription>
          {user?.name || 'Anonymous User'} • {user?.email}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Wallet Address */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center space-x-2">
            <Wallet className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-mono">{formatAddress(walletAddress || '')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-8 w-8 p-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0"
            >
              <a 
                href={`${chainConfig.blockExplorer}/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
          <div className="flex items-center space-x-2">
            <span className="font-mono">
              {isLoadingBalance ? '...' : `${parseFloat(balance).toFixed(4)} ${chainConfig.ticker}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadBalance}
              disabled={isLoadingBalance}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Login Provider */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Login Method</span>
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Web3Auth
          </Badge>
        </div>

        {/* Chain Selector */}
        {showChainSelector && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Network</label>
            <Select value={currentChain} onValueChange={handleSwitchChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {supportedChains.map((chain) => {
                  return (
                    <SelectItem key={chain.key} value={chain.key}>
                      <div className="flex items-center space-x-2">
                        <span>{chain.displayName}</span>
                        <Badge variant="outline">{chain.nativeCurrency.symbol}</Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex space-x-2">
          <Button variant="outline" className="flex-1" disabled>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="destructive" onClick={handleLogout} disabled={isLoading}>
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default UserProfile;