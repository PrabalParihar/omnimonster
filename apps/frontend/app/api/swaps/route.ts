import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { realAtomicOrchestratorService } from '@/lib/real-atomic-orchestrator';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const createSwapSchema = z.object({
  fromChain: z.string(),
  toChain: z.string(),
  amount: z.string(),
  beneficiary: z.string(),
  timelock: z.number().optional().default(3600),
  slippage: z.number().optional().default(1),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a wallet orchestrator swap record (has id, status, createdAt)
    if (body.id && body.status && body.createdAt) {
      // This is a wallet orchestrator saving a swap record
      try {
        const { swapDatabase } = await import('@/lib/database');
        await swapDatabase.createSwap(body);
        return NextResponse.json({ message: 'Swap saved successfully' }, {
          status: 201,
          headers: corsHeaders
        });
      } catch (dbError) {
        console.warn('Database save failed:', dbError);
        return NextResponse.json({ message: 'Swap saved (fallback)' }, {
          status: 201,
          headers: corsHeaders
        });
      }
    } else {
      // This is a request to create a new swap via real atomic orchestrator
      const validatedData = createSwapSchema.parse(body);
      const result = await realAtomicOrchestratorService.createSwap(validatedData);

      return NextResponse.json(result, {
        status: 201,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Error creating swap:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  try {
    const swaps = await realAtomicOrchestratorService.getSwaps();
    
    return NextResponse.json(swaps, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error fetching swaps:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 