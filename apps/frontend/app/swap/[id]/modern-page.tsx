"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowRight, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  Loader2,
  Shield,
  Zap,
  Sparkles,
  Activity,
  Timer,
  TrendingUp,
  ChevronRight,
  Wallet,
  AlertCircle
} from "lucide-react"
import { ethers } from 'ethers'
import confetti from 'canvas-confetti'

interface SwapStatus {
  id: string;
  status: 'PENDING' | 'POOL_FULFILLED' | 'USER_CLAIMED' | 'EXPIRED' | 'FAILED';
  sourceChain: string;
  sourceToken: string;
  destinationChain: string;
  destinationToken: string;
  sourceAmount: string;
  targetAmount: string;
  userAddress: string;
  beneficiaryAddress: string;
  htlcAddress?: string;
  secretHash?: string;
  timelock: number;
  createdAt: string;
  expiresAt: string;
  fees: {
    networkFee: string;
    exchangeFee: string;
    totalFee: string;
  };
  route: {
    description: string;
    steps: string[];
  };
}

interface SwapStatusPageProps {
  params: {
    id: string
  }
}

// Claim Button Component
function ClaimButton({ swapStatus }: { swapStatus: SwapStatus }) {
  const [isClaiming, setIsClaiming] = React.useState(false)
  const { toast } = useToast()

  const handleWalletClaim = async () => {
    try {
      setIsClaiming(true)
      
      if (!window.ethereum) {
        toast({
          title: "Wallet Not Found",
          description: "Please install MetaMask or another Web3 wallet",
          variant: "destructive",
        })
        return
      }

      const swapResponse = await fetch(`/api/swaps/${swapStatus.id}/claim`)
      if (!swapResponse.ok) {
        const errorData = await swapResponse.json()
        throw new Error(errorData.error || 'Failed to fetch swap details')
      }
      
      const swapData = await swapResponse.json()
      
      if (!swapData.poolHtlcContract || !swapData.preimage) {
        throw new Error('Swap is not ready for claiming. Missing pool HTLC or preimage.')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      if (userAddress.toLowerCase() !== swapStatus.userAddress.toLowerCase() && 
          userAddress.toLowerCase() !== swapStatus.beneficiaryAddress.toLowerCase()) {
        throw new Error(`Wrong wallet connected. Expected: ${swapStatus.userAddress}, Got: ${userAddress}`)
      }

      const targetChain = swapStatus.destinationChain || swapData.target_token?.split(':')[0] || 'monadTestnet'
      
      const chainConfigs: Record<string, { chainId: string; htlcAddress: string; name: string }> = {
        sepolia: {
          chainId: '0xaa36a7',
          htlcAddress: '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D',
          name: 'Sepolia'
        },
        monadTestnet: {
          chainId: '0x279f',
          htlcAddress: '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9',
          name: 'Monad Testnet'
        },
        etherlinkTestnet: {
          chainId: '0x1f47b',
          htlcAddress: '0xC9E4Df418AEeCA680D8933A730Bd207F17B3C260',
          name: 'Etherlink Testnet'
        }
      }

      const chainConfig = chainConfigs[targetChain]
      if (!chainConfig) {
        throw new Error(`Unsupported chain: ${targetChain}`)
      }

      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (currentChainId !== chainConfig.chainId) {
        toast({
          title: "Switching Network",
          description: `Switching to ${chainConfig.name}...`,
        })
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainConfig.chainId }],
          })
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            toast({
              title: "Network Not Found",
              description: `Please add ${chainConfig.name} to your wallet`,
              variant: "destructive",
            })
          }
          throw switchError
        }
      }

      // Import the unified HTLC client
      const { UnifiedHTLCClient } = await import('@/lib/htlc-client');
      
      const htlcClient = new UnifiedHTLCClient(chainConfig.htlcAddress, signer);

      // Debug logging
      console.log('Claiming HTLC:', {
        contractId: swapData.poolHtlcContract,
        htlcAddress: chainConfig.htlcAddress,
        preimage: swapData.preimage
      });

      // Get HTLC details using unified client
      const details = await htlcClient.getHTLCDetails(swapData.poolHtlcContract);
      
      console.log('HTLC details:', details);
      console.log('Contract type detected:', htlcClient.getContractType());
      console.log('State:', details.state, htlcClient.getStateDescription(details.state));
      
      if (details.state !== 1) {
        throw new Error(`HTLC not claimable. State: ${details.state} (${htlcClient.getStateDescription(details.state)})`)
      }

      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet",
      })

      const tx = await htlcClient.claim(swapData.poolHtlcContract, swapData.preimage)
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for confirmation...",
      })

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        await fetch(`/api/swaps/${swapStatus.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'USER_CLAIMED',
            userClaimedAt: new Date().toISOString()
          })
        })

        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })

        toast({
          title: "Claim Successful! 🎉",
          description: `Successfully claimed ${swapStatus.targetAmount} ${swapStatus.destinationToken}`,
        })
        
        setTimeout(() => window.location.reload(), 2000)
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Claim error:', error)
      
      let errorMessage = "An error occurred while claiming"
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = "Transaction was rejected"
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsClaiming(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="glass-effect glow-effect">
        <CardContent className="p-8 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
              <Sparkles className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
          </motion.div>
          
          <h3 className="text-2xl font-bold mb-2">Ready to Claim!</h3>
          <p className="text-muted-foreground mb-6">
            Your <span className="font-semibold">{formatTokenAmount(swapStatus.targetAmount)} {swapStatus.destinationToken}</span> tokens are waiting for you
          </p>
          
          <Button 
            onClick={handleWalletClaim}
            disabled={isClaiming}
            className="gradient-primary px-8 py-6 text-lg"
            size="lg"
          >
            {isClaiming ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5 mr-2" />
                Claim Tokens
              </>
            )}
          </Button>
          
          <p className="text-sm text-muted-foreground mt-4">
            Connect your wallet to claim tokens securely
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function ModernSwapStatusPage({ params }: SwapStatusPageProps) {
  const swapId = params.id
  
  const [swapStatus, setSwapStatus] = React.useState<SwapStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [progress, setProgress] = React.useState(0)
  const { toast } = useToast()

  const fetchSwapStatus = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/swaps/${swapId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setSwapStatus(null)
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Parse source and target tokens which are in format "chain:token"
      const [sourceChain, sourceToken] = (data.sourceToken || '').split(':')
      const [destChain, destToken] = (data.targetToken || '').split(':')
      
      const swapStatus: SwapStatus = {
        id: data.id,
        status: data.status,
        sourceChain: sourceChain || data.sourceChain || data.source_chain || '',
        sourceToken: sourceToken || data.sourceToken || data.source_token || '',
        destinationChain: destChain || data.destinationChain || data.target_chain || '',
        destinationToken: destToken || data.destinationToken || data.target_token || '',
        sourceAmount: data.sourceAmount || data.source_amount || '0',
        targetAmount: data.expectedAmount || data.targetAmount || data.target_amount || '0',
        userAddress: data.userAddress || data.user_address || '',
        beneficiaryAddress: data.userAddress || data.beneficiaryAddress || data.beneficiary_address || '',
        htlcAddress: data.userHtlcContract || data.htlcAddress || data.htlc_address || '',
        secretHash: data.hashLock || data.secretHash || data.secret_hash || '',
        timelock: data.expirationTime || data.timelock || data.timelock_seconds || 0,
        createdAt: data.createdAt || data.created_at || '',
        expiresAt: data.expirationTime ? new Date(parseInt(data.expirationTime) * 1000).toISOString() : data.expiresAt || data.expires_at || '',
        fees: data.fees || {
          networkFee: '0.01',
          exchangeFee: '0.03',
          totalFee: '0.04'
        },
        route: data.route || {
          description: `${sourceToken} on ${sourceChain} → ${destToken} on ${destChain}`,
          steps: [
            `Lock ${sourceToken} tokens`,
            `Validate liquidity`,
            `Deploy HTLC contract`,
            `Claim tokens`
          ]
        }
      }
      
      setSwapStatus(swapStatus)
      
      const progressMap = {
        'PENDING': 25,
        'POOL_FULFILLED': 75,
        'USER_CLAIMED': 100,
        'EXPIRED': 0,
        'FAILED': 0
      }
      setProgress(progressMap[swapStatus.status])
      
    } catch (error) {
      console.error('Error fetching swap status:', error)
      toast({
        title: "Error",
        description: "Failed to fetch swap status",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [swapId])

  React.useEffect(() => {
    fetchSwapStatus()
    const interval = setInterval(fetchSwapStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchSwapStatus])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    })
  }

  const getTimeRemaining = (expiresAt: string) => {
    if (!expiresAt) return 'N/A'
    
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m`
    } else {
      return 'Less than 1m'
    }
  }

  const formatTokenAmount = (amount: string, decimals: number = 18) => {
    try {
      if (!amount || amount === '0') return '0'
      const formatted = ethers.formatUnits(amount, decimals)
      // Format to max 6 decimal places
      const num = parseFloat(formatted)
      if (num === 0) return '0'
      return num.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 6 
      })
    } catch (e) {
      return amount
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg">Loading swap status...</span>
        </motion.div>
      </div>
    )
  }

  if (!swapStatus) {
    return (
      <div className="min-h-screen gradient-bg">
        <div className="container mx-auto px-4 py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="glass-effect">
              <CardContent className="text-center py-16">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Swap Not Found</h2>
                <p className="text-muted-foreground">
                  The swap with ID {swapId} could not be found.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  const statusColors = {
    'PENDING': 'yellow',
    'POOL_FULFILLED': 'blue',
    'USER_CLAIMED': 'green',
    'EXPIRED': 'red',
    'FAILED': 'red'
  }

  const statusIcons = {
    'PENDING': <Clock className="h-5 w-5" />,
    'POOL_FULFILLED': <Zap className="h-5 w-5" />,
    'USER_CLAIMED': <CheckCircle className="h-5 w-5" />,
    'EXPIRED': <AlertTriangle className="h-5 w-5" />,
    'FAILED': <AlertTriangle className="h-5 w-5" />
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold mb-2">
              <span className="text-gradient">Swap Status</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Track your cross-chain swap in real-time
            </p>
          </motion.div>

          {/* Main Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-effect glow-effect">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${statusColors[swapStatus.status]}-100 dark:bg-${statusColors[swapStatus.status]}-900/20`}>
                      {statusIcons[swapStatus.status]}
                    </div>
                    <div>
                      <CardTitle>Swap #{swapStatus.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        <Badge variant="secondary" className="mt-1">
                          {swapStatus.status.replace('_', ' ')}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(swapStatus.id, 'Swap ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}% Complete</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                {/* Swap Flow */}
                <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl p-8 border border-white/10">
                  <div className="grid md:grid-cols-3 gap-6 items-center">
                    {/* From */}
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-center"
                    >
                      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-4">
                        <span className="text-4xl">
                          {!swapStatus.sourceChain ? '❓' :
                           swapStatus.sourceChain === 'sepolia' ? '🔷' : 
                           swapStatus.sourceChain === 'monadTestnet' ? '🟡' : '🟣'}
                        </span>
                      </div>
                      <div className="font-bold text-2xl mb-1">{formatTokenAmount(swapStatus.sourceAmount)}</div>
                      <div className="text-lg font-medium">{swapStatus.sourceToken}</div>
                      <div className="text-sm text-muted-foreground capitalize mt-2 flex items-center justify-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        {swapStatus.sourceChain ? swapStatus.sourceChain.replace('Testnet', ' Testnet') : 'Unknown Chain'}
                      </div>
                    </motion.div>

                    {/* Arrow */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex justify-center"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-50"></div>
                        <div className="relative p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                          <ArrowRight className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    </motion.div>

                    {/* To */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-center"
                    >
                      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center mb-4">
                        <span className="text-4xl">
                          {!swapStatus.destinationChain ? '❓' :
                           swapStatus.destinationChain === 'sepolia' ? '🔷' : 
                           swapStatus.destinationChain === 'monadTestnet' ? '🟡' : '🟣'}
                        </span>
                      </div>
                      <div className="font-bold text-2xl mb-1">{formatTokenAmount(swapStatus.targetAmount)}</div>
                      <div className="text-lg font-medium">{swapStatus.destinationToken}</div>
                      <div className="text-sm text-muted-foreground capitalize mt-2 flex items-center justify-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        {swapStatus.destinationChain ? swapStatus.destinationChain.replace('Testnet', ' Testnet') : 'Unknown Chain'}
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Transaction Steps
                  </h3>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {swapStatus.route.steps.map((step, index) => {
                        const isCompleted = index < (progress / 25)
                        const isCurrent = index === Math.floor(progress / 25)
                        
                        return (
                          <motion.div 
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className={`flex items-center gap-4 p-3 rounded-lg ${
                              isCurrent ? 'bg-primary/10 border border-primary/20' : ''
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              isCompleted ? 'bg-green-500 text-white' :
                              isCurrent ? 'bg-primary text-primary-foreground animate-pulse' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                            </div>
                            <span className={`flex-1 ${
                              isCompleted ? 'text-green-600 dark:text-green-400' : 
                              isCurrent ? 'font-medium' : 
                              'text-muted-foreground'
                            }`}>
                              {step}
                            </span>
                            {isCurrent && (
                              <Badge variant="secondary" className="animate-pulse">
                                In Progress
                              </Badge>
                            )}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Swap Details */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="hover-lift">
                <CardHeader className="bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Swap Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="p-4 rounded-lg bg-muted/50 border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        Time Remaining
                      </span>
                      <div className="flex items-center gap-2">
                        {swapStatus.status === 'USER_CLAIMED' ? (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                            Completed
                          </Badge>
                        ) : (
                          <span className="font-mono font-medium text-lg">
                            {getTimeRemaining(swapStatus.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Beneficiary</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-3 py-1.5 rounded-full font-mono">
                            {swapStatus.beneficiaryAddress ? 
                              `${swapStatus.beneficiaryAddress.slice(0, 6)}...${swapStatus.beneficiaryAddress.slice(-4)}` : 
                              'N/A'
                            }
                          </code>
                          {swapStatus.beneficiaryAddress && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(swapStatus.beneficiaryAddress, 'Address')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {swapStatus.htlcAddress && (
                      <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">HTLC Contract</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-3 py-1.5 rounded-full font-mono">
                              {swapStatus.htlcAddress.slice(0, 6)}...{swapStatus.htlcAddress.slice(-4)}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(swapStatus.htlcAddress!, 'Contract')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Swap ID</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-3 py-1.5 rounded-full font-mono">
                            {swapStatus.id.slice(0, 8)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(swapStatus.id, 'Swap ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Fee Breakdown */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="hover-lift">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Fee Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network Fee</span>
                      <span>{swapStatus.fees.networkFee} {swapStatus.sourceToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exchange Fee</span>
                      <span>{swapStatus.fees.exchangeFee} {swapStatus.sourceToken}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>{swapStatus.fees.totalFee} {swapStatus.sourceToken}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      💡 You save on gas fees with our gasless claim feature!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Action Section */}
          <AnimatePresence>
            {swapStatus.status === 'POOL_FULFILLED' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ClaimButton swapStatus={swapStatus} />
              </motion.div>
            )}

            {swapStatus.status === 'USER_CLAIMED' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring" }}
              >
                <Card className="glass-effect border-green-200 dark:border-green-800">
                  <CardContent className="p-8 text-center">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                      Swap Completed Successfully!
                    </h3>
                    <p className="text-lg text-muted-foreground">
                      You have received <span className="font-bold text-green-600 dark:text-green-400">{formatTokenAmount(swapStatus.targetAmount)} {swapStatus.destinationToken}</span>
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}