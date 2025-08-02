import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { realBlockchainSwapService } from '@/lib/real-blockchain-swap-service';
import { FusionDatabase, getDatabaseConfig, FusionDAO, SwapStatus } from '../../../../../packages/shared/src/database';

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
  fromToken: z.string(),
  toChain: z.string(),
  toToken: z.string(),
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
      console.log(`🗃️ POST /api/swaps - Wallet orchestrator saving swap: ${body.id}`);
      
      // This is a wallet orchestrator saving a swap record
      try {
        const dbConfig = getDatabaseConfig();
        const database = FusionDatabase.getInstance(dbConfig);
        const dao = new FusionDAO(database);
        
        console.log(`🗃️ About to call dao.createSwapRequest for ${body.id}`);
        await dao.createSwapRequest(body);
        
        console.log(`✅ Database createSwapRequest completed successfully for ${body.id}`);
        return NextResponse.json({ message: 'Swap saved successfully' }, {
          status: 201,
          headers: corsHeaders
        });
      } catch (dbError) {
        console.error(`❌ Database save failed for ${body.id}:`, dbError);
        console.error('❌ Database error details:', {
          name: dbError instanceof Error ? dbError.name : 'Unknown',
          message: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined
        });
        // Return an error instead of pretending it succeeded
        return NextResponse.json({ 
          error: 'Database save failed',
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }, {
          status: 500,
          headers: corsHeaders
        });
      }
    } else {
      // This is a request to create a new cross-chain swap (database only)
      console.log('🔄 Creating new cross-chain swap record with data:', body);
      
      const validatedData = createSwapSchema.parse(body);
      console.log('✅ Validation passed:', validatedData);
      
      // Generate swap ID and basic info (no blockchain interaction here)
      const swapId = uuidv4(); // Generate proper UUID
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + validatedData.timelock * 1000);
      
      // Create swap using the shared Fusion database system
      const swapRequest = {
        id: swapId,
        userAddress: validatedData.beneficiary, // Will be updated by client
        sourceToken: `${validatedData.fromChain}:${validatedData.fromToken}`,
        sourceAmount: validatedData.amount,
        targetToken: `${validatedData.toChain}:${validatedData.toToken}`,
        expectedAmount: validatedData.amount, // Will be calculated by client
        slippageTolerance: validatedData.slippage || 1,
        hashLock: '', // Will be set by client
        preimageHash: '', // Will be set by client
        expirationTime: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp
        status: SwapStatus.PENDING,
        createdAt: createdAt,
        updatedAt: createdAt
      };

      try {
        const dbConfig = getDatabaseConfig();
        const database = FusionDatabase.getInstance(dbConfig);
        const dao = new FusionDAO(database);
        await dao.createSwapRequest(swapRequest);
        console.log('✅ Swap request created:', swapId);

        return NextResponse.json({
          id: swapId,
          status: SwapStatus.PENDING,
          ...validatedData,
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString()
        }, {
          status: 201,
          headers: corsHeaders
        });
      } catch (dbError) {
        console.error('Database error creating swap:', dbError);
        return NextResponse.json({ 
          error: 'Failed to create swap record',
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }, {
          status: 500,
          headers: corsHeaders
        });
      }
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
    // Get swaps from shared database
    try {
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      const dao = new FusionDAO(database);
      const swaps = await dao.getPendingSwaps(100); // Get recent swaps
      
      return NextResponse.json({ swaps }, {
        status: 200,
        headers: corsHeaders
      });
    } catch (dbError) {
      console.warn('Database error, returning empty list:', dbError);
      return NextResponse.json({ swaps: [] }, {
        status: 200,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Error fetching swaps:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
} 