"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  ArrowUpDown,
  ArrowRight,
  Rocket,
  ChevronDown,
  Search,
  X,
  Shield,
  Zap
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { getTokensForChain, SUPPORTED_SWAP_PAIRS, Token } from "@swap-sage/shared"
import { allChains, ChainConfig } from "@swap-sage/shared"

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
  timelock: z.string().default("3600")
})

type SwapFormData = z.infer<typeof swapFormSchema>


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
  const [showFromTokenSelector, setShowFromTokenSelector] = React.useState(false)
  const [showToTokenSelector, setShowToTokenSelector] = React.useState(false)
  const [isSwapAnimating, setIsSwapAnimating] = React.useState(false)

  const { address } = useWallet()
  const isConnected = !!address

  const form = useForm<SwapFormData>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: {
      fromChain: "sepolia",
      fromToken: "MONSTER",
      toChain: "monadTestnet", 
      toToken: "OMNIMONSTER",
      amount: "",
      beneficiary: address || "",
      timelock: "3600"
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
        dryRun: false
      }

      setSwapProgress("Connecting to wallet...")

      const result = await clientSwapService.createSwap(swapRequest)
      
      if (result.error) {
        toast({
          title: "Swap Creation Failed",
          description: result.error,
          variant: "destructive"
        })
        setSwapProgress("")
        return
      }
      
      toast({
        title: "Swap Created Successfully",
        description: result.transactionHash ? `Transaction: ${result.transactionHash.slice(0, 10)}...` : `Swap ID: ${result.id}`,
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
    <div className="w-full min-h-screen">
      {/* Main Swap Interface */}
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card className="glass-effect glow-effect border-2">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-center flex items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: isSwapAnimating ? 360 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Rocket className="h-6 w-6" />
                </motion.div>
                Swap Interface
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Left Column - Form */}
                <div className="space-y-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      
                      {/* From Section */}
                      <div className="space-y-4 p-6 rounded-xl bg-muted/50">
                        <label className="text-sm font-medium">From</label>
                        
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
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.000001"
                                  placeholder="Amount"
                                  {...field}
                                  className="h-14 text-lg font-mono"
                                />
                              </FormControl>
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
                            Execute Swap
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>

                {/* Right Column - Information */}
                <div className="space-y-6">
                  {/* Features */}
                  <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Why Choose Our Swaps?</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Atomic Security</p>
                          <p className="text-sm text-muted-foreground">Either both sides complete or both are refunded</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Fast Execution</p>
                          <p className="text-sm text-muted-foreground">Automated pool claims for quick completion</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Cross-Chain</p>
                          <p className="text-sm text-muted-foreground">Swap between different blockchain networks</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}