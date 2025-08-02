import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig, SwapStatus } from '@swap-sage/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get specific swap details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Swap ID required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    const swap = await dao.getSwapRequest(id);

    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get token information
    const sourceToken = await dao.getSupportedToken(swap.sourceToken);
    const targetToken = await dao.getSupportedToken(swap.targetToken);

    // Get resolver operations
    const operations = await dao.getResolverOperationsBySwap(id);

    return NextResponse.json({
      swap: {
        ...swap,
        sourceTokenInfo: sourceToken,
        targetTokenInfo: targetToken
      },
      operations
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching swap:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Cancel swap (only if still pending)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userAddress } = await request.json();

    if (!id || !userAddress) {
      return NextResponse.json(
        { error: 'Swap ID and user address required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    const swap = await dao.getSwapRequest(id);

    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify ownership
    if (swap.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Can only cancel pending swaps
    if (swap.status !== SwapStatus.PENDING) {
      return NextResponse.json(
        { error: 'Can only cancel pending swaps' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Update swap status to cancelled
    const updatedSwap = await dao.updateSwapRequest(id, {
      status: SwapStatus.CANCELLED
    });

    // Release any reserved pool liquidity
    if (swap.targetToken) {
      try {
        await dao.releasePoolLiquidity(swap.targetToken, swap.expectedAmount);
      } catch (releaseError) {
        console.error('Failed to release pool liquidity:', releaseError);
        // Don't fail the cancellation if liquidity release fails
      }
    }

    return NextResponse.json({
      success: true,
      swap: updatedSwap
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error cancelling swap:', error);
    return NextResponse.json(
      { error: 'Failed to cancel swap' },
      { status: 500, headers: corsHeaders }
    );
  }
}