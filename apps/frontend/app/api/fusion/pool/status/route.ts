import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get pool status and liquidity information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get supported tokens
    const supportedTokens = await dao.getSupportedTokens(
      chainId ? parseInt(chainId) : undefined
    );

    // Get pool liquidity for each token
    const poolStatus = await Promise.all(
      supportedTokens.map(async (token) => {
        const liquidity = await dao.getPoolLiquidity(token.tokenAddress);
        
        return {
          token: {
            address: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            chainId: token.chainId,
            minSwapAmount: token.minSwapAmount,
            maxSwapAmount: token.maxSwapAmount,
            feePercentage: token.feePercentage
          },
          liquidity: liquidity ? {
            totalBalance: liquidity.totalBalance,
            availableBalance: liquidity.availableBalance,
            reservedBalance: liquidity.reservedBalance,
            minThreshold: liquidity.minThreshold,
            utilizationRate: liquidity.reservedBalance && liquidity.totalBalance 
              ? (BigInt(liquidity.reservedBalance) * BigInt(100) / BigInt(liquidity.totalBalance)).toString()
              : '0',
            healthStatus: liquidity.availableBalance && liquidity.minThreshold
              ? BigInt(liquidity.availableBalance) >= BigInt(liquidity.minThreshold) ? 'HEALTHY' : 'LOW'
              : 'UNKNOWN',
            lastUpdated: liquidity.updatedAt
          } : null
        };
      })
    );

    // Calculate overall pool statistics
    const totalTokens = supportedTokens.length;
    const healthyTokens = poolStatus.filter(p => p.liquidity?.healthStatus === 'HEALTHY').length;
    const lowLiquidityTokens = poolStatus.filter(p => p.liquidity?.healthStatus === 'LOW').length;
    
    const overallHealth = totalTokens > 0 
      ? Math.round((healthyTokens / totalTokens) * 100)
      : 0;

    // Get recent activity metrics
    const recentMetrics = await dao.query(`
      SELECT 
        COUNT(*) as total_swaps_24h,
        SUM(CASE WHEN status = 'USER_CLAIMED' THEN 1 ELSE 0 END) as completed_swaps_24h,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_swaps,
        AVG(CASE WHEN status = 'USER_CLAIMED' 
            THEN EXTRACT(EPOCH FROM (user_claimed_at - created_at)) 
            ELSE NULL END) as avg_completion_time
      FROM swap_requests 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const metrics = recentMetrics.rows[0];

    return NextResponse.json({
      tokens: poolStatus,
      summary: {
        totalTokens,
        healthyTokens,
        lowLiquidityTokens,
        overallHealthScore: overallHealth,
        metrics: {
          totalSwaps24h: parseInt(metrics?.total_swaps_24h || '0'),
          completedSwaps24h: parseInt(metrics?.completed_swaps_24h || '0'),
          pendingSwaps: parseInt(metrics?.pending_swaps || '0'),
          avgCompletionTime: parseFloat(metrics?.avg_completion_time || '0'),
          successRate: metrics?.total_swaps_24h > 0 
            ? Math.round((parseInt(metrics.completed_swaps_24h) / parseInt(metrics.total_swaps_24h)) * 100)
            : 0
        }
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching pool status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool status' },
      { status: 500, headers: corsHeaders }
    );
  }
}