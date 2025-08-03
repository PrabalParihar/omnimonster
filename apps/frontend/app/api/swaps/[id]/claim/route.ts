import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../../../../../../../packages/shared/src/database';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    console.log(`📥 GET /api/swaps/${swapId}/claim - Fetching claim data`);

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
      
      // Check if swap is ready for claiming
      if (swap.status !== 'POOL_FULFILLED') {
        return NextResponse.json(
          { error: `Swap not ready for claiming. Current status: ${swap.status}` },
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Return claim data with proper field names
      const claimData = {
        id: swap.id,
        status: swap.status,
        poolHtlcContract: swap.poolHtlcContract,
        preimage: swap.preimageHash, // Frontend expects 'preimage'
        userAddress: swap.userAddress,
        targetToken: swap.targetToken,
        expectedAmount: swap.expectedAmount
      };
      
      return NextResponse.json(claimData, {
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
    console.error('Error fetching swap claim data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}