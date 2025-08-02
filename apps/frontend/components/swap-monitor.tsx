"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  Filter,
  Eye,
  TrendingUp,
  Users,
  Zap,
  Timer,
  Target
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface SwapRecord {
  id: string
  user_address: string
  source_token: string
  target_token: string
  source_amount: string
  target_amount: string
  status: 'PENDING' | 'POOL_FULFILLED' | 'USER_CLAIMED' | 'EXPIRED' | 'FAILED'
  created_at: string
  updated_at: string
  network: string
  timelock_seconds: number
  gas_estimate?: string
  completion_time?: number
}

interface MonitoringMetrics {
  totalSwaps24h: number
  successfulSwaps24h: number
  activeSwaps: number
  averageCompletionTime: number
  totalVolume24h: string
  uniqueUsers24h: number
}

export function SwapMonitor() {
  const [swaps, setSwaps] = React.useState<SwapRecord[]>([])
  const [metrics, setMetrics] = React.useState<MonitoringMetrics | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true)
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [userFilter, setUserFilter] = React.useState('')
  const [networkFilter, setNetworkFilter] = React.useState('all')

  const fetchSwaps = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (userFilter) params.append('userAddress', userFilter)
      if (networkFilter !== 'all') params.append('network', networkFilter)

      const response = await fetch(`/api/swaps?${params}`)
      if (!response.ok) throw new Error('Failed to fetch swaps')
      
      const data = await response.json()
      setSwaps(data.swaps || [])
      
      // Fetch metrics
      const metricsResponse = await fetch('/api/swaps/metrics')
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData)
      }
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching swaps:', error)
      
      // Mock data for demonstration
      const mockSwaps: SwapRecord[] = Array.from({ length: 15 }, (_, i) => ({
        id: `swap_${Date.now()}_${i}`,
        user_address: `0x${Math.random().toString(16).substr(2, 40)}`,
        source_token: ['USDC', 'USDT', 'ETH', 'MATIC'][Math.floor(Math.random() * 4)],
        target_token: ['USDC', 'USDT', 'ETH', 'MATIC'][Math.floor(Math.random() * 4)],
        source_amount: (Math.random() * 1000).toFixed(2),
        target_amount: (Math.random() * 1000).toFixed(2),
        status: ['PENDING', 'POOL_FULFILLED', 'USER_CLAIMED', 'EXPIRED', 'FAILED'][Math.floor(Math.random() * 5)] as any,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        network: ['sepolia', 'polygonAmoy', 'monadTestnet'][Math.floor(Math.random() * 3)],
        timelock_seconds: 3600,
        gas_estimate: (Math.random() * 0.01).toFixed(6),
        completion_time: Math.random() * 300
      }))
      
      const mockMetrics: MonitoringMetrics = {
        totalSwaps24h: 234,
        successfulSwaps24h: 221,
        activeSwaps: 12,
        averageCompletionTime: 45.2,
        totalVolume24h: '125,432.50',
        uniqueUsers24h: 89
      }
      
      setSwaps(mockSwaps)
      setMetrics(mockMetrics)
      setLastUpdate(new Date())
      
      toast({
        title: "Using Mock Data",
        description: "Swap monitoring API unavailable, showing demo data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, userFilter, networkFilter])

  // Auto-refresh setup
  React.useEffect(() => {
    fetchSwaps()
    
    if (isAutoRefresh) {
      const interval = setInterval(fetchSwaps, 10000) // 10 seconds
      return () => clearInterval(interval)
    }
  }, [fetchSwaps, isAutoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100'
      case 'POOL_FULFILLED': return 'text-blue-600 bg-blue-100'
      case 'USER_CLAIMED': return 'text-green-600 bg-green-100'
      case 'EXPIRED': return 'text-orange-600 bg-orange-100'
      case 'FAILED': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTimeAgo = (timestamp: string) => {
    const now = Date.now()
    const time = new Date(timestamp).getTime()
    const diff = now - time
    
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getNetworkIcon = (network: string) => {
    switch (network) {
      case 'sepolia': return '🔷'
      case 'polygonAmoy': return '🟣'
      case 'monadTestnet': return '🟡'
      default: return '🔗'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Swap Monitor</h1>
            <p className="text-muted-foreground">
              Real-time monitoring of swap activities and system performance
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant={isAutoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {isAutoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button 
              onClick={fetchSwaps} 
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">24h Swaps</p>
                    <p className="text-xl font-bold">{metrics.totalSwaps24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Successful</p>
                    <p className="text-xl font-bold">{metrics.successfulSwaps24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-xl font-bold">{metrics.activeSwaps}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Timer className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Time</p>
                    <p className="text-xl font-bold">{metrics.averageCompletionTime.toFixed(1)}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">24h Volume</p>
                    <p className="text-xl font-bold">${metrics.totalVolume24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Users</p>
                    <p className="text-xl font-bold">{metrics.uniqueUsers24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="POOL_FULFILLED">Pool Fulfilled</SelectItem>
                    <SelectItem value="USER_CLAIMED">User Claimed</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Network</label>
                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="sepolia">Sepolia</SelectItem>
                    <SelectItem value="polygonAmoy">Polygon Amoy</SelectItem>
                    <SelectItem value="monadTestnet">Monad Testnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">User Address</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="0x..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatusFilter('all')
                    setNetworkFilter('all')
                    setUserFilter('')
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Swap Records */}
        <Card>
          <CardHeader>
            <CardTitle>Active Swaps ({swaps.length})</CardTitle>
            <CardDescription>
              Real-time view of swap activities across all networks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {swaps.length > 0 ? (
              <div className="space-y-4">
                {swaps.map((swap) => (
                  <div key={swap.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="font-mono text-sm">
                          {swap.id.substring(0, 12)}...
                        </div>
                        <Badge className={getStatusColor(swap.status)}>
                          {swap.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm">
                          {getNetworkIcon(swap.network)} {swap.network}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getTimeAgo(swap.created_at)}
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">User:</span>
                        <div className="font-mono">{formatAddress(swap.user_address)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">From/To:</span>
                        <div>{swap.source_token} → {swap.target_token}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <div>{parseFloat(swap.source_amount).toFixed(2)} {swap.source_token}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timelock:</span>
                        <div>{swap.timelock_seconds / 3600}h</div>
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    {swap.status === 'PENDING' && (
                      <div className="flex items-center space-x-2 text-yellow-600">
                        <Clock className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Waiting for pool fulfillment...</span>
                      </div>
                    )}
                    {swap.status === 'POOL_FULFILLED' && (
                      <div className="flex items-center space-x-2 text-blue-600">
                        <Zap className="h-4 w-4" />
                        <span className="text-sm">Ready for gasless claim</span>
                      </div>
                    )}
                    {swap.status === 'USER_CLAIMED' && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">
                          Completed in {swap.completion_time?.toFixed(1)}s
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No swaps found matching your filters</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}