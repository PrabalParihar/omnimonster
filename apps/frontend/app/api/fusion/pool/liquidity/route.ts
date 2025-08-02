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

// Get liquidity for all tokens
export async function GET(request: NextRequest) {
  try {
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get all token liquidity with token information
    const liquidityQuery = await dao.query(`
      SELECT 
        pl.*,
        st.symbol,
        st.name,
        st.decimals,
        st.chain_id,
        st.min_swap_amount,
        st.max_swap_amount,
        st.fee_percentage
      FROM pool_liquidity pl
      JOIN supported_tokens st ON pl.token_address = st.token_address
      ORDER BY pl.total_balance DESC
    `);

    // Calculate metrics for each token
    const tokens = liquidityQuery.rows.map(row => {
      const totalBalance = BigInt(row.total_balance);
      const availableBalance = BigInt(row.available_balance);
      const reservedBalance = BigInt(row.reserved_balance);
      const minThreshold = BigInt(row.min_threshold);

      // Calculate utilization rate
      const utilizationRate = totalBalance > 0n 
        ? Number((reservedBalance * 100n) / totalBalance)
        : 0;

      // Determine if rebalance is recommended
      const rebalanceRecommended = availableBalance < minThreshold || utilizationRate > 80;

      // Calculate health status
      let healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
      if (availableBalance < minThreshold) {
        healthStatus = 'CRITICAL';
      } else if (utilizationRate > 60) {
        healthStatus = 'WARNING';
      } else {
        healthStatus = 'HEALTHY';
      }

      return {
        address: row.token_address,
        symbol: row.symbol,
        name: row.name,
        decimals: row.decimals,
        chainId: row.chain_id,
        totalBalance: row.total_balance,
        availableBalance: row.available_balance,
        reservedBalance: row.reserved_balance,
        minThreshold: row.min_threshold,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        healthStatus,
        rebalanceRecommended,
        lastRebalance: row.last_rebalance,
        updatedAt: row.updated_at,
        swapLimits: {
          minSwapAmount: row.min_swap_amount,
          maxSwapAmount: row.max_swap_amount,
          feePercentage: row.fee_percentage
        }
      };
    });

    // Calculate overall pool statistics
    const totalLiquidity = tokens.reduce((sum, token) => {
      return sum + parseFloat(token.totalBalance);
    }, 0);

    const totalAvailable = tokens.reduce((sum, token) => {
      return sum + parseFloat(token.availableBalance);
    }, 0);

    const totalReserved = tokens.reduce((sum, token) => {
      return sum + parseFloat(token.reservedBalance);
    }, 0);

    const overallUtilization = totalLiquidity > 0 ? (totalReserved / totalLiquidity) * 100 : 0;

    // Count tokens by health status
    const healthCounts = tokens.reduce((counts, token) => {
      counts[token.healthStatus] = (counts[token.healthStatus] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return NextResponse.json({
      tokens,
      summary: {
        totalTokens: tokens.length,
        totalLiquidity: totalLiquidity.toString(),
        totalAvailable: totalAvailable.toString(),
        totalReserved: totalReserved.toString(),
        overallUtilization: Math.round(overallUtilization * 100) / 100,
        healthCounts: {
          healthy: healthCounts.HEALTHY || 0,
          warning: healthCounts.WARNING || 0,
          critical: healthCounts.CRITICAL || 0
        },
        tokensNeedingRebalance: tokens.filter(t => t.rebalanceRecommended).length
      },
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching pool liquidity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool liquidity' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Add pool liquidity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddress, totalBalance, availableBalance, reservedBalance, minThreshold } = body;

    if (!tokenAddress || !totalBalance || !availableBalance) {
      return NextResponse.json(
        { error: 'Missing required fields: tokenAddress, totalBalance, availableBalance' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Insert or update pool liquidity
    const result = await dao.query(`
      INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (token_address) 
      DO UPDATE SET
        total_balance = EXCLUDED.total_balance,
        available_balance = EXCLUDED.available_balance,
        reserved_balance = EXCLUDED.reserved_balance,
        min_threshold = EXCLUDED.min_threshold,
        updated_at = NOW()
      RETURNING *
    `, [
      tokenAddress,
      totalBalance,
      availableBalance || '0',
      reservedBalance || '0',
      minThreshold || '0'
    ]);

    console.log(`✅ Pool liquidity added/updated for ${tokenAddress}:`, result.rows[0]);

    return NextResponse.json({
      message: 'Pool liquidity added successfully',
      liquidity: result.rows[0]
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error adding pool liquidity:', error);
    return NextResponse.json(
      { error: 'Failed to add pool liquidity' },
      { status: 500, headers: corsHeaders }
    );
  }
}