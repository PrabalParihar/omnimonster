import { NextRequest, NextResponse } from 'next/server';
import { realAtomicOrchestratorService } from '@/lib/real-atomic-orchestrator';

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
    const swap = await realAtomicOrchestratorService.getSwap(params.id);
    
    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(swap, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error fetching swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT /api/swaps/:id - Update swap
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    
    // Try to update in database directly (for wallet orchestrator)
    try {
      const { swapDatabase } = await import('@/lib/database');
      await swapDatabase.updateSwap(params.id, updates);
      return NextResponse.json(
        { message: 'Swap updated successfully' },
        { status: 200, headers: corsHeaders }
      );
    } catch (dbError) {
      console.warn('Direct database update failed, trying service:', dbError);
      
      // Fallback to real atomic orchestrator service
      const success = await realAtomicOrchestratorService.updateSwap(params.id, updates);
      
      if (!success) {
        return NextResponse.json(
          { error: 'Swap not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { message: 'Swap updated successfully' },
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('Error updating swap:', error);
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
    const success = await realAtomicOrchestratorService.cancelSwap(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Swap not found or cannot be cancelled' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { message: 'Swap cancelled successfully' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error cancelling swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 