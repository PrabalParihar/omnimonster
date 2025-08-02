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

// Get supported tokens
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');
    const includeBalance = searchParams.get('includeBalance') === 'true';

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get supported tokens
    const tokens = await dao.getSupportedTokens(
      chainId ? parseInt(chainId) : undefined
    );

    // Optionally include pool balance information
    const tokensWithInfo = await Promise.all(
      tokens.map(async (token) => {
        const baseInfo = {
          address: token.tokenAddress,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          chainId: token.chainId,
          minSwapAmount: token.minSwapAmount,
          maxSwapAmount: token.maxSwapAmount,
          feePercentage: token.feePercentage,
          isActive: token.isActive
        };

        if (includeBalance) {
          const liquidity = await dao.getPoolLiquidity(token.tokenAddress);
          return {
            ...baseInfo,
            poolBalance: liquidity ? {
              totalBalance: liquidity.totalBalance,
              availableBalance: liquidity.availableBalance,
              reservedBalance: liquidity.reservedBalance,
              utilizationRate: liquidity.totalBalance !== '0' 
                ? Number((BigInt(liquidity.reservedBalance) * 100n) / BigInt(liquidity.totalBalance))
                : 0,
              healthStatus: liquidity.availableBalance && liquidity.minThreshold
                ? BigInt(liquidity.availableBalance) >= BigInt(liquidity.minThreshold) ? 'HEALTHY' : 'LOW'
                : 'UNKNOWN'
            } : null
          };
        }

        return baseInfo;
      })
    );

    // Group by chain ID
    const tokensByChain = tokensWithInfo.reduce((acc, token) => {
      if (!acc[token.chainId]) {
        acc[token.chainId] = [];
      }
      acc[token.chainId].push(token);
      return acc;
    }, {} as Record<number, typeof tokensWithInfo>);

    return NextResponse.json({
      tokens: tokensWithInfo,
      tokensByChain,
      summary: {
        totalTokens: tokensWithInfo.length,
        activeTokens: tokensWithInfo.filter(t => t.isActive).length,
        supportedChains: Object.keys(tokensByChain).map(Number),
        ...(includeBalance && {
          healthyTokens: tokensWithInfo.filter(t => t.poolBalance?.healthStatus === 'HEALTHY').length,
          lowLiquidityTokens: tokensWithInfo.filter(t => t.poolBalance?.healthStatus === 'LOW').length
        })
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching supported tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supported tokens' },
      { status: 500, headers: corsHeaders }
    );
  }
}