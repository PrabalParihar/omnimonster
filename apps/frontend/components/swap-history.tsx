"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, ArrowRightLeft, ExternalLink, RefreshCw } from "lucide-react"

// Mock data for demonstration
const mockSwaps = [
  {
    id: "swap_1703123456_abc123",
    fromChain: "sepolia",
    toChain: "polygonAmoy",
    amount: "0.001",
    status: "completed" as const,
    createdAt: Date.now() - 3600000,
    srcTxHash: "0x1234567890abcdef1234567890abcdef12345678",
    dstTxHash: "0xabcdef1234567890abcdef1234567890abcdef12"
  },
  {
    id: "swap_1703120000_def456", 
    fromChain: "polygonAmoy",
    toChain: "sepolia",
    amount: "100",
    status: "claiming_src" as const,
    createdAt: Date.now() - 1800000,
    srcTxHash: "0x9876543210fedcba9876543210fedcba98765432",
    dstTxHash: null
  },
  {
    id: "swap_1703115000_ghi789",
    fromChain: "sepolia", 
    toChain: "cosmosTestnet",
    amount: "0.05",
    status: "failed" as const,
    createdAt: Date.now() - 7200000,
    srcTxHash: null,
    dstTxHash: null
  }
]

const statusConfig = {
  completed: { color: "bg-green-500", label: "Completed", icon: CheckCircle },
  claiming_src: { color: "bg-blue-500", label: "In Progress", icon: RefreshCw },
  failed: { color: "bg-red-500", label: "Failed", icon: XCircle },
  initiated: { color: "bg-yellow-500", label: "Initiated", icon: Clock },
}

const chainLabels = {
  sepolia: "Ethereum Sepolia",
  polygonAmoy: "Polygon Amoy", 
  cosmosTestnet: "Cosmos Testnet"
}

export function SwapHistory() {
  const [swaps, setSwaps] = React.useState(mockSwaps)
  const [loading, setLoading] = React.useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    // TODO: Fetch from API
    setTimeout(() => setLoading(false), 1000)
  }

  const getExplorerUrl = (chain: string, txHash: string) => {
    const explorers = {
      sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
      polygonAmoy: `https://amoy.polygonscan.com/tx/${txHash}`,
      cosmosTestnet: `https://explorer.cosmos.network/tx/${txHash}`
    }
    return explorers[chain as keyof typeof explorers]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Recent Swaps</h2>
          <p className="text-sm text-muted-foreground">
            Track your cross-chain atomic swap transactions
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {swaps.filter(s => s.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {swaps.filter(s => s.status.includes("claiming") || s.status.includes("creating")).length}
                </p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {swaps.filter(s => s.status === "failed").length}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{swaps.length}</p>
                <p className="text-xs text-muted-foreground">Total Swaps</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Swap List */}
      <div className="space-y-4">
        {swaps.map((swap) => {
          const config = statusConfig[swap.status as keyof typeof statusConfig]
          const StatusIcon = config?.icon || Clock

          return (
            <Card key={swap.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${config?.color || "bg-gray-500"}`} />
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">
                          {chainLabels[swap.fromChain as keyof typeof chainLabels]} → {chainLabels[swap.toChain as keyof typeof chainLabels]}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {config?.label || swap.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{swap.amount} tokens</span>
                        <span>•</span>
                        <span>{new Date(swap.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-mono text-xs">{swap.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {swap.srcTxHash && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getExplorerUrl(swap.fromChain, swap.srcTxHash!), '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {swap.dstTxHash && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getExplorerUrl(swap.toChain, swap.dstTxHash!), '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {swaps.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No swaps yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start your first cross-chain atomic swap to see it here
            </p>
            <Button className="mt-4" asChild>
              <a href="/swap">Create Swap</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 