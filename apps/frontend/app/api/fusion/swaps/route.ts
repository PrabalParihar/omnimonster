import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig, SwapStatus } from '@swap-sage/shared';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Create new swap request
export async function POST(request: NextRequest) {
  console.log('=== SWAP REQUEST DEBUG ===');
  try {
    const swapData = await request.json();
    console.log('Received swap data:', JSON.stringify(swapData, null, 2));
    
    // Validate required fields (including optional cross-chain fields)
    const requiredFields = [
      'userAddress', 'sourceToken', 'sourceAmount', 'targetToken', 
      'expectedAmount', 'slippageTolerance', 'expirationTime'
    ];
    
    // Optional cross-chain fields
    const optionalFields = ['sourceChainId', 'targetChainId'];
    
    for (const field of requiredFields) {
      if (!swapData[field]) {
        console.log(`Missing field: ${field}`);
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    console.log('All required fields present');

    // Validate addresses
    if (!ethers.isAddress(swapData.userAddress) || 
        !ethers.isAddress(swapData.sourceToken) || 
        !ethers.isAddress(swapData.targetToken)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate amounts
    if (BigInt(swapData.sourceAmount) <= 0 || BigInt(swapData.expectedAmount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amounts' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate slippage tolerance (should be between 0 and 1)
    if (swapData.slippageTolerance < 0 || swapData.slippageTolerance > 1) {
      return NextResponse.json(
        { error: 'Invalid slippage tolerance' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate expiration time (should be in the future)
    const currentTime = Math.floor(Date.now() / 1000);
    if (swapData.expirationTime <= currentTime) {
      return NextResponse.json(
        { error: 'Expiration time must be in the future' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate hash lock and preimage
    const preimage = ethers.hexlify(ethers.randomBytes(32));
    const hashLock = ethers.keccak256(preimage);

    // Initialize database connection
    console.log('Initializing database connection...');
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);
    console.log('Database connection initialized');

    // Check if user exists
    console.log('Checking user:', swapData.userAddress.toLowerCase());
    const user = await dao.getUserByWallet(swapData.userAddress.toLowerCase());
    console.log('User found:', user ? 'YES' : 'NO');
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please connect your wallet first.' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if tokens are supported
    console.log('Checking source token:', swapData.sourceToken.toLowerCase());
    const sourceToken = await dao.getSupportedToken(swapData.sourceToken.toLowerCase());
    console.log('Source token found:', sourceToken ? 'YES' : 'NO');
    
    console.log('Checking target token:', swapData.targetToken.toLowerCase());
    const targetToken = await dao.getSupportedToken(swapData.targetToken.toLowerCase());
    console.log('Target token found:', targetToken ? 'YES' : 'NO');
    
    if (!sourceToken || !targetToken) {
      console.log('Token pair not supported');
      return NextResponse.json(
        { error: 'Unsupported token pair' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check minimum/maximum swap amounts
    if (BigInt(swapData.sourceAmount) < BigInt(sourceToken.minSwapAmount) ||
        BigInt(swapData.sourceAmount) > BigInt(sourceToken.maxSwapAmount)) {
      return NextResponse.json(
        { error: `Source amount outside allowed range: ${sourceToken.minSwapAmount} - ${sourceToken.maxSwapAmount}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check pool liquidity
    const poolLiquidity = await dao.getPoolLiquidity(swapData.targetToken.toLowerCase());
    if (!poolLiquidity || BigInt(poolLiquidity.availableBalance) < BigInt(swapData.expectedAmount)) {
      return NextResponse.json(
        { error: 'Insufficient pool liquidity' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Create swap request
    const swap = await dao.createSwapRequest({
      userAddress: swapData.userAddress.toLowerCase(),
      sourceToken: swapData.sourceToken.toLowerCase(),
      sourceAmount: swapData.sourceAmount,
      targetToken: swapData.targetToken.toLowerCase(),
      expectedAmount: swapData.expectedAmount,
      slippageTolerance: swapData.slippageTolerance,
      hashLock: hashLock,
      preimageHash: preimage, // Store preimage securely
      expirationTime: swapData.expirationTime,
      status: SwapStatus.PENDING
    });

    return NextResponse.json({
      success: true,
      swap: {
        id: swap.id,
        hashLock: hashLock,
        preimage: preimage, // Return preimage to user for claiming
        expirationTime: swap.expirationTime,
        status: swap.status,
        createdAt: swap.createdAt
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error creating swap request:', error);
    return NextResponse.json(
      { error: 'Failed to create swap request' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Get user swaps
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const status = searchParams.get('status') as SwapStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    const swaps = await dao.getSwapsByUser(userAddress.toLowerCase(), status);

    // Apply pagination
    const paginatedSwaps = swaps.slice(offset, offset + limit);

    // Get token information for each swap
    const swapsWithTokenInfo = await Promise.all(
      paginatedSwaps.map(async (swap) => {
        const sourceToken = await dao.getSupportedToken(swap.sourceToken);
        const targetToken = await dao.getSupportedToken(swap.targetToken);
        
        return {
          ...swap,
          sourceTokenInfo: sourceToken,
          targetTokenInfo: targetToken
        };
      })
    );

    return NextResponse.json({
      swaps: swapsWithTokenInfo,
      pagination: {
        total: swaps.length,
        limit,
        offset,
        hasMore: offset + limit < swaps.length
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching swaps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swaps' },
      { status: 500, headers: corsHeaders }
    );
  }
}