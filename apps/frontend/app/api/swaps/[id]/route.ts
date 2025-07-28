import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '../../../../lib/orchestrator-service';

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/swaps/:id - Get swap details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const swapId = params.id;

    if (!swapId) {
      return NextResponse.json(
        { error: 'Swap ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const orchestrator = getOrchestrator();
    const swap = orchestrator.getSwap(swapId);

    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get events for this swap
    const events = orchestrator.getSwapEvents(swapId);

    const response = {
      swap,
      events,
      meta: {
        eventCount: events.length,
        lastUpdated: swap.updatedAt
      }
    };

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE /api/swaps/:id - Cancel swap
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const swapId = params.id;

    if (!swapId) {
      return NextResponse.json(
        { error: 'Swap ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const orchestrator = getOrchestrator();
    const swap = orchestrator.getSwap(swapId);

    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Only allow cancellation of active swaps
    const cancellableStatuses = ['initiated', 'generating_params', 'creating_src_htlc', 'creating_dst_htlc'];
    if (!cancellableStatuses.includes(swap.status)) {
      return NextResponse.json(
        { error: `Cannot cancel swap in status: ${swap.status}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const cancelled = orchestrator.cancelSwap(swapId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel swap (may not be active)' },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { message: 'Swap cancelled successfully' },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error cancelling swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 