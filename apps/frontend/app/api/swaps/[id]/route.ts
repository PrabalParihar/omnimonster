import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../../../../../../packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const swapId = params.id;
    console.log(`📥 GET /api/swaps/${swapId} - Fetching swap details`);

    if (!swapId) {
      return NextResponse.json(
        { error: 'Swap ID required' },
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      const dao = new FusionDAO(database);
      
      // Fetch swap from database
      const swap = await dao.getSwapRequest(swapId);
      
      if (!swap) {
        console.log(`❌ Swap not found: ${swapId}`);
        return NextResponse.json(
          { error: 'Swap not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      console.log(`✅ Found swap: ${swapId}, status: ${swap.status}`);
      
      // Don't return the preimage hash for security
      const { preimageHash, ...safeSwap } = swap;
      
      return NextResponse.json(safeSwap, {
        status: 200,
        headers: corsHeaders
      });
    } catch (dbError) {
      console.error('Database error fetching swap:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch swap from database' },
        { status: 500, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('Error fetching swap:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const swapId = params.id;
    const updates = await request.json();
    
    console.log(`📝 PUT /api/swaps/${swapId} - Updating swap with:`, updates);

    try {
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      const dao = new FusionDAO(database);
      
      // Update swap in database
      const updatedSwap = await dao.updateSwapRequest(swapId, updates);
      
      if (!updatedSwap) {
        return NextResponse.json(
          { error: 'Swap not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      console.log(`✅ Updated swap: ${swapId}`);
      
      // Don't return the preimage hash for security
      const { preimageHash, ...safeSwap } = updatedSwap;
      
      return NextResponse.json(safeSwap, {
        status: 200,
        headers: corsHeaders
      });
    } catch (dbError) {
      console.error('Database error updating swap:', dbError);
      return NextResponse.json(
        { error: 'Failed to update swap in database' },
        { status: 500, headers: corsHeaders }
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