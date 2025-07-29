"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useWallet } from "@/lib/wallet-context"
import { 
  Wallet, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Check,
  Loader2,
  ChevronRight
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface WalletDrawerProps {
  children: React.ReactNode
  requireChain?: 'sepolia' | 'polygonAmoy' | 'cosmosTestnet'
}

const chainInfo = {
  sepolia: { name: "Ethereum Sepolia", icon: "🔷", type: "EVM" },
  polygonAmoy: { name: "Polygon Amoy", icon: "🟣", type: "EVM" },
  cosmosTestnet: { name: "Cosmos Testnet", icon: "⚛️", type: "Cosmos" }
}

export function WalletDrawer({ children, requireChain }: WalletDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const [copiedAddress, setCopiedAddress] = React.useState<string | null>(null)
  const wallet = useWallet()

  const copyToClipboard = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(type)
      setTimeout(() => setCopiedAddress(null), 2000)
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      })
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleKeplrConnect = async () => {
    try {
      await wallet.connectCosmos()
      toast({
        title: "Keplr Connected",
        description: "Successfully connected to Keplr wallet",
      })
    } catch (error) {
      console.error('Keplr connection failed:', error)
    }
  }

  const isRequiredChainConnected = React.useMemo(() => {
    if (!requireChain) return true
    
    const address = wallet.getAddressForChain(requireChain)
    return !!address
  }, [requireChain, wallet])

  const requiredChainInfo = requireChain ? chainInfo[requireChain] : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Connect Wallet</span>
          </DialogTitle>
          <DialogDescription>
            Connect your wallet to start making cross-chain atomic swaps
            {requireChain && (
              <span className="block mt-2 text-amber-600">
                This action requires connection to {requiredChainInfo?.name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Chain Requirement Alert */}
          {requireChain && !isRequiredChainConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-amber-200 bg-amber-50"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Connect to {requiredChainInfo?.name} required
                </span>
              </div>
            </motion.div>
          )}

          {/* EVM Wallets Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <span className="text-lg">🔷</span>
                <span>EVM Chains</span>
              </CardTitle>
              <CardDescription>
                MetaMask, WalletConnect, and other Ethereum-compatible wallets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* RainbowKit Connect Button */}
              <div className="flex flex-col space-y-3">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading'
                    const connected =
                      ready &&
                      account &&
                      chain &&
                      (!authenticationStatus ||
                        authenticationStatus === 'authenticated')

                    return (
                      <div className="space-y-3">
                        {(() => {
                          if (!connected) {
                            return (
                              <Button 
                                onClick={openConnectModal} 
                                className="w-full"
                                size="lg"
                              >
                                Connect EVM Wallet
                              </Button>
                            )
                          }

                          if (chain.unsupported) {
                            return (
                              <Button 
                                onClick={openChainModal} 
                                variant="destructive"
                                className="w-full"
                                size="lg"
                              >
                                Wrong network
                              </Button>
                            )
                          }

                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center space-x-3">
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                  <div>
                                    <p className="font-medium text-green-800">
                                      {chain.name}
                                    </p>
                                    <p className="text-sm text-green-600 font-mono">
                                      {account.displayName}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(account.address, 'evm')}
                                  >
                                    {copiedAddress === 'evm' ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={openAccountModal}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button 
                                  onClick={openChainModal} 
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Switch Network
                                </Button>
                                <Button 
                                  onClick={openAccountModal} 
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Account
                                </Button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  }}
                </ConnectButton.Custom>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Cosmos Wallets Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <span className="text-lg">⚛️</span>
                <span>Cosmos Ecosystem</span>
              </CardTitle>
              <CardDescription>
                Keplr wallet for Cosmos Hub and other Cosmos chains
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {wallet.cosmosConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">
                          Cosmos Testnet
                        </p>
                        <p className="text-sm text-green-600 font-mono">
                          {wallet.cosmosAddress?.slice(0, 20)}...
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.cosmosAddress!, 'cosmos')}
                    >
                      {copiedAddress === 'cosmos' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={handleKeplrConnect}
                  disabled={wallet.isConnecting}
                  className="w-full"
                  size="lg"
                >
                  {wallet.isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🦄</span>
                      Connect Keplr
                    </>
                  )}
                </Button>
              )}
              
              {!wallet.cosmosConnected && (
                <div className="text-center">
                                     <p className="text-sm text-muted-foreground mb-2">
                     Don&apos;t have Keplr installed?
                   </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('https://www.keplr.app/', '_blank')}
                  >
                    Install Keplr
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Display */}
          {wallet.error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-red-200 bg-red-50"
            >
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Connection Error
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {wallet.error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Connection Status */}
          {(wallet.evmConnected || wallet.cosmosConnected) && (
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="outline"
                onClick={wallet.disconnectAll}
                size="sm"
              >
                Disconnect All
              </Button>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>
                  {wallet.evmConnected && wallet.cosmosConnected 
                    ? 'All wallets connected'
                    : wallet.evmConnected 
                    ? 'EVM wallet connected'
                    : 'Cosmos wallet connected'
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}