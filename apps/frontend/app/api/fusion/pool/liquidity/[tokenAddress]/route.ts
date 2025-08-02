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

// Get liquidity for specific token
export async function GET(
  request: NextRequest,
  { params }: { params: { tokenAddress: string } }
) {
  try {
    const { tokenAddress } = params;

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { error: 'Valid token address required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get token info
    const token = await dao.getSupportedToken(tokenAddress.toLowerCase());
    if (!token) {
      return NextResponse.json(
        { error: 'Token not supported' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get liquidity info
    const liquidity = await dao.getPoolLiquidity(tokenAddress.toLowerCase());
    if (!liquidity) {
      return NextResponse.json(
        { error: 'Liquidity info not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get recent operations for this token
    const recentOperations = await dao.query(`
      SELECT po.*, sr.user_address, sr.source_amount, sr.expected_amount
      FROM pool_operations po
      LEFT JOIN swap_requests sr ON po.swap_request_id = sr.id
      WHERE po.token_address = $1
      ORDER BY po.created_at DESC
      LIMIT 10
    `, [tokenAddress.toLowerCase()]);

    // Calculate utilization metrics
    const totalBalance = BigInt(liquidity.totalBalance);
    const availableBalance = BigInt(liquidity.availableBalance);
    const reservedBalance = BigInt(liquidity.reservedBalance);
    const minThreshold = BigInt(liquidity.minThreshold);

    const utilizationRate = totalBalance > 0n 
      ? Number((reservedBalance * 100n) / totalBalance)
      : 0;

    const healthStatus = availableBalance >= minThreshold ? 'HEALTHY' : 'LOW';
    
    const capacityRemaining = Number(availableBalance) / Math.pow(10, token.decimals);
    const thresholdAmount = Number(minThreshold) / Math.pow(10, token.decimals);

    return NextResponse.json({
      token: {
        address: token.tokenAddress,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: token.chainId
      },
      liquidity: {
        totalBalance: liquidity.totalBalance,
        availableBalance: liquidity.availableBalance,
        reservedBalance: liquidity.reservedBalance,
        minThreshold: liquidity.minThreshold,
        utilizationRate,
        healthStatus,
        capacityRemaining,
        thresholdAmount,
        lastUpdated: liquidity.updatedAt
      },
      recentOperations: recentOperations.rows,
      limits: {
        minSwapAmount: token.minSwapAmount,
        maxSwapAmount: token.maxSwapAmount,
        feePercentage: token.feePercentage
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching token liquidity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token liquidity' },
      { status: 500, headers: corsHeaders }
    );
  }
}