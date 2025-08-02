import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const HTLC_ABI = [
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function isClaimable(bytes32 contractId) view returns (bool)',
  'function isRefundable(bytes32 contractId) view returns (bool)',
];

const CONTRACT_ADDRESSES = {
  localhost: {
    FusionHTLC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const claimId = params.claimId;
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') || 'localhost';

    console.log('🔍 Checking claim status for:', { claimId, network });

    // Initialize provider
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    const addresses = CONTRACT_ADDRESSES[network as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES.localhost;
    
    const htlcContract = new ethers.Contract(
      addresses.FusionHTLC,
      HTLC_ABI,
      provider
    );

    // Get contract details
    const details = await htlcContract.getDetails(claimId);
    const [token, beneficiary, originator, hashLock, timelock, value, state] = details;

    // Get status flags
    const [isClaimable, isRefundable] = await Promise.all([
      htlcContract.isClaimable(claimId),
      htlcContract.isRefundable(claimId)
    ]);

    // Map state enum to readable status
    const stateNames = ['INVALID', 'OPEN', 'CLAIMED', 'REFUNDED'];
    const readableState = stateNames[state] || 'UNKNOWN';

    const status = {
      contractId: claimId,
      state: readableState,
      stateNumber: state,
      isClaimable,
      isRefundable,
      details: {
        token,
        beneficiary,
        originator,
        hashLock,
        timelock: timelock.toString(),
        timelockDate: new Date(Number(timelock) * 1000).toISOString(),
        value: value.toString(),
        valueFormatted: ethers.formatEther(value)
      },
      timestamps: {
        currentTime: Math.floor(Date.now() / 1000),
        timelock: Number(timelock),
        timeRemaining: Math.max(0, Number(timelock) - Math.floor(Date.now() / 1000))
      }
    };

    return NextResponse.json(status, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error checking claim status:', error);

    if (error instanceof Error && error.message.includes('contract call reverted')) {
      return NextResponse.json(
        { error: 'Contract not found or invalid claim ID' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}