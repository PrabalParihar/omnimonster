import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig, OperationStatus } from '@swap-sage/shared';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Submit gasless claim request
export async function POST(request: NextRequest) {
  try {
    const claimData = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'htlcContract', 'contractId', 'preimage', 'beneficiary', 'signature'
    ];
    
    for (const field of requiredFields) {
      if (!claimData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Validate addresses
    if (!ethers.isAddress(claimData.htlcContract) || !ethers.isAddress(claimData.beneficiary)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate signature format
    if (!claimData.signature || claimData.signature.length !== 132) {
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate contractId and preimage format
    if (!claimData.contractId || claimData.contractId.length !== 66 ||
        !claimData.preimage || claimData.preimage.length !== 66) {
      return NextResponse.json(
        { error: 'Invalid contractId or preimage format' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Find the corresponding swap request
    const swapQuery = await dao.query(
      'SELECT * FROM swap_requests WHERE hash_lock = $1 AND user_address = $2 AND status = $3',
      [
        ethers.keccak256(claimData.preimage),
        claimData.beneficiary.toLowerCase(),
        'POOL_FULFILLED'
      ]
    );

    if (swapQuery.rows.length === 0) {
      return NextResponse.json(
        { error: 'No eligible swap found for this claim' },
        { status: 404, headers: corsHeaders }
      );
    }

    const swap = swapQuery.rows[0];

    // Check if claim already exists
    const existingClaim = await dao.query(
      'SELECT * FROM gasless_claims WHERE swap_request_id = $1 AND claimer_address = $2',
      [swap.id, claimData.beneficiary.toLowerCase()]
    );

    if (existingClaim.rows.length > 0) {
      const claim = existingClaim.rows[0];
      return NextResponse.json(
        { 
          error: 'Claim already submitted',
          claimId: claim.id,
          status: claim.status
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // Check rate limits
    const recentClaims = await dao.query(
      'SELECT COUNT(*) as count FROM gasless_claims WHERE claimer_address = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
      [claimData.beneficiary.toLowerCase()]
    );

    const claimCount = parseInt(recentClaims.rows[0]?.count || '0');
    const maxClaimsPerHour = 10; // Should be configurable

    if (claimCount >= maxClaimsPerHour) {
      return NextResponse.json(
        { error: `Rate limit exceeded: ${claimCount}/${maxClaimsPerHour} claims per hour` },
        { status: 429, headers: corsHeaders }
      );
    }

    // Get user nonce for the claim
    // This would typically be fetched from the gas relayer contract
    const nonce = Date.now(); // Simplified for demo

    // Create gasless claim request
    const claim = await dao.createGaslessClaim({
      swapRequestId: swap.id,
      claimerAddress: claimData.beneficiary.toLowerCase(),
      htlcContract: claimData.htlcContract.toLowerCase(),
      contractId: claimData.contractId,
      preimage: claimData.preimage,
      signature: claimData.signature,
      status: OperationStatus.PENDING
    });

    // Return claim information
    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
        estimatedProcessingTime: '30-60 seconds'
      },
      swap: {
        id: swap.id,
        targetToken: swap.target_token,
        expectedAmount: swap.expected_amount
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error submitting gasless claim:', error);
    return NextResponse.json(
      { error: 'Failed to submit gasless claim' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Get gasless claim status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get('claimId');
    const userAddress = searchParams.get('userAddress');

    if (!claimId && !userAddress) {
      return NextResponse.json(
        { error: 'Either claimId or userAddress required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    if (claimId) {
      // Get specific claim
      const claim = await dao.query(
        'SELECT * FROM gasless_claims WHERE id = $1',
        [claimId]
      );

      if (claim.rows.length === 0) {
        return NextResponse.json(
          { error: 'Claim not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        claim: claim.rows[0]
      }, { headers: corsHeaders });

    } else {
      // Get claims for user
      const claims = await dao.query(`
        SELECT gc.*, sr.target_token, sr.expected_amount, st.symbol, st.decimals
        FROM gasless_claims gc
        JOIN swap_requests sr ON gc.swap_request_id = sr.id
        LEFT JOIN supported_tokens st ON sr.target_token = st.token_address
        WHERE gc.claimer_address = $1
        ORDER BY gc.created_at DESC
        LIMIT 50
      `, [userAddress.toLowerCase()]);

      return NextResponse.json({
        claims: claims.rows
      }, { headers: corsHeaders });
    }

  } catch (error) {
    console.error('Error fetching gasless claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gasless claims' },
      { status: 500, headers: corsHeaders }
    );
  }
}