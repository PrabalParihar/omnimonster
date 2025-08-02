"use client";

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { useWeb3Auth } from '../lib/web3auth-context';
import { Loader2, Chrome, Twitter, Github, Mail, Wallet, HardHat } from 'lucide-react';
import { toast } from './ui/use-toast';

interface LoginProvider {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  category: 'social' | 'email' | 'wallet';
}

const loginProviders: LoginProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: Chrome,
    description: 'Continue with Google account',
    category: 'social'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Twitter,
    description: 'Continue with Twitter account',
    category: 'social'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    description: 'Continue with GitHub account',
    category: 'social'
  },
  {
    id: 'email_passwordless',
    name: 'Email',
    icon: Mail,
    description: 'Sign in with email (passwordless)',
    category: 'email'
  },
];

const walletProviders = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: Wallet,
    description: 'Connect with MetaMask'
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: Wallet,
    description: 'Connect with WalletConnect'
  },
  {
    id: 'torus',
    name: 'Hardware Wallet',
    icon: HardHat,
    description: 'Connect hardware wallet'
  }
];

interface Web3AuthLoginProps {
  onClose?: () => void;
  showAdvanced?: boolean;
}

export function Web3AuthLogin({ onClose, showAdvanced = false }: Web3AuthLoginProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showWalletOptions, setShowWalletOptions] = useState(showAdvanced);
  const { isConnected, user, login, logout, isLoading } = useWeb3Auth();
  
  // Use the custom context directly
  const actualIsConnected = isConnected;

  const handleLogin = async (loginProvider: string) => {
    try {
      setSelectedProvider(loginProvider);
      await login(loginProvider);
      
      // Force a small delay to allow state to propagate
      setTimeout(() => {
        console.log('Login completed, checking user state...');
        console.log('Current user after login:', user);
        console.log('Hook isConnected status:', isConnected);
        console.log('Actual isConnected status:', actualIsConnected);
      }, 1000);

      toast({
        title: "Successfully Connected!",
        description: "Your wallet is now connected to Fusion Swap.",
      });
      
      onClose?.();
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setSelectedProvider(null);
    }
  };

  const handleWalletConnect = async () => {
    try {
      setSelectedProvider('wallet');
      await login(); // This will open the modal with all wallet options
      
      toast({
        title: "Wallet Connected!",
        description: "Your wallet is now connected to Fusion Swap.",
      });
      
      onClose?.();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setSelectedProvider(null);
    }
  };

  // If already connected, show logout button or user info
  if (actualIsConnected && user) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome, {user.name || user.email || 'User'}</CardTitle>
            <CardDescription>
              You are successfully connected to Fusion Swap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => logout()} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Logout
            </Button>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                User Info
              </div>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Email: {user.email}</li>
                <li>• Name: {user.name}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Fusion Swap</CardTitle>
          <CardDescription>
            Connect your wallet to start swapping tokens with gasless claims
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          
          {/* Social Login Options */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Social Login (Recommended for beginners)
            </div>
            
            {loginProviders.map((provider) => {
              const Icon = provider.icon;
              const isSelected = selectedProvider === provider.id;
              
              return (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-4"
                  onClick={() => handleLogin(provider.id)}
                  disabled={isLoading}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {isSelected && isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {provider.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          <Separator />

          {/* Wallet Connection Toggle */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowWalletOptions(!showWalletOptions)}
            >
              {showWalletOptions ? 'Hide' : 'Show'} Wallet Options
            </Button>

            {showWalletOptions && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Connect Existing Wallet
                </div>
                
                {walletProviders.map((wallet) => {
                  const Icon = wallet.icon;
                  const isSelected = selectedProvider === wallet.id;
                  
                  return (
                    <Button
                      key={wallet.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto p-4"
                      onClick={handleWalletConnect}
                      disabled={isLoading}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {isSelected && isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{wallet.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {wallet.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Why choose Fusion Swap?
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Gasless token claiming</li>
              <li>• Secure atomic swaps</li>
              <li>• No seed phrases required (social login)</li>
              <li>• Multi-chain support</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

