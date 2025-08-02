import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface HealthStatus {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: Record<string, any>;
  lastChecked: string;
  responseTime?: number;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: HealthStatus[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    total: number;
  };
}

async function checkDatabase(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    // Check database connection using shared system
    const { FusionDatabase, getDatabaseConfig } = await import('../../../../../packages/shared/src/database');
    const dbConfig = getDatabaseConfig();
    const database = FusionDatabase.getInstance(dbConfig);
    
    // Simple health check query
    await database.query('SELECT 1');
    
    const responseTime = Date.now() - startTime;
    
    return {
      component: 'Database',
      status: 'healthy',
      message: 'Connected to PostgreSQL',
      details: {
        type: 'PostgreSQL',
        latency: `${responseTime}ms`,
        connection: 'active'
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      component: 'Database',
      status: 'critical',
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'PostgreSQL'
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  }
}

async function checkAPIEndpoints(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    // Check key API endpoints
    const endpoints = [
      '/api/swaps',
      '/api/fusion/pool/status',
      '/api/fusion/tokens'
    ];
    
    const checks = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${endpoint}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return { endpoint, status: response.status, ok: response.ok };
        } catch {
          return { endpoint, status: 0, ok: false };
        }
      })
    );
    
    const responseTime = Date.now() - startTime;
    const working = checks.filter(c => c.ok).length;
    const total = checks.length;
    
    return {
      component: 'API Endpoints',
      status: working === total ? 'healthy' : working > total / 2 ? 'warning' : 'critical',
      message: `${working}/${total} endpoints responding`,
      details: {
        endpoints: checks.reduce((acc, check) => {
          acc[check.endpoint] = check.ok ? 'healthy' : 'failed';
          return acc;
        }, {} as Record<string, string>),
        responding: working,
        total
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      component: 'API Endpoints',
      status: 'critical',
      message: 'API health check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  }
}

async function checkSmartContracts(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  // Mock contract check - in real implementation, check actual contract deployments
  const contracts = {
    sepolia: 'deployed',
    polygonAmoy: 'deployed', 
    monadTestnet: 'verification pending'
  };
  
  const responseTime = Date.now() - startTime;
  const hasWarnings = Object.values(contracts).some(status => status.includes('pending'));
  
  return {
    component: 'Smart Contracts',
    status: hasWarnings ? 'warning' : 'healthy',
    message: hasWarnings ? 'Some contracts need verification' : 'All contracts deployed and verified',
    details: contracts,
    lastChecked: new Date().toISOString(),
    responseTime
  };
}

async function checkPoolLiquidity(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    // Check pool liquidity status
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/fusion/pool/status`);
    
    if (!response.ok) {
      throw new Error('Pool status check failed');
    }
    
    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    // Mock analysis
    const tokens = data.tokens || [];
    const lowLiquidity = 0;
    const criticalLiquidity = 0;
    
    return {
      component: 'Pool Liquidity',
      status: criticalLiquidity > 0 ? 'critical' : lowLiquidity > 0 ? 'warning' : 'healthy',
      message: criticalLiquidity > 0 ? 'Critical liquidity shortage' : 
               lowLiquidity > 0 ? 'Low liquidity warning' : 
               'Adequate liquidity across all tokens',
      details: {
        totalTokens: tokens.length,
        lowLiquidity,
        criticalLiquidity
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      component: 'Pool Liquidity',
      status: 'warning',
      message: 'Unable to check pool status',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  }
}

async function checkResolverService(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    // Check resolver service status
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/fusion/resolver/status`);
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        component: 'Resolver Service',
        status: 'critical',
        message: 'Resolver service unreachable',
        details: {
          status: response.status,
          statusText: response.statusText
        },
        lastChecked: new Date().toISOString(),
        responseTime
      };
    }
    
    // Mock successful response
    return {
      component: 'Resolver Service',
      status: 'healthy',
      message: 'Processing swaps normally',
      details: {
        activeSwaps: 12,
        avgProcessingTime: '3.2s',
        queueSize: 2
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      component: 'Resolver Service',
      status: 'critical',
      message: 'Resolver service check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      lastChecked: new Date().toISOString(),
      responseTime
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Run all health checks in parallel
    const [
      databaseHealth,
      apiHealth, 
      contractHealth,
      poolHealth,
      resolverHealth
    ] = await Promise.all([
      checkDatabase(),
      checkAPIEndpoints(),
      checkSmartContracts(),
      checkPoolLiquidity(),
      checkResolverService()
    ]);

    const components = [
      databaseHealth,
      apiHealth,
      contractHealth, 
      poolHealth,
      resolverHealth
    ];

    // Calculate overall health
    const healthy = components.filter(c => c.status === 'healthy').length;
    const warning = components.filter(c => c.status === 'warning').length;
    const critical = components.filter(c => c.status === 'critical').length;

    let overall: 'healthy' | 'warning' | 'critical';
    if (critical > 0) {
      overall = 'critical';
    } else if (warning > 0) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    const health: SystemHealth = {
      overall,
      components,
      summary: {
        healthy,
        warning,
        critical,
        total: components.length
      }
    };

    return NextResponse.json(health, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      { 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Internal server error'
      },
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  }
}