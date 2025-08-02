import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FusionDatabase, getDatabaseConfig, FusionDAO, SwapStatus } from '../../../../../../packages/shared/src/database';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const updateSwapSchema = z.object({
  userAddress: z.string().optional(),
  hashLock: z.string().optional(),
  preimageHash: z.string().optional(),
  userHtlcContract: z.string().optional(),
  poolHtlcContract: z.string().optional(),
  status: z.string().optional(),
  expectedAmount: z.string().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    console.log(`🔄 Updating swap ${id} with data:`, body);
    
    const validatedData = updateSwapSchema.parse(body);
    console.log('✅ Validation passed:', validatedData);
    
    try {
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      const dao = new FusionDAO(database);
      await dao.updateSwapRequest(id, validatedData);
      console.log(`✅ Swap ${id} updated successfully`);

      return NextResponse.json({ message: 'Swap updated successfully' }, {
        status: 200,
        headers: corsHeaders
      });
    } catch (dbError) {
      console.error(`Database error updating swap ${id}:`, dbError);
      return NextResponse.json({ 
        error: 'Failed to update swap',
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, {
        status: 500,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Error updating swap:', error);
    
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    console.log(`📖 Getting swap ${id}`);
    
    try {
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      const dao = new FusionDAO(database);
      const swap = await dao.getSwapRequest(id);
      
      if (!swap) {
        return NextResponse.json({ error: 'Swap not found' }, {
          status: 404,
          headers: corsHeaders
        });
      }

      // Transform database response to frontend format
      const transformedSwap = {
        ...swap,
        beneficiaryAddress: swap.user_address, // Map user_address to beneficiaryAddress
        sourceChain: swap.source_token?.split(':')[0] || '',
        sourceToken: swap.source_token?.split(':')[1] || '',
        destinationChain: swap.target_token?.split(':')[0] || '',
        destinationToken: swap.target_token?.split(':')[1] || '',
        targetAmount: swap.expected_amount,
        timelock: swap.expiration_time
      };

      return NextResponse.json(transformedSwap, {
        status: 200,
        headers: corsHeaders
      });
    } catch (dbError) {
      console.error(`Database error getting swap ${id}:`, dbError);
      return NextResponse.json({ 
        error: 'Failed to get swap',
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, {
        status: 500,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Error getting swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}