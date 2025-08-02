import { NextRequest, NextResponse } from 'next/server';
import { realAtomicOrchestratorService } from '@/lib/real-atomic-orchestrator';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');

    if (tokenAddress) {
      // Get liquidity for specific token
      const liquidity = await realAtomicOrchestratorService.getPoolLiquidity(tokenAddress);
      return NextResponse.json(liquidity, {
        status: 200,
        headers: corsHeaders
      });
    } else {
      // Get all supported tokens
      const supportedTokens = await realAtomicOrchestratorService.getSupportedTokens();
      return NextResponse.json({ supportedTokens }, {
        status: 200,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Error fetching pool liquidity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}