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
import { Slider } from "@/components/ui/slider"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowRightLeft, Settings, Clock, Shield, Zap, Wallet, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { WalletDrawer } from "@/components/wallet-drawer"
import { WalletAtomicOrchestrator } from "@/lib/wallet-atomic-orchestrator"
import { useWalletClient } from 'wagmi'
import { keplrWallet } from "@/lib/keplr"
import { allChains, ChainConfig } from "../../../packages/shared/src/chains"

// Form validation schema
const swapFormSchema = z.object({
  fromChain: z.string().min(1, "Source chain is required"),
  toChain: z.string().min(1, "Destination chain is required"),
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number"
  }),
  beneficiary: z.string().min(1, "Beneficiary address is required"),
  slippage: z.number().min(0.1).max(50),
  timelock: z.string(),
  dryRun: z.boolean()
})

type SwapFormData = z.infer<typeof swapFormSchema>

// Mock balance data - in real app, this would come from wallet connection
const mockBalances = {
  sepolia: "0.5",
  polygonAmoy: "1000",
  monadTestnet: "2.5",
  cosmosTestnet: "50"
}

export function SwapForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [maxBalance, setMaxBalance] = React.useState("0")
  const [swapProgress, setSwapProgress] = React.useState<string>("")
  
  // Wallet integration
  const { 
    evmConnected,
    cosmosConnected,
    evmAddress,
    cosmosAddress
  } = useWallet()
  
  // Get wallet signers
  const { data: evmSigner } = useWalletClient()
  
  // Create orchestrator instance
  const orchestrator = React.useMemo(() => new WalletAtomicOrchestrator(), [])
  
  // Listen to swap progress events
  React.useEffect(() => {
    const handleProgress = (progress: any) => {
      setSwapProgress(`${progress.step}: ${progress.message || ''}`)
    }
    
    orchestrator.on('progress', handleProgress)
    
    return () => {
      orchestrator.off('progress', handleProgress)
    }
  }, [orchestrator])
  
  // Function to get Cosmos signer
  const getCosmosSigner = async () => {
    if (!cosmosConnected) return null
    try {
      const keplr = await keplrWallet.connect()
      return keplr // This should be the DirectSecp256k1HdWallet equivalent
    } catch (error) {
      console.error('Failed to get Cosmos signer:', error)
      return null
    }
  }
  
  const isConnected = evmConnected || cosmosConnected
  const address = evmAddress || cosmosAddress
  const isWrongNetwork = false // For now, since we're not implementing full chain validation

  const form = useForm<SwapFormData>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: {
      fromChain: "sepolia",
      toChain: "polygonAmoy",
      amount: "",
      beneficiary: address || "",
      slippage: 1,
      timelock: "3600",
      dryRun: true
    }
  })

  const fromChain = form.watch("fromChain")
  const amount = form.watch("amount")

  const chains = React.useMemo(() => {
    const chainEntries = Object.entries(allChains) as Array<[string, ChainConfig]>
    return chainEntries.map(([key, chain]) => ({
      value: key,
      label: chain.name,
      icon: key === 'sepolia' ? '🔷' : 
            key === 'polygonAmoy' ? '🟣' : 
            key === 'monadTestnet' ? '🟡' :
            key === 'cosmosTestnet' ? '⚛️' : '🔗',
      balance: mockBalances[key as keyof typeof mockBalances] || '0'
    }))
  }, [])

  // Update max balance when source chain changes
  React.useEffect(() => {
    const selectedChain = chains.find(chain => chain.value === fromChain)
    if (selectedChain) {
      setMaxBalance(selectedChain.balance)
    }
  }, [fromChain, chains])

  // Update beneficiary when wallet address changes
  React.useEffect(() => {
    if (address && address !== form.getValues("beneficiary")) {
      form.setValue("beneficiary", address)
    }
  }, [address, form])

  // Set max amount
  const setMaxAmount = () => {
    form.setValue("amount", maxBalance)
  }

  const onSubmit = async (data: SwapFormData) => {
    setIsSubmitting(true)
    
    try {
      // Validate amount doesn't exceed balance
      if (Number(data.amount) > Number(maxBalance)) {
        toast({
          title: "Insufficient Balance",
          description: `You only have ${maxBalance} tokens available`,
          variant: "destructive"
        })
        return
      }

      // For real swaps, validate wallet connections
      if (!data.dryRun) {
        const needsEvm = data.fromChain === 'sepolia' || data.fromChain === 'polygonAmoy' || data.fromChain === 'monadTestnet' || 
                         data.toChain === 'sepolia' || data.toChain === 'polygonAmoy' || data.toChain === 'monadTestnet'
        const needsCosmos = data.fromChain === 'cosmosTestnet' || data.toChain === 'cosmosTestnet'
        
        if (needsEvm && !evmConnected) {
          toast({
            title: "EVM Wallet Required",
            description: "Please connect your MetaMask or other EVM wallet first",
            variant: "destructive"
          })
          return
        }
        
        if (needsCosmos && !cosmosConnected) {
          toast({
            title: "Cosmos Wallet Required", 
            description: "Please connect your Keplr wallet first",
            variant: "destructive"
          })
          return
        }
        
        // Additional check for window.ethereum
        if (needsEvm && typeof window !== 'undefined' && !window.ethereum) {
          toast({
            title: "No Ethereum Wallet Detected",
            description: "Please install MetaMask or another Ethereum wallet",
            variant: "destructive"
          })
          return
        }
      }

      // Get wallet signers for real swaps
      let cosmosSigner = null
      if (!data.dryRun) {
        cosmosSigner = await getCosmosSigner()
      }

      // Execute swap with wallet orchestrator
      setSwapProgress("Initializing atomic swap...")
      
      const result = await orchestrator.createSwap(
        {
          fromChain: data.fromChain,
          toChain: data.toChain,
          amount: data.amount,
          beneficiary: data.beneficiary,
          timelock: parseInt(data.timelock),
          slippage: data.slippage,
          dryRun: data.dryRun
        },
        {
          evmSigner: evmSigner,
          cosmosSigner: cosmosSigner
        }
      )
      
      toast({
        title: "Swap Created",
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

  return (
    <div className="space-y-6">
      {/* Wallet Connection Warning */}
      {!isConnected && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex items-center space-x-3 p-4">
            <Wallet className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Wallet Not Connected
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Connect your wallet to auto-fill addresses and check balances
              </p>
            </div>
            <WalletDrawer>
              <Button variant="outline" size="sm">
                Connect Wallet
              </Button>
            </WalletDrawer>
          </CardContent>
        </Card>
      )}

      {/* Wrong Network Warning */}
      {isConnected && isWrongNetwork && (
        <Card className="border-destructive">
          <CardContent className="flex items-center space-x-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Unsupported Network
              </p>
              <p className="text-xs text-muted-foreground">
                Please switch to a supported network to continue
              </p>
            </div>
            <WalletDrawer>
              <Button variant="outline" size="sm">
                Switch Network
              </Button>
            </WalletDrawer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Swap Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your cross-chain atomic swap with precise parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Chain Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fromChain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Chain</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source chain" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {chains.map(chain => (
                            <SelectItem key={chain.value} value={chain.value}>
                              <div className="flex items-center space-x-2">
                                <span>{chain.icon}</span>
                                <span>{chain.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({chain.balance})
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

                <FormField
                  control={form.control}
                  name="toChain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Chain</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination chain" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {chains.filter(chain => chain.value !== fromChain).map(chain => (
                            <SelectItem key={chain.value} value={chain.value}>
                              <div className="flex items-center space-x-2">
                                <span>{chain.icon}</span>
                                <span>{chain.label}</span>
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

              {/* Amount with Max Balance */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          placeholder="0.001"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                        onClick={setMaxAmount}
                      >
                        MAX
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Available: {maxBalance}</span>
                      {Number(amount) > Number(maxBalance) && (
                        <span className="text-destructive flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Insufficient balance
                        </span>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Beneficiary */}
              <FormField
                control={form.control}
                name="beneficiary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beneficiary Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Address to receive funds on the destination chain
                      {isConnected && address && field.value === address && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          (Auto-filled from wallet)
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced Options Accordion */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Advanced Options</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Slippage Slider */}
                      <FormField
                        control={form.control}
                        name="slippage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slippage Tolerance: {field.value}%</FormLabel>
                            <FormControl>
                              <Slider
                                min={0.1}
                                max={50}
                                step={0.1}
                                value={[field.value]}
                                onValueChange={([value]) => field.onChange(value)}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum acceptable price deviation
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Timelock */}
                        <FormField
                          control={form.control}
                          name="timelock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Timelock (seconds)</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="3600">1 hour (3600s)</SelectItem>
                                  <SelectItem value="7200">2 hours (7200s)</SelectItem>
                                  <SelectItem value="14400">4 hours (14400s)</SelectItem>
                                  <SelectItem value="86400">24 hours (86400s)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Dry Run Toggle */}
                        <FormField
                          control={form.control}
                          name="dryRun"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Dry Run (Simulation)
                                </FormLabel>
                                <FormDescription>
                                  Test the swap without executing transactions
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

                      {/* Wallet Connection Status */}
                      {!form.watch("dryRun") && (
                        <div className="space-y-4 border-t pt-4">
                          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                            <Wallet className="h-4 w-4" />
                            <span className="text-sm font-medium">Wallet Connection Required</span>
                          </div>
                          
                          {/* EVM Wallet Status */}
                          {(form.watch("fromChain") === 'sepolia' || form.watch("fromChain") === 'polygonAmoy' || form.watch("fromChain") === 'monadTestnet' || 
                            form.watch("toChain") === 'sepolia' || form.watch("toChain") === 'polygonAmoy' || form.watch("toChain") === 'monadTestnet') && (
                            <div className="p-3 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">EVM Wallet (MetaMask)</p>
                                  <p className="text-xs text-muted-foreground">
                                    {evmConnected ? `Connected: ${evmAddress?.slice(0, 6)}...${evmAddress?.slice(-4)}` : 'Not connected'}
                                  </p>
                                </div>
                                <div className={`h-3 w-3 rounded-full ${evmConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                              </div>
                            </div>
                          )}

                          {/* Cosmos Wallet Status */}
                          {(form.watch("fromChain") === 'cosmosTestnet' || form.watch("toChain") === 'cosmosTestnet') && (
                            <div className="p-3 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">Cosmos Wallet (Keplr)</p>
                                  <p className="text-xs text-muted-foreground">
                                    {cosmosConnected ? `Connected: ${cosmosAddress?.slice(0, 6)}...${cosmosAddress?.slice(-4)}` : 'Not connected'}
                                  </p>
                                </div>
                                <div className={`h-3 w-3 rounded-full ${cosmosConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                              </div>
                            </div>
                          )}

                          {(!evmConnected || !cosmosConnected) && (
                            <div className="text-sm text-amber-600 dark:text-amber-400">
                              💡 Please connect your wallets before executing real swaps
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

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
                disabled={isSubmitting || !form.formState.isValid}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {swapProgress || "Creating Swap..."}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {form.watch("dryRun") ? "Simulate Swap" : "Execute Real Swap"}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Shield className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium">Atomic Security</p>
              <p className="text-xs text-muted-foreground">Either both parties get funds or both get refunds</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Time Locked</p>
              <p className="text-xs text-muted-foreground">Automatic refund if swap expires</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">No Fees</p>
              <p className="text-xs text-muted-foreground">Only blockchain gas costs</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 