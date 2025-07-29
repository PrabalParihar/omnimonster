"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClientTimestamp } from "@/components/ui/client-timestamp"
import { ArrowRightLeft, ExternalLink, Clock } from "lucide-react"

interface SwapRecord {
  id: string
  fromChain: string
  toChain: string
  amount: string
  beneficiary: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

// Remove hardcoded data - will fetch from API

const getStatusColor = (status: SwapRecord['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'failed':
      return 'bg-red-500'
    case 'cancelled':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}

const getStatusText = (status: SwapRecord['status']) => {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'pending':
      return 'Pending'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Unknown'
  }
}

const getChainIcon = (chain: string) => {
  switch (chain) {
    case 'sepolia':
      return '🔷'
    case 'polygonAmoy':
      return '🟣'
    case 'cosmosTestnet':
      return '⚛️'
    default:
      return '🔗'
  }
}

export function SwapHistory() {
  const [swaps, setSwaps] = React.useState<SwapRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch swaps from API
  const fetchSwaps = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try API first
      const response = await fetch('/api/swaps')
      if (response.ok) {
        const data = await response.json()
        console.log('✓ Loaded swaps from Neon DB:', data.length)
        setSwaps(data)
      } else {
        // Fallback to localStorage
        console.warn('API failed, checking localStorage')
        const localSwaps = JSON.parse(localStorage.getItem('wallet-swaps') || '{}')
        const swapArray = Object.values(localSwaps) as SwapRecord[]
        console.log('✓ Loaded swaps from localStorage:', swapArray.length)
        setSwaps(swapArray.sort((a, b) => b.createdAt - a.createdAt))
      }
    } catch (err) {
      console.error('Failed to fetch swaps:', err)
      setError('Failed to load swap history')
      // Still try localStorage as final fallback
      try {
        const localSwaps = JSON.parse(localStorage.getItem('wallet-swaps') || '{}')
        const swapArray = Object.values(localSwaps) as SwapRecord[]
        setSwaps(swapArray.sort((a, b) => b.createdAt - a.createdAt))
      } catch (localError) {
        console.error('localStorage fallback also failed:', localError)
      }
    } finally {
      setLoading(false)
    }
  }

  // Load swaps on component mount
  React.useEffect(() => {
    fetchSwaps()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Swap History</h1>
          <p className="text-muted-foreground">
            View your past cross-chain atomic swaps
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchSwaps}
          disabled={loading}
        >
          <Clock className="mr-2 h-4 w-4" />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-2">⚠️ Error Loading History</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchSwaps} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading swap history...</p>
          </CardContent>
        </Card>
      )}

      {/* Swaps List */}
      {!loading && !error && (
        <div className="space-y-4">
          {swaps.map((swap) => (
          <Card key={swap.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* Swap Details */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getChainIcon(swap.fromChain)}</span>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg">{getChainIcon(swap.toChain)}</span>
                  </div>
                  
                  <div>
                    <p className="font-medium">{swap.amount}</p>
                    <p className="text-sm text-muted-foreground">
                      {swap.fromChain} → {swap.toChain}
                    </p>
                  </div>
                </div>

                {/* Status and Actions */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <Badge className={`${getStatusColor(swap.status)} text-white`}>
                      {getStatusText(swap.status)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      <ClientTimestamp timestamp={swap.createdAt} />
                    </p>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => window.location.href = `/swap/${swap.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Beneficiary */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Beneficiary: <span className="font-mono">{swap.beneficiary}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        
          {/* Empty State */}
          {swaps.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No swaps yet</h3>
                <p className="text-muted-foreground mb-4">
                  Your cross-chain atomic swaps will appear here
                </p>
                <Button onClick={() => window.location.href = '/swap'}>
                  Create Your First Swap
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
} 