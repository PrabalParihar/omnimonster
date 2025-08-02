"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowRight, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  Loader2,
  Shield,
  Zap
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"

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

export default function SwapStatusPage({ params }: SwapStatusPageProps) {
  const swapId = params.id
  
  const [swapStatus, setSwapStatus] = React.useState<SwapStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [progress, setProgress] = React.useState(0)

  const fetchSwapStatus = React.useCallback(async () => {
    try {
      console.log(`🔍 Fetching swap status for: ${swapId}`)
      
      const response = await fetch(`/api/swaps/${swapId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setSwapStatus(null)
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log(`✅ Fetched swap status:`, data)
      
      // Transform API response to SwapStatus format
      const swapStatus: SwapStatus = {
        id: data.id,
        status: data.status,
        sourceChain: data.sourceChain || data.source_chain,
        sourceToken: data.sourceToken || data.source_token,
        destinationChain: data.destinationChain || data.target_chain,
        destinationToken: data.destinationToken || data.target_token,
        sourceAmount: data.sourceAmount || data.source_amount,
        targetAmount: data.targetAmount || data.target_amount,
        userAddress: data.userAddress || data.user_address,
        beneficiaryAddress: data.beneficiaryAddress || data.beneficiary_address,
        htlcAddress: data.htlcAddress || data.htlc_address,
        secretHash: data.secretHash || data.secret_hash,
        timelock: data.timelock || data.timelock_seconds,
        createdAt: data.createdAt || data.created_at,
        expiresAt: data.expiresAt || data.expires_at,
        fees: data.fees || {
          networkFee: '0.01',
          exchangeFee: '0.03',
          totalFee: '0.04'
        },
        route: data.route || {
          description: `${data.sourceToken || data.source_token} on ${data.sourceChain || data.source_chain} → ${data.destinationToken || data.target_token} on ${data.destinationChain || data.target_chain}`,
          steps: [
            `Lock ${data.sourceToken || data.source_token} tokens on ${data.sourceChain || data.source_chain}`,
            `Validate ${data.destinationToken || data.target_token} liquidity on ${data.destinationChain || data.target_chain}`,
            `Deploy HTLC with ${data.destinationToken || data.target_token} tokens`,
            `User claims ${data.destinationToken || data.target_token} tokens gaslessly`
          ]
        }
      }
      
      setSwapStatus(swapStatus)
      
      // Calculate progress based on status
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
    
    // Poll for updates every 3 seconds for better responsiveness
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
      case 'POOL_FULFILLED':
        return <Zap className="h-5 w-5 text-blue-500" />
      case 'USER_CLAIMED':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'EXPIRED':
      case 'FAILED':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'secondary'
      case 'POOL_FULFILLED':
        return 'default'
      case 'USER_CLAIMED':
        return 'default'
      case 'EXPIRED':
      case 'FAILED':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getChainIcon = (chain: string) => {
    switch (chain) {
      case 'sepolia': return '🔷'
      case 'monadTestnet': return '🟡'
      case 'polygonAmoy': return '🟣'
      default: return '🔗'
    }
  }

  const getTokenIcon = (token: string) => {
    switch (token) {
      case 'MONSTER': return '🦄'
      case 'OMNI': return '🌟'
      case 'USDC': return '💵'
      case 'USDT': return '💴'
      default: return '🪙'
    }
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h ${minutes}m remaining`
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading swap status...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!swapStatus) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Swap Not Found</h2>
              <p className="text-muted-foreground">
                The swap with ID {swapId} could not be found.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Cross-Chain Swap Status</h1>
          <p className="text-muted-foreground">
            Track your {swapStatus.sourceToken} → {swapStatus.destinationToken} swap progress
          </p>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(swapStatus.status)}
                <span>Swap Status</span>
                <Badge variant={getStatusBadgeVariant(swapStatus.status)}>
                  {swapStatus.status.replace('_', ' ')}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(swapStatus.id, 'Swap ID')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy ID
              </Button>
            </CardTitle>
            <CardDescription>
              Swap ID: {swapStatus.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Swap Details */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* From */}
                <div className="text-center">
                  <div className="text-2xl mb-2">
                    {getChainIcon(swapStatus.sourceChain)} {getTokenIcon(swapStatus.sourceToken)}
                  </div>
                  <div className="font-semibold">{swapStatus.sourceAmount} {swapStatus.sourceToken}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {swapStatus.sourceChain}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>

                {/* To */}
                <div className="text-center">
                  <div className="text-2xl mb-2">
                    {getChainIcon(swapStatus.destinationChain)} {getTokenIcon(swapStatus.destinationToken)}
                  </div>
                  <div className="font-semibold">{swapStatus.targetAmount} {swapStatus.destinationToken}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {swapStatus.destinationChain}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Swap Timeline</h4>
                <div className="space-y-3">
                  {swapStatus.route.steps.map((step, index) => {
                    const isCompleted = index < (progress / 25)
                    const isCurrent = index === Math.floor(progress / 25)
                    
                    return (
                      <div key={index} className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className={isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700 font-medium' : 'text-muted-foreground'}>
                          {step}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Swap Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Swap Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(swapStatus.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span>{getTimeRemaining(swapStatus.expiresAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Beneficiary:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm">
                    {swapStatus.beneficiaryAddress ? 
                      `${swapStatus.beneficiaryAddress.slice(0, 6)}...${swapStatus.beneficiaryAddress.slice(-4)}` : 
                      'N/A'
                    }
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => swapStatus.beneficiaryAddress && copyToClipboard(swapStatus.beneficiaryAddress, 'Beneficiary address')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {swapStatus.htlcAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HTLC Address:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">
                      {swapStatus.htlcAddress.slice(0, 6)}...{swapStatus.htlcAddress.slice(-4)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(swapStatus.htlcAddress!, 'HTLC address')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fees */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee:</span>
                <span>{swapStatus.fees.networkFee} {swapStatus.sourceToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Fee:</span>
                <span>{swapStatus.fees.exchangeFee} {swapStatus.sourceToken}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Fees:</span>
                <span>{swapStatus.fees.totalFee} {swapStatus.sourceToken}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {swapStatus.status === 'POOL_FULFILLED' && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <Zap className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Ready to Claim!</h3>
                <p className="text-muted-foreground">
                  Your {swapStatus.destinationToken} tokens are ready for gasless claiming
                </p>
              </div>
              <Button className="mr-2">
                Claim {swapStatus.targetAmount} {swapStatus.destinationToken}
              </Button>
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Explorer
              </Button>
            </CardContent>
          </Card>
        )}

        {swapStatus.status === 'USER_CLAIMED' && (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700">Swap Completed!</h3>
              <p className="text-muted-foreground">
                You have successfully received {swapStatus.targetAmount} {swapStatus.destinationToken}
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}