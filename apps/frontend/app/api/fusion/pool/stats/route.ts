import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get pool statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 7d, 30d

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Calculate time boundaries
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get total liquidity across all tokens
    const liquidityQuery = await dao.query(`
      SELECT 
        SUM(CAST(total_balance AS DECIMAL)) as total_liquidity,
        SUM(CAST(available_balance AS DECIMAL)) as available_liquidity,
        SUM(CAST(reserved_balance AS DECIMAL)) as reserved_liquidity,
        COUNT(*) as token_count
      FROM pool_liquidity
    `);

    const liquidityStats = liquidityQuery.rows[0];

    // Get swap statistics for the timeframe
    const swapStatsQuery = await dao.query(`
      SELECT 
        COUNT(*) as total_swaps,
        COUNT(CASE WHEN status = 'USER_CLAIMED' THEN 1 END) as completed_swaps,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as active_swaps,
        SUM(CASE WHEN status = 'USER_CLAIMED' THEN CAST(source_amount AS DECIMAL) ELSE 0 END) as total_volume,
        AVG(CASE WHEN user_claimed_at IS NOT NULL AND pool_claimed_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (user_claimed_at - pool_claimed_at)) 
          ELSE NULL END) as avg_processing_time
      FROM swap_requests 
      WHERE created_at >= $1
    `, [startTime.toISOString()]);

    const swapStats = swapStatsQuery.rows[0];

    // Calculate success rate
    const totalSwapsCount = parseInt(swapStats.total_swaps || '0');
    const completedSwapsCount = parseInt(swapStats.completed_swaps || '0');
    const successRate = totalSwapsCount > 0 ? (completedSwapsCount / totalSwapsCount) * 100 : 0;

    // Get gas savings estimate (simplified calculation)
    const avgGasCost = ethers.parseEther('0.005'); // ~$5 per transaction
    const totalGasSaved = BigInt(completedSwapsCount) * avgGasCost;

    // Get top performing tokens by volume
    const topTokensQuery = await dao.query(`
      SELECT 
        sr.target_token,
        st.symbol,
        st.name,
        COUNT(*) as swap_count,
        SUM(CAST(sr.expected_amount AS DECIMAL)) as total_volume
      FROM swap_requests sr
      JOIN supported_tokens st ON sr.target_token = st.token_address
      WHERE sr.created_at >= $1 AND sr.status = 'USER_CLAIMED'
      GROUP BY sr.target_token, st.symbol, st.name
      ORDER BY total_volume DESC
      LIMIT 5
    `, [startTime.toISOString()]);

    // Get recent pool operations
    const recentOperationsQuery = await dao.query(`
      SELECT 
        po.*,
        st.symbol,
        sr.user_address
      FROM pool_operations po
      JOIN supported_tokens st ON po.token_address = st.token_address
      LEFT JOIN swap_requests sr ON po.swap_request_id = sr.id
      ORDER BY po.created_at DESC
      LIMIT 10
    `);

    // Get resolver health metrics
    const resolverStatsQuery = await dao.query(`
      SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful_operations,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_operations,
        AVG(CASE WHEN completed_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completed_at - started_at)) 
          ELSE NULL END) as avg_processing_time
      FROM resolver_operations 
      WHERE started_at >= $1
    `, [startTime.toISOString()]);

    const resolverStats = resolverStatsQuery.rows[0];

    return NextResponse.json({
      timeframe,
      timestamp: now.toISOString(),
      liquidity: {
        totalLiquidity: liquidityStats.total_liquidity || '0',
        availableLiquidity: liquidityStats.available_liquidity || '0',
        reservedLiquidity: liquidityStats.reserved_liquidity || '0',
        tokenCount: parseInt(liquidityStats.token_count || '0'),
        utilizationRate: liquidityStats.total_liquidity ? 
          (parseFloat(liquidityStats.reserved_liquidity) / parseFloat(liquidityStats.total_liquidity)) * 100 : 0
      },
      swaps: {
        totalSwaps24h: totalSwapsCount,
        completedSwaps: completedSwapsCount,
        activeSwaps: parseInt(swapStats.active_swaps || '0'),
        successRate: successRate,
        avgProcessingTime: parseFloat(swapStats.avg_processing_time || '0'),
        totalVolume24h: swapStats.total_volume || '0'
      },
      gasless: {
        totalGasSaved: totalGasSaved.toString(),
        claimsProcessed: completedSwapsCount,
        avgSavingsPerClaim: avgGasCost.toString()
      },
      topTokens: topTokensQuery.rows,
      recentOperations: recentOperationsQuery.rows,
      resolver: {
        isHealthy: true, // Simplified - in production, check actual health
        totalOperations: parseInt(resolverStats.total_operations || '0'),
        successfulOperations: parseInt(resolverStats.successful_operations || '0'),
        failedOperations: parseInt(resolverStats.failed_operations || '0'),
        avgProcessingTime: parseFloat(resolverStats.avg_processing_time || '0'),
        successRate: resolverStats.total_operations ? 
          (parseInt(resolverStats.successful_operations) / parseInt(resolverStats.total_operations)) * 100 : 0
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching pool stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool statistics' },
      { status: 500, headers: corsHeaders }
    );
  }
}