"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Shield, 
  Database, 
  Globe, 
  FileContract, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Zap
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface HealthStatus {
  component: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  message: string
  details?: Record<string, any>
  lastChecked: string
  responseTime?: number
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical'
  components: HealthStatus[]
  summary: {
    healthy: number
    warning: number
    critical: number
    total: number
  }
}

export default function HealthPage() {
  const [health, setHealth] = React.useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)

  const checkSystemHealth = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Health check failed')
      }

      const data = await response.json()
      setHealth(data)
      setLastUpdate(new Date())
      
      toast({
        title: "Health Check Complete",
        description: `System status: ${data.overall}`,
      })
    } catch (error) {
      console.error('Health check error:', error)
      
      // Mock data for demonstration
      const mockHealth: SystemHealth = {
        overall: 'warning',
        components: [
          {
            component: 'Database',
            status: 'healthy',
            message: 'Connected to PostgreSQL',
            details: { host: 'localhost', port: 5432, latency: '2ms' },
            lastChecked: new Date().toISOString(),
            responseTime: 45
          },
          {
            component: 'API Endpoints',
            status: 'healthy',
            message: 'All endpoints responding',
            details: { endpoints: 15, responding: 15 },
            lastChecked: new Date().toISOString(),
            responseTime: 120
          },
          {
            component: 'Smart Contracts',
            status: 'warning',
            message: 'Some contracts need verification',
            details: { 
              sepolia: 'deployed', 
              polygonAmoy: 'deployed', 
              monadTestnet: 'verification pending' 
            },
            lastChecked: new Date().toISOString(),
            responseTime: 300
          },
          {
            component: 'Pool Liquidity',
            status: 'healthy',
            message: 'Adequate liquidity across all tokens',
            details: { totalTokens: 4, lowLiquidity: 0, criticalLiquidity: 0 },
            lastChecked: new Date().toISOString(),
            responseTime: 80
          },
          {
            component: 'Resolver Service',
            status: 'healthy',
            message: 'Processing swaps normally',
            details: { activeSwaps: 12, avgProcessingTime: '3.2s' },
            lastChecked: new Date().toISOString(),
            responseTime: 95
          }
        ],
        summary: {
          healthy: 4,
          warning: 1,
          critical: 0,
          total: 5
        }
      }
      setHealth(mockHealth)
      setLastUpdate(new Date())
      
      toast({
        title: "Using Mock Data",
        description: "Health check API unavailable, showing demo data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    checkSystemHealth()
    const interval = setInterval(checkSystemHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default'
      case 'warning':
        return 'secondary'
      case 'critical':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getComponentIcon = (component: string) => {
    switch (component.toLowerCase()) {
      case 'database':
        return <Database className="h-5 w-5" />
      case 'api endpoints':
        return <Globe className="h-5 w-5" />
      case 'smart contracts':
        return <FileContract className="h-5 w-5" />
      case 'pool liquidity':
        return <Zap className="h-5 w-5" />
      default:
        return <Shield className="h-5 w-5" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground">
              Monitor the health of all Fusion Swap components
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Button 
              onClick={checkSystemHealth} 
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getStatusIcon(health.overall)}
                <span>Overall System Status</span>
                <Badge variant={getStatusBadgeVariant(health.overall)}>
                  {health.overall.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                System-wide health summary across all components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{health.summary.healthy}</div>
                  <div className="text-sm text-muted-foreground">Healthy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{health.summary.warning}</div>
                  <div className="text-sm text-muted-foreground">Warning</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{health.summary.critical}</div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{health.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Component Health */}
        {health && (
          <div className="grid gap-4">
            <h2 className="text-xl font-semibold">Component Status</h2>
            {health.components.map((component, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {getComponentIcon(component.component)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{component.component}</h3>
                          {getStatusIcon(component.status)}
                          <Badge variant={getStatusBadgeVariant(component.status)}>
                            {component.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {component.message}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Response: {component.responseTime}ms</div>
                      <div>Checked: {new Date(component.lastChecked).toLocaleTimeString()}</div>
                    </div>
                  </div>

                  {component.details && (
                    <>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                        {Object.entries(component.details).map(([key, value]) => (
                          <div key={key}>
                            <div className="font-medium text-muted-foreground">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </div>
                            <div className="font-mono">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Loading State */}
        {!health && isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Checking system health...</p>
            </CardContent>
          </Card>
        )}

        {/* Health Check Info */}
        <Card>
          <CardHeader>
            <CardTitle>About Health Checks</CardTitle>
            <CardDescription>
              Understanding the health monitoring system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Automated Monitoring</h4>
                <p className="text-sm text-muted-foreground">
                  Health checks run automatically every 30 seconds to ensure system reliability and early issue detection.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Response Times</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor component response times to identify performance bottlenecks and optimization opportunities.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Status Levels</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>🟢 <strong>Healthy</strong>: Component operating normally</li>
                  <li>🟡 <strong>Warning</strong>: Minor issues or degraded performance</li>
                  <li>🔴 <strong>Critical</strong>: Component failure or major issues</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Components Monitored</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Database connectivity and performance</li>
                  <li>• API endpoint availability</li>
                  <li>• Smart contract deployment status</li>
                  <li>• Pool liquidity levels</li>
                  <li>• Resolver service health</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}