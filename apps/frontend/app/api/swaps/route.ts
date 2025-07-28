import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '../../../lib/orchestrator-service';
import { SwapRequest } from '../../../lib/orchestrator-service';

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/swaps - Initiate a new swap
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { fromChain, toChain, amount, beneficiary } = body;
    
    if (!fromChain || !toChain || !amount || !beneficiary) {
      return NextResponse.json(
        { error: 'Missing required fields: fromChain, toChain, amount, beneficiary' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate chains
    const supportedChains = ['sepolia', 'polygonAmoy', 'cosmosTestnet'];
    if (!supportedChains.includes(fromChain) || !supportedChains.includes(toChain)) {
      return NextResponse.json(
        { error: `Unsupported chain. Supported: ${supportedChains.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    if (fromChain === toChain) {
      return NextResponse.json(
        { error: 'Source and destination chains must be different' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Create swap request
    const swapRequest: SwapRequest = {
      fromChain,
      toChain,
      amount: amount.toString(),
      beneficiary,
      timelock: body.timelock || 3600,
      privateKey: body.privateKey,
      mnemonic: body.mnemonic,
      dryRun: body.dryRun || false
    };

    const orchestrator = getOrchestrator();
    const response = await orchestrator.executeSwap(swapRequest);

    return NextResponse.json(response, { 
      status: 201, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error creating swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET /api/swaps - List swaps with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const orchestrator = getOrchestrator();
    
    let swaps;
    if (status) {
      // Filter by status if provided
      const allSwaps = orchestrator.getSwaps();
      swaps = allSwaps.filter(swap => swap.status === status);
    } else {
      swaps = orchestrator.getSwaps(limit, offset);
    }

    // Add metadata
    const response = {
      swaps,
      meta: {
        limit,
        offset,
        count: swaps.length,
        hasMore: swaps.length === limit
      }
    };

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching swaps:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 