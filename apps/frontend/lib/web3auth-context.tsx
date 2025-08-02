"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "BPXfjkJJ0qf7cPqIiNiV5-MCwZLm2wxWXfHjE35nsYQ1Clm_89Ge63xvkvzKHc0QVZATf9EaaRcxg9VVmWSopLA";

interface Web3AuthUser {
  email?: string;
  name?: string;
  profileImage?: string;
  verifierId: string;
  typeOfLogin: string;
  dappShare?: string;
  idToken?: string;
}

interface Web3AuthContextType {
  user: Web3AuthUser | null;
  isLoading: boolean;
  isConnected: boolean;
  login: (provider?: string) => Promise<void>;
  logout: () => Promise<void>;
  getUserInfo: () => Web3AuthUser | null;
  provider: IProvider | null;
  web3auth: Web3Auth | null;
}

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

interface Web3AuthProviderProps {
  children: React.ReactNode;
}

export const Web3AuthProvider: React.FC<Web3AuthProviderProps> = ({ children }) => {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [user, setUser] = useState<Web3AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: "0xaa36a7", // Sepolia
          rpcTarget: "https://rpc.ankr.com/eth_sepolia",
          displayName: "Sepolia Testnet",
          blockExplorerUrl: "https://sepolia.etherscan.io",
          ticker: "ETH",
          tickerName: "Ethereum",
          decimals: 18,
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const web3authInstance = new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
          uiConfig: {
            appName: "Fusion Swap",
            mode: "auto",
            logoLight: "https://web3auth.io/images/web3authlog.png",
            logoDark: "https://web3auth.io/images/web3authlogodark.png",
            defaultLanguage: "en",
            loginMethodsOrder: ["google", "twitter", "github", "discord"],
          },
        });

        await web3authInstance.init();
        setWeb3auth(web3authInstance);

        if (web3authInstance.connected) {
          setProvider(web3authInstance.provider);
          
          // Expose provider globally for blockchain services
          if (typeof window !== 'undefined' && web3authInstance.provider) {
            (window as any).web3authProvider = web3authInstance.provider;
          }
          
          const userInfo = await web3authInstance.getUserInfo();
          console.log('Restored Web3Auth session:', userInfo);
          setUser({
            email: userInfo.email,
            name: userInfo.name,
            profileImage: userInfo.profileImage,
            verifierId: (userInfo as any).verifierId || '',
            typeOfLogin: (userInfo as any).typeOfLogin || 'unknown',
            dappShare: (userInfo as any).dappShare,
            idToken: (userInfo as any).idToken,
          });
        }
      } catch (error) {
        console.error('Web3Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async (loginProvider?: string) => {
    if (!web3auth) {
      console.log('Web3Auth not initialized yet');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Starting Web3Auth login with provider:', loginProvider);
      
      const web3authProvider = await web3auth.connect();
      
      setProvider(web3authProvider);
      
      // Expose provider globally for blockchain services
      if (typeof window !== 'undefined') {
        (window as any).web3authProvider = web3authProvider;
      }
      
      if (web3auth.connected) {
        const userInfo = await web3auth.getUserInfo();
        console.log('Web3Auth login successful:', userInfo);
        setUser({
          email: userInfo.email,
          name: userInfo.name,
          profileImage: userInfo.profileImage,
          verifierId: (userInfo as any).verifierId || '',
          typeOfLogin: (userInfo as any).typeOfLogin || loginProvider || 'unknown',
          dappShare: (userInfo as any).dappShare,
          idToken: (userInfo as any).idToken,
        });
      }
    } catch (error) {
      console.error('Web3Auth login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!web3auth) {
      console.log('Web3Auth not initialized yet');
      return;
    }

    try {
      setIsLoading(true);
      await web3auth.logout();
      setProvider(null);
      setUser(null);
      
      // Clean up global provider
      if (typeof window !== 'undefined') {
        delete (window as any).web3authProvider;
      }
      
      console.log('Web3Auth logout successful');
    } catch (error) {
      console.error('Web3Auth logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getUserInfo = () => {
    return user;
  };

  // Debug logging
  useEffect(() => {
    console.log('Web3Auth Context State:', {
      connected: web3auth?.connected || false,
      user: !!user,
      isConnected: !!user && !!provider,
      isLoading,
      userEmail: user?.email,
      timestamp: new Date().toISOString()
    });
  }, [web3auth, user, provider, isLoading]);

  const value: Web3AuthContextType = {
    user,
    isLoading,
    isConnected: !!user && !!provider,
    login,
    logout,
    getUserInfo,
    provider,
    web3auth,
  };

  return (
    <Web3AuthContext.Provider value={value}>
      {children}
    </Web3AuthContext.Provider>
  );
};

// Hook to use the Web3Auth context
export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth must be used within a Web3AuthProvider');
  }
  
  return {
    isConnected: context.isConnected,
    user: context.user,
    accounts: context.user ? [context.user.verifierId] : [],
    chainId: 11155111, // Sepolia chain ID
    login: context.login,
    logout: context.logout,
    isLoading: context.isLoading,
    walletAddress: context.user?.verifierId || '',
    userInfo: context.user,
    provider: context.provider,
    web3auth: context.web3auth,
  };
};

// Compatibility hooks for components that expect the old API
export const useWeb3AuthUser = () => {
  const context = useContext(Web3AuthContext);
  return {
    user: context?.user || null,
    isLoading: context?.isLoading || false,
  };
};

export const useWeb3AuthConnect = () => {
  const context = useContext(Web3AuthContext);
  return {
    connect: context?.login || (() => Promise.resolve()),
    isLoading: context?.isLoading || false,
  };
};

export const useWeb3AuthDisconnect = () => {
  const context = useContext(Web3AuthContext);
  return {
    disconnect: context?.logout || (() => Promise.resolve()),
  };
};