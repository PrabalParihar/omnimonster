"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowRightLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Zap, 
  Shield, 
  Clock, 
  ArrowUpDown,
  Sparkles,
  Wallet,
  TrendingUp,
  Info,
  ArrowRight,
  Lock,
  Rocket
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { getTokensForChain, SUPPORTED_SWAP_PAIRS, Token } from "@swap-sage/shared"
import { allChains, ChainConfig } from "@swap-sage/shared"
import { WalletConnect } from "./wallet-connect"
import { motion } from "framer-motion"

// Form validation schema
const swapFormSchema = z.object({
  fromChain: z.string().min(1, "Source chain is required"),
  fromToken: z.string().min(1, "Source token is required"),
  toChain: z.string().min(1, "Destination chain is required"),
  toToken: z.string().min(1, "Destination token is required"),
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number"
  }),
  beneficiary: z.string().min(1, "Beneficiary address is required"),
  timelock: z.string().default("3600"),
  dryRun: z.boolean().default(true)
})

type SwapFormData = z.infer<typeof swapFormSchema>

// Mock balance data
const mockBalances: Record<string, Record<string, string>> = {
  sepolia: {
    'MONSTER': '100.0',
    'USDC': '1000.0',
    'USDT': '500.0'
  },
  monadTestnet: {
    'MONSTER': '25.0',
    'OMNIMONSTER': '75.0'
  },
  polygonAmoy: {
    'USDC': '750.0',
    'USDT': '250.0',
    'MATIC': '10.0'
  }
}

const chainLogos: Record<string, string> = {
  sepolia: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  polygonAmoy: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  monadTestnet: "/monad-logo.svg",
  etherlinkTestnet: "/etherlink-logo.svg"
}

export function ModernSwapForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [swapProgress, setSwapProgress] = React.useState<string>("")
  const [availableTokens, setAvailableTokens] = React.useState<{ from: Token[], to: Token[] }>({ from: [], to: [] })
  const [quote, setQuote] = React.useState<any>(null)
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false)

  const { 
    evmConnected,
    cosmosConnected,
    evmAddress,
    cosmosAddress
  } = useWallet()

  const isConnected = evmConnected || cosmosConnected
  const address = evmAddress || cosmosAddress

  const form = useForm<SwapFormData>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: {
      fromChain: "sepolia",
      fromToken: "MONSTER",
      toChain: "monadTestnet", 
      toToken: "OMNIMONSTER",
      amount: "",
      beneficiary: address || "",
      timelock: "3600",
      dryRun: true
    }
  })

  const fromChain = form.watch("fromChain")
  const fromToken = form.watch("fromToken")
  const toChain = form.watch("toChain")
  const toToken = form.watch("toToken")
  const amount = form.watch("amount")

  // Update available tokens when chains change
  React.useEffect(() => {
    const fromTokens = getTokensForChain(fromChain)
    const toTokens = getTokensForChain(toChain)
    
    setAvailableTokens({ from: fromTokens, to: toTokens })
    
    if (fromTokens.length > 0 && !fromTokens.find(t => t.symbol === fromToken)) {
      form.setValue("fromToken", fromTokens[0].symbol)
    }
    if (toTokens.length > 0 && !toTokens.find(t => t.symbol === toToken)) {
      form.setValue("toToken", toTokens[0].symbol)
    }
  }, [fromChain, toChain, fromToken, toToken, form])

  // Update beneficiary when wallet address changes
  React.useEffect(() => {
    if (address && address !== form.getValues("beneficiary")) {
      form.setValue("beneficiary", address)
    }
  }, [address, form])

  // Get quote when parameters change
  React.useEffect(() => {
    if (fromChain && fromToken && toChain && toToken && amount && parseFloat(amount) > 0) {
      getQuote()
    }
  }, [fromChain, fromToken, toChain, toToken, amount])

  const getQuote = async () => {
    if (!fromChain || !fromToken || !toChain || !toToken || !amount) return

    setIsLoadingQuote(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const sourceAmount = parseFloat(amount)
      const exchangeRate = fromToken === 'MONSTER' && toToken === 'OMNIMONSTER' ? 0.99 : 
                          fromToken === 'OMNIMONSTER' && toToken === 'MONSTER' ? 1.01 :
                          0.99
      
      const targetAmount = sourceAmount * exchangeRate
      const fees = sourceAmount * 0.003
      
      setQuote({
        sourceAmount,
        targetAmount: targetAmount - fees,
        exchangeRate,
        fees,
        priceImpact: 0.1,
        estimatedTime: '2-5 minutes',
        route: `${fromChain} → ${toChain}`,
        savings: sourceAmount * 0.001
      })
    } catch (error) {
      console.error('Failed to get quote:', error)
    } finally {
      setIsLoadingQuote(false)
    }
  }

  const getMaxBalance = () => {
    return mockBalances[fromChain]?.[fromToken] || '0'
  }

  const setMaxAmount = () => {
    const maxBalance = getMaxBalance()
    form.setValue("amount", maxBalance)
  }

  const swapTokens = () => {
    const currentFromChain = form.getValues("fromChain")
    const currentFromToken = form.getValues("fromToken")
    const currentToChain = form.getValues("toChain")
    const currentToToken = form.getValues("toToken")

    form.setValue("fromChain", currentToChain)
    form.setValue("fromToken", currentToToken)
    form.setValue("toChain", currentFromChain)
    form.setValue("toToken", currentFromToken)
  }

  const isSwapSupported = () => {
    return SUPPORTED_SWAP_PAIRS.some(pair => 
      pair.from.chain === fromChain && 
      pair.from.token === fromToken && 
      pair.to.chain === toChain && 
      pair.to.token === toToken
    )
  }

  const onSubmit = async (data: SwapFormData) => {
    if (!isSwapSupported()) {
      toast({
        title: "Unsupported Swap Pair",
        description: "This token pair is not currently supported for cross-chain swaps",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const maxBalance = getMaxBalance()
      if (Number(data.amount) > Number(maxBalance)) {
        toast({
          title: "Insufficient Balance",
          description: `You only have ${maxBalance} ${fromToken} available`,
          variant: "destructive"
        })
        return
      }

      setSwapProgress("Creating cross-chain swap...")

      const { clientSwapService } = await import('@/lib/client-swap-service');
      
      const swapRequest = {
        fromChain: data.fromChain,
        fromToken: data.fromToken,
        toChain: data.toChain,
        toToken: data.toToken,
        amount: data.amount,
        beneficiary: data.beneficiary,
        timelock: parseInt(data.timelock),
        slippage: 1,
        dryRun: data.dryRun
      }

      if (!data.dryRun) {
        setSwapProgress("Connecting to wallet...")
      }

      const result = await clientSwapService.createSwap(swapRequest)
      
      toast({
        title: "Swap Created Successfully",
        description: `Swap ID: ${result.id}`,
      })

      router.push(`/swap/${result.id}`)
      
    } catch (error) {
      console.error('Swap creation failed:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create swap",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
      setSwapProgress("")
    }
  }

  const supportedPair = SUPPORTED_SWAP_PAIRS.find(pair => 
    pair.from.chain === fromChain && 
    pair.from.token === fromToken && 
    pair.to.chain === toChain && 
    pair.to.token === toToken
  )

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 mb-12"
      >
        <h1 className="text-5xl font-bold">
          <span className="text-gradient">Swap Sage</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Secure cross-chain token swaps with atomic guarantees and gasless claims
        </p>
      </motion.div>

      {/* Stats Row */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
      >
        <Card className="hover-lift gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold">$2.4M</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Swaps</p>
                <p className="text-2xl font-bold">142</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">99.8%</p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Time</p>
                <p className="text-2xl font-bold">3.2 min</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Wallet Connection */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 space-y-6"
        >
          <Card className="glass-effect hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connect Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WalletConnect />
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle className="text-lg">Why Swap Sage?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Atomic Security</p>
                  <p className="text-sm text-muted-foreground">
                    Your funds are always safe with HTLC protection
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Gasless Claims</p>
                  <p className="text-sm text-muted-foreground">
                    Claim your tokens without paying gas fees
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Best Rates</p>
                  <p className="text-sm text-muted-foreground">
                    Optimized routing for minimal slippage
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Swap Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="glass-effect glow-effect">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Rocket className="h-6 w-6" />
                Cross-Chain Swap
              </CardTitle>
              <CardDescription>
                Swap tokens across different blockchains with atomic guarantees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="swap" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="swap">Swap</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="swap" className="space-y-6 mt-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      
                      {/* From Section */}
                      <div className="space-y-4 p-6 rounded-xl bg-muted/50">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">From</label>
                          <Badge variant="secondary" className="font-mono">
                            Balance: {getMaxBalance()} {fromToken}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="fromChain"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Object.entries(allChains).map(([key, chain]) => {
                                      const hasTokens = getTokensForChain(key).length > 0
                                      if (!hasTokens) return null
                                      
                                      return (
                                        <SelectItem key={key} value={key}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">
                                              {key === 'sepolia' ? '🔷' : 
                                               key === 'polygonAmoy' ? '🟣' : 
                                               key === 'monadTestnet' ? '🟡' : 
                                               key === 'etherlinkTestnet' ? '🐉' : '🔗'}
                                            </span>
                                            <span>{chain.name}</span>
                                          </div>
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="fromToken"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {availableTokens.from.map(token => (
                                      <SelectItem key={token.symbol} value={token.symbol}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{token.icon}</span>
                                          <span className="font-medium">{token.symbol}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.000001"
                                    placeholder="0.0"
                                    {...field}
                                    className="h-14 text-lg pr-20 font-mono"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="absolute right-2 top-1/2 -translate-y-1/2"
                                  onClick={setMaxAmount}
                                >
                                  MAX
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Swap Direction Button */}
                      <div className="flex justify-center -my-2 relative z-10">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={swapTokens}
                          className="rounded-full bg-background hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* To Section */}
                      <div className="space-y-4 p-6 rounded-xl bg-muted/50">
                        <label className="text-sm font-medium">To</label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="toChain"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Object.entries(allChains)
                                      .filter(([key]) => key !== fromChain)
                                      .map(([key, chain]) => {
                                        const hasTokens = getTokensForChain(key).length > 0
                                        if (!hasTokens) return null
                                        
                                        return (
                                          <SelectItem key={key} value={key}>
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">
                                                {key === 'sepolia' ? '🔷' : 
                                                 key === 'polygonAmoy' ? '🟣' : 
                                                 key === 'monadTestnet' ? '🟡' : 
                                                 key === 'etherlinkTestnet' ? '🐉' : '🔗'}
                                              </span>
                                              <span>{chain.name}</span>
                                            </div>
                                          </SelectItem>
                                        )
                                      })}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="toToken"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-12">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {availableTokens.to.map(token => (
                                      <SelectItem key={token.symbol} value={token.symbol}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{token.icon}</span>
                                          <span className="font-medium">{token.symbol}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Quote Display */}
                        {quote && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-background rounded-lg p-4 space-y-3 border"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">You'll receive</span>
                              <span className="font-bold text-lg">
                                {quote.targetAmount.toFixed(6)} {toToken}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rate</span>
                                <span>1:{quote.exchangeRate.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Network fee</span>
                                <span>{quote.fees.toFixed(6)} {fromToken}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Price impact</span>
                                <span className="text-green-600">{"<"}0.1%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Est. time</span>
                                <span>{quote.estimatedTime}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">You save</span>
                                <span className="text-green-600 font-medium">
                                  ${quote.savings.toFixed(2)} in gas
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {isLoadingQuote && (
                          <div className="flex items-center justify-center p-6">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Fetching best rate...</span>
                          </div>
                        )}
                      </div>

                      {/* Recipient Address */}
                      <FormField
                        control={form.control}
                        name="beneficiary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recipient Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="0x..."
                                {...field}
                                className="font-mono text-sm"
                              />
                            </FormControl>
                            <FormDescription>
                              {isConnected && address && field.value === address && (
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Using connected wallet
                                </span>
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Swap Status */}
                      {supportedPair ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Route Available</span>
                          </div>
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            {supportedPair.description}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        >
                          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-medium">Route Unavailable</span>
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            This token pair is not currently supported
                          </p>
                        </motion.div>
                      )}

                      {/* Progress Display */}
                      {isSubmitting && swapProgress && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                        >
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                              {swapProgress}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Submit Button */}
                      <Button 
                        type="submit" 
                        className="w-full h-14 text-lg gradient-primary" 
                        size="lg"
                        disabled={isSubmitting || !form.formState.isValid || !isSwapSupported()}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {swapProgress || "Processing..."}
                          </>
                        ) : (
                          <>
                            <ArrowRight className="mr-2 h-5 w-5" />
                            {form.watch("dryRun") ? "Preview Swap" : "Execute Swap"}
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Transaction Settings</h3>
                      
                      <FormField
                        control={form.control}
                        name="timelock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timelock Duration</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1800">30 minutes</SelectItem>
                                <SelectItem value="3600">1 hour</SelectItem>
                                <SelectItem value="7200">2 hours</SelectItem>
                                <SelectItem value="86400">24 hours</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Time before the swap expires and funds are refunded
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Mode</h3>
                      
                      <FormField
                        control={form.control}
                        name="dryRun"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Test Mode
                              </FormLabel>
                              <FormDescription>
                                Preview the swap without executing transactions
                              </FormDescription>
                            </div>
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Trust Indicators */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card className="hover-lift">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
              <Lock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold">Non-Custodial</p>
              <p className="text-sm text-muted-foreground">You control your funds</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold">Audited Smart Contracts</p>
              <p className="text-sm text-muted-foreground">Verified by security experts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
              <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-semibold">24/7 Support</p>
              <p className="text-sm text-muted-foreground">We're here to help</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}