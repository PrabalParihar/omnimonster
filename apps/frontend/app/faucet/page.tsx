"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"
import { 
  Droplets, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Wallet,
  Timer,
  Sparkles,
  Gift,
  Coins,
  Info,
  Shield,
  ArrowRight
} from "lucide-react"
import { useWallet } from "@/lib/wallet-context"
import { ethers } from "ethers"

interface FaucetToken {
  symbol: string
  name: string
  icon: string
  chain: string
  address: string
  decimals: number
  maxAmount: number
}

const FAUCET_TOKENS: FaucetToken[] = [
  {
    symbol: "MONSTER",
    name: "Monster Token",
    icon: "🦄",
    chain: "sepolia",
    address: "0x1234567890123456789012345678901234567890",
    decimals: 18,
    maxAmount: 5
  },
  {
    symbol: "DRAGON",
    name: "Dragon Token",
    icon: "🐉",
    chain: "sepolia",
    address: "0x2345678901234567890123456789012345678901",
    decimals: 18,
    maxAmount: 5
  },
  {
    symbol: "MONSTER",
    name: "Monster Token",
    icon: "🦄",
    chain: "monadTestnet",
    address: "0x3456789012345678901234567890123456789012",
    decimals: 18,
    maxAmount: 5
  },
  {
    symbol: "OMNIMONSTER",
    name: "Omni Monster",
    icon: "🌟",
    chain: "monadTestnet",
    address: "0x4567890123456789012345678901234567890123",
    decimals: 18,
    maxAmount: 5
  }
]

const CHAIN_CONFIGS = {
  sepolia: {
    chainId: '0xaa36a7',
    name: 'Sepolia',
    icon: '🔷',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR-PROJECT-ID'
  },
  monadTestnet: {
    chainId: '0x279f',
    name: 'Monad Testnet',
    icon: '🟡',
    rpcUrl: 'https://testnet.monad.xyz'
  }
}

// Rate limiting storage
const RATE_LIMIT_KEY = 'faucet_claims'
const RATE_LIMIT_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface ClaimRecord {
  address: string
  token: string
  chain: string
  amount: number
  timestamp: number
}

function getRateLimitData(): ClaimRecord[] {
  const data = localStorage.getItem(RATE_LIMIT_KEY)
  return data ? JSON.parse(data) : []
}

function setRateLimitData(records: ClaimRecord[]) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(records))
}

function canClaim(address: string, token: string, chain: string): { allowed: boolean; remainingAmount: number; nextClaimTime?: number } {
  const records = getRateLimitData()
  const now = Date.now()
  
  // Clean up old records
  const validRecords = records.filter(r => now - r.timestamp < RATE_LIMIT_DURATION)
  setRateLimitData(validRecords)
  
  // Check claims for this address, token, and chain
  const userClaims = validRecords.filter(
    r => r.address.toLowerCase() === address.toLowerCase() && 
         r.token === token && 
         r.chain === chain
  )
  
  if (userClaims.length === 0) {
    return { allowed: true, remainingAmount: 5 }
  }
  
  const totalClaimed = userClaims.reduce((sum, claim) => sum + claim.amount, 0)
  const lastClaim = Math.max(...userClaims.map(c => c.timestamp))
  
  if (totalClaimed >= 5) {
    return { 
      allowed: false, 
      remainingAmount: 0, 
      nextClaimTime: lastClaim + RATE_LIMIT_DURATION 
    }
  }
  
  return { allowed: true, remainingAmount: 5 - totalClaimed }
}

function recordClaim(address: string, token: string, chain: string, amount: number) {
  const records = getRateLimitData()
  records.push({
    address,
    token,
    chain,
    amount,
    timestamp: Date.now()
  })
  setRateLimitData(records)
}

export default function FaucetPage() {
  const [selectedChain, setSelectedChain] = React.useState<string>("sepolia")
  const [selectedToken, setSelectedToken] = React.useState<string>("")
  const [amount, setAmount] = React.useState<string>("1")
  const [isClaiming, setIsClaiming] = React.useState(false)
  const [claimHistory, setClaimHistory] = React.useState<ClaimRecord[]>([])
  
  const { toast } = useToast()
  const { evmConnected, evmAddress } = useWallet()

  React.useEffect(() => {
    if (evmAddress) {
      const records = getRateLimitData()
      const userHistory = records.filter(
        r => r.address.toLowerCase() === evmAddress.toLowerCase()
      )
      setClaimHistory(userHistory)
    }
  }, [evmAddress])

  const availableTokens = FAUCET_TOKENS.filter(t => t.chain === selectedChain)
  
  React.useEffect(() => {
    if (availableTokens.length > 0 && !availableTokens.find(t => t.symbol === selectedToken)) {
      setSelectedToken(availableTokens[0].symbol)
    }
  }, [selectedChain, selectedToken, availableTokens])

  const handleClaim = async () => {
    if (!evmConnected || !evmAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim tokens",
        variant: "destructive"
      })
      return
    }

    const token = availableTokens.find(t => t.symbol === selectedToken)
    if (!token) return

    const claimAmount = parseFloat(amount)
    if (isNaN(claimAmount) || claimAmount <= 0 || claimAmount > token.maxAmount) {
      toast({
        title: "Invalid Amount",
        description: `Please enter a valid amount between 0 and ${token.maxAmount}`,
        variant: "destructive"
      })
      return
    }

    // Check rate limit
    const { allowed, remainingAmount, nextClaimTime } = canClaim(evmAddress, selectedToken, selectedChain)
    
    if (!allowed && nextClaimTime) {
      const timeUntilNext = new Date(nextClaimTime).toLocaleString()
      toast({
        title: "Rate Limit Exceeded",
        description: `You've claimed the maximum amount. Try again after ${timeUntilNext}`,
        variant: "destructive"
      })
      return
    }

    if (claimAmount > remainingAmount) {
      toast({
        title: "Amount Exceeds Limit",
        description: `You can only claim ${remainingAmount} more ${selectedToken} tokens`,
        variant: "destructive"
      })
      return
    }

    setIsClaiming(true)

    try {
      // Check if correct network
      const chainConfig = CHAIN_CONFIGS[selectedChain as keyof typeof CHAIN_CONFIGS]
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

      // Simulate API call to faucet backend
      await new Promise(resolve => setTimeout(resolve, 2000))

      // In production, this would call your backend API that:
      // 1. Verifies the rate limit server-side
      // 2. Sends tokens from a faucet wallet
      // 3. Returns the transaction hash

      // Record the claim
      recordClaim(evmAddress, selectedToken, selectedChain, claimAmount)

      // Trigger success animation
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      })

      toast({
        title: "Tokens Claimed! 🎉",
        description: `Successfully claimed ${claimAmount} ${selectedToken} tokens`,
      })

      // Refresh claim history
      setClaimHistory([...claimHistory, {
        address: evmAddress,
        token: selectedToken,
        chain: selectedChain,
        amount: claimAmount,
        timestamp: Date.now()
      }])

      // Reset form
      setAmount("1")

    } catch (error: any) {
      console.error('Claim error:', error)
      toast({
        title: "Claim Failed",
        description: error.message || "An error occurred while claiming tokens",
        variant: "destructive"
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const getRemainingAmount = () => {
    if (!evmAddress || !selectedToken) return 5
    const { remainingAmount } = canClaim(evmAddress, selectedToken, selectedChain)
    return remainingAmount
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
            <h1 className="text-5xl font-bold mb-4">
              <span className="text-gradient">Token Faucet</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get test tokens to try out Swap Sage on testnet networks
            </p>
          </motion.div>

          {/* Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Alert className="glass-effect">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Testnet Only:</strong> These tokens have no real value and are for testing purposes only. 
                Each wallet can claim up to 5 tokens per 24 hours for each token type.
              </AlertDescription>
            </Alert>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Faucet Form */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2"
            >
              <Card className="glass-effect glow-effect">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Droplets className="h-6 w-6" />
                    Claim Test Tokens
                  </CardTitle>
                  <CardDescription>
                    Select a network and token to receive test tokens for free
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Network Selection */}
                  <div className="space-y-2">
                    <Label>Select Network</Label>
                    <Select value={selectedChain} onValueChange={setSelectedChain}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{config.icon}</span>
                              <span>{config.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Token Selection */}
                  <div className="space-y-2">
                    <Label>Select Token</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {availableTokens.map((token) => (
                        <motion.div
                          key={`${token.chain}-${token.symbol}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card 
                            className={`cursor-pointer transition-all ${
                              selectedToken === token.symbol 
                                ? 'ring-2 ring-primary bg-primary/5' 
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedToken(token.symbol)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{token.icon}</span>
                                <div>
                                  <p className="font-medium">{token.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{token.name}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Amount</Label>
                      <span className="text-sm text-muted-foreground">
                        Remaining: {getRemainingAmount()} tokens
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0.1"
                        max={getRemainingAmount()}
                        step="0.1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-12 text-lg font-mono pr-20"
                        placeholder="0.0"
                      />
                      <Badge 
                        variant="secondary" 
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        MAX: {getRemainingAmount()}
                      </Badge>
                    </div>
                  </div>

                  {/* Wallet Connection / Claim Button */}
                  {!evmConnected ? (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertDescription>
                        Please connect your wallet to claim tokens
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Button
                      onClick={handleClaim}
                      disabled={isClaiming || !selectedToken || getRemainingAmount() === 0}
                      className="w-full h-12 text-lg gradient-primary"
                      size="lg"
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Claiming...
                        </>
                      ) : getRemainingAmount() === 0 ? (
                        <>
                          <Timer className="h-5 w-5 mr-2" />
                          Rate Limit Reached
                        </>
                      ) : (
                        <>
                          <Gift className="h-5 w-5 mr-2" />
                          Claim {amount} {selectedToken}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Side Panel */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* How It Works */}
              <Card className="hover-lift">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Connect Wallet</p>
                      <p className="text-sm text-muted-foreground">
                        Connect your Web3 wallet to get started
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Select Token</p>
                      <p className="text-sm text-muted-foreground">
                        Choose network and token type
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Claim Tokens</p>
                      <p className="text-sm text-muted-foreground">
                        Receive up to 5 tokens per day
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Claims */}
              {claimHistory.length > 0 && (
                <Card className="hover-lift">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-5 w-5" />
                      Your Claims
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {claimHistory.slice(-3).reverse().map((claim, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{claim.amount} {claim.token}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {new Date(claim.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Security Note */}
              <Card className="gradient-card">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Security Note</p>
                      <p className="text-xs text-muted-foreground">
                        Never share your private keys. Official faucets will never ask for them.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Features */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-3 gap-6"
          >
            <Card className="hover-lift">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                  <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-1">Free Tokens</h3>
                <p className="text-sm text-muted-foreground">
                  Get test tokens instantly without any cost
                </p>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                  <Timer className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-1">Rate Limited</h3>
                <p className="text-sm text-muted-foreground">
                  Fair distribution with daily limits per wallet
                </p>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-1">Secure</h3>
                <p className="text-sm text-muted-foreground">
                  No private keys required, just your wallet address
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Import confetti for celebration effect
import confetti from 'canvas-confetti'