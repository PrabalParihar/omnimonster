"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, ExternalLink, Copy, CheckCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface WalletState {
  isConnected: boolean
  address: string | null
  chainId: number | null
  balance: string | null
  isConnecting: boolean
}

export function WalletConnect() {
  const [wallet, setWallet] = React.useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    balance: null,
    isConnecting: false
  })

  // Check if wallet is already connected on mount
  React.useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length > 0) {
        await updateWalletState(accounts[0])
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const updateWalletState = async (address: string) => {
    try {
      // Get chain ID
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      
      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      })

      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18)

      setWallet({
        isConnected: true,
        address,
        chainId: parseInt(chainId, 16),
        balance: balanceInEth.toFixed(4),
        isConnecting: false
      })
    } catch (error) {
      console.error('Error updating wallet state:', error)
      setWallet(prev => ({ ...prev, isConnecting: false }))
    }
  }

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask or another compatible wallet",
        variant: "destructive"
      })
      return
    }

    setWallet(prev => ({ ...prev, isConnecting: true }))

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        await updateWalletState(accounts[0])
        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        })
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      setWallet(prev => ({ ...prev, isConnecting: false }))
      
      if (error.code === 4001) {
        toast({
          title: "Connection Rejected",
          description: "Please approve the connection request in your wallet",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect to wallet",
          variant: "destructive"
        })
      }
    }
  }

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia
      })
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not added, add it
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io/'],
            }],
          })
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError)
        }
      }
    }
  }

  const switchToMonad = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x279f' }], // Monad Testnet
      })
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x279f',
              chainName: 'Monad Testnet',
              nativeCurrency: {
                name: 'MON',
                symbol: 'MON',
                decimals: 18,
              },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: ['https://testnet-explorer.monad.xyz'],
            }],
          })
        } catch (addError) {
          console.error('Error adding Monad network:', addError)
        }
      }
    }
  }

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address)
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 11155111: return 'Sepolia Testnet'
      case 10143: return 'Monad Testnet'
      case 80002: return 'Polygon Amoy'
      case 1: return 'Ethereum Mainnet'
      default: return `Chain ${chainId}`
    }
  }

  const getChainColor = (chainId: number) => {
    switch (chainId) {
      case 11155111: return 'bg-blue-100 text-blue-800'
      case 10143: return 'bg-yellow-100 text-yellow-800'
      case 80002: return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isCorrectNetwork = (chainId: number) => {
    return [11155111, 10143, 80002].includes(chainId)
  }

  // Listen for account and chain changes
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWallet({
          isConnected: false,
          address: null,
          chainId: null,
          balance: null,
          isConnecting: false
        })
      } else {
        updateWalletState(accounts[0])
      }
    }

    const handleChainChanged = (chainId: string) => {
      window.location.reload() // Recommended by MetaMask
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  if (!wallet.isConnected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Connect Wallet</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to perform real blockchain transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={connectWallet} 
            disabled={wallet.isConnecting}
            className="w-full"
          >
            {wallet.isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </Button>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p>Supported networks:</p>
            <ul className="mt-1 space-y-1">
              <li>• Sepolia Testnet (ETH)</li>
              <li>• Monad Testnet (MON)</li>
              <li>• Polygon Amoy (MATIC)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span>Wallet Connected</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Address */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Address</label>
          <div className="flex items-center space-x-2 mt-1">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
              {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
            </code>
            <Button variant="ghost" size="sm" onClick={copyAddress}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a 
                href={`https://sepolia.etherscan.io/address/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Network */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Network</label>
          <div className="flex items-center justify-between mt-1">
            <Badge className={wallet.chainId ? getChainColor(wallet.chainId) : ''}>
              {wallet.chainId ? getChainName(wallet.chainId) : 'Unknown'}
            </Badge>
            {wallet.chainId && !isCorrectNetwork(wallet.chainId) && (
              <Badge variant="destructive">Unsupported</Badge>
            )}
          </div>
        </div>

        {/* Balance */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Balance</label>
          <div className="text-lg font-semibold">
            {wallet.balance} ETH
          </div>
        </div>

        {/* Network Switch Buttons */}
        {wallet.chainId && !isCorrectNetwork(wallet.chainId) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Switch to a supported network:</p>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={switchToSepolia}>
                Sepolia
              </Button>
              <Button variant="outline" size="sm" onClick={switchToMonad}>
                Monad
              </Button>
            </div>
          </div>
        )}

        {/* Ready State */}
        {wallet.chainId && isCorrectNetwork(wallet.chainId) && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Ready for Trading</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              You can now perform real cross-chain swaps
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Global types for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
    }
  }
}