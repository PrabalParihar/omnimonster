'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Wallet } from 'lucide-react'

interface SystemStatus {
  swaps: {
    total: number
    pending: number
    completed: number
    failed: number
  }
  gasBalances: {
    chain: string
    balance: string
    isLow: boolean
    address: string
  }[]
  recentErrors: {
    time: string
    message: string
    swapId?: string
  }[]
}

export default function MonitorPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/status')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      // Validate the response has expected structure
      if (!data.swaps || !data.gasBalances || !data.recentErrors) {
        throw new Error('Invalid response structure')
      }
      
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch status:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading && !status) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading system status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>Error loading system status: {error}</p>
            </div>
            <Button onClick={fetchStatus} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!status) {
    return null
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Monitor</h1>
        <Button onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Swap Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Swaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.swaps.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{status.swaps.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{status.swaps.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{status.swaps.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gas Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Pool Wallet Gas Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.gasBalances.map((gas) => (
              <div key={gas.chain} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{gas.chain}</div>
                  <div className="text-sm text-muted-foreground">{gas.address}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{gas.balance}</span>
                  {gas.isLow ? (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Low
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      OK
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Recent Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status.recentErrors.length === 0 ? (
            <p className="text-muted-foreground">No recent errors</p>
          ) : (
            <div className="space-y-2">
              {status.recentErrors.map((error, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{error.time}</span>
                    {error.swapId && (
                      <Badge variant="outline">Swap: {error.swapId.slice(0, 8)}...</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1">{error.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}