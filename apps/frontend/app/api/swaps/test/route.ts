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

const testSwapSchema = z.object({
  fromChain: z.string().default('ethereum'),
  toChain: z.string().default('polygon'),
  amount: z.string().default('100'),
  beneficiary: z.string().default('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
  timelock: z.number().optional().default(3600),
  slippage: z.number().optional().default(1),
  fullFlow: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = testSwapSchema.parse(body);

    let result;
    if (validatedData.fullFlow) {
      // Process full swap flow for testing
      result = await realAtomicOrchestratorService.processFullSwap(validatedData);
    } else {
      // Just create the swap
      result = await realAtomicOrchestratorService.createSwap(validatedData);
    }

    return NextResponse.json(result, {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error testing swap:', error);
    
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