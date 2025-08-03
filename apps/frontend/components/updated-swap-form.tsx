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
import { Separator } from "@/components/ui/separator"
import { ArrowRightLeft, Loader2, AlertCircle, CheckCircle, Zap, Shield, Clock, ArrowUpDown } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { getTokensForChain, SUPPORTED_SWAP_PAIRS, Token } from "@swap-sage/shared"
import { allChains, ChainConfig } from "@swap-sage/shared"
import { WalletConnect } from "./wallet-connect"

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
  dryRun: z.boolean().default(false)
})

type SwapFormData = z.infer<typeof swapFormSchema>

// Mock balance data - in real app, this would come from wallet connection
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

export function UpdatedSwapForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [swapProgress, setSwapProgress] = React.useState<string>("")
  const [availableTokens, setAvailableTokens] = React.useState<{ from: Token[], to: Token[] }>({ from: [], to: [] })
  const [quote, setQuote] = React.useState<any>(null)
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false)

  // Wallet integration
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
      dryRun: false
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
    
    // Reset token selections if current selections are not available
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
      // Simulate API call for quote
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock quote calculation
      const sourceAmount = parseFloat(amount)
      const exchangeRate = fromToken === 'MONSTER' && toToken === 'OMNIMONSTER' ? 0.99 : 
                          fromToken === 'OMNIMONSTER' && toToken === 'MONSTER' ? 1.01 :
                          0.99 // Default rate for other pairs
      
      const targetAmount = sourceAmount * exchangeRate
      const fees = sourceAmount * 0.003 // 0.3% fee
      
      setQuote({
        sourceAmount,
        targetAmount: targetAmount - fees,
        exchangeRate,
        fees,
        priceImpact: 0.1,
        estimatedTime: '2-5 minutes',
        route: `${fromChain} → ${toChain}`
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
    console.log('Checking swap support:', { fromChain, fromToken, toChain, toToken });
    console.log('Available pairs:', SUPPORTED_SWAP_PAIRS);
    
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
      // Validate amount doesn't exceed balance
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

      // Import the client swap service
      const { clientSwapService } = await import('@/lib/client-swap-service');
      
      // Create swap request
      const swapRequest = {
        fromChain: data.fromChain,
        fromToken: data.fromToken,
        toChain: data.toChain,
        toToken: data.toToken,
        amount: data.amount,
        beneficiary: data.beneficiary,
        timelock: parseInt(data.timelock),
        slippage: 1, // Default slippage
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

      // Redirect to swap status page
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Wallet Connection */}
        <div className="md:col-span-1">
          <WalletConnect />
        </div>

        {/* Swap Form */}
        <div className="md:col-span-2">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-6 w-6" />
            <span>Cross-Chain Token Swap</span>
          </CardTitle>
          <CardDescription>
            Swap your Monster tokens for Omni tokens and vice versa across different blockchains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* From Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">From</label>
                  <Badge variant="outline">
                    Balance: {getMaxBalance()} {fromToken}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fromChain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chain</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(allChains).map(([key, chain]) => {
                              const hasTokens = getTokensForChain(key).length > 0
                              if (!hasTokens) return null
                              
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center space-x-2">
                                    <span>
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
                        <FormLabel>Token</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTokens.from.map(token => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                <div className="flex items-center space-x-2">
                                  <span>{token.icon}</span>
                                  <span>{token.symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {token.name}
                                  </span>
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
                            className="pr-16"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
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
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={swapTokens}
                  className="rounded-full p-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-4">
                <label className="text-sm font-medium">To</label>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="toChain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chain</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(allChains)
                              .filter(([key]) => key !== fromChain) // Exclude source chain
                              .map(([key, chain]) => {
                                const hasTokens = getTokensForChain(key).length > 0
                                if (!hasTokens) return null
                                
                                return (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center space-x-2">
                                      <span>
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
                        <FormLabel>Token</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTokens.to.map(token => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                <div className="flex items-center space-x-2">
                                  <span>{token.icon}</span>
                                  <span>{token.symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {token.name}
                                  </span>
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
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>You'll receive:</span>
                      <span className="font-semibold">
                        {quote.targetAmount.toFixed(6)} {toToken}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Exchange rate:</span>
                      <span>1 {fromToken} = {quote.exchangeRate.toFixed(4)} {toToken}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Network fees:</span>
                      <span>{quote.fees.toFixed(6)} {fromToken}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Estimated time:</span>
                      <span>{quote.estimatedTime}</span>
                    </div>
                  </div>
                )}

                {isLoadingQuote && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Getting quote...</span>
                  </div>
                )}
              </div>

              {/* Beneficiary Address */}
              <FormField
                control={form.control}
                name="beneficiary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Address to receive tokens on the destination chain
                      {isConnected && address && field.value === address && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          (Using connected wallet)
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dry run mode removed - now always executes real transactions */}

              {/* Swap Pair Status */}
              {supportedPair ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Supported Swap Pair</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    {supportedPair.description}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Unsupported Swap Pair</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    This token combination is not currently supported for cross-chain swaps
                  </p>
                </div>
              )}

              {/* Progress Display */}
              {isSubmitting && swapProgress && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {swapProgress}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || !form.formState.isValid || !isSwapSupported()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {swapProgress || "Creating Swap..."}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Execute Cross-Chain Swap
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Shield className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium">Atomic Security</p>
              <p className="text-xs text-muted-foreground">Guaranteed execution or full refund</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Time Locked</p>
              <p className="text-xs text-muted-foreground">Automatic refund protection</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">Gasless Claims</p>
              <p className="text-xs text-muted-foreground">No gas fees for claiming</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}