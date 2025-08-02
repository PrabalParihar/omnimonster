import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const gaslessClaimSchema = z.object({
  htlcContract: z.string(),
  contractId: z.string(),
  preimage: z.string(),
  beneficiary: z.string(),
  signature: z.string(),
  network: z.string().optional().default('localhost'),
});

// Contract ABIs for gasless claiming
const FORWARDER_ABI = [
  'function claim(bytes32 contractId, bytes32 preimage)',
  'function canMetaClaim(bytes32 contractId, address user) view returns (bool)',
  'function verify((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) request, bytes signature) view returns (bool)',
  'function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) request, bytes signature) returns (bool,bytes memory)',
];

const CONTRACT_ADDRESSES = {
  localhost: {
    SwapSageHTLCForwarder: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    FusionForwarder: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = gaslessClaimSchema.parse(body);

    console.log('🎯 Processing gasless claim request:', {
      contractId: validatedData.contractId,
      beneficiary: validatedData.beneficiary,
      network: validatedData.network
    });

    // Initialize provider and contracts
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Use deployer account as gas relayer
    const gasRelayerPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const gasRelayer = new ethers.Wallet(gasRelayerPrivateKey, provider);
    
    const addresses = CONTRACT_ADDRESSES[validatedData.network as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES.localhost;
    
    const forwarderContract = new ethers.Contract(
      addresses.SwapSageHTLCForwarder,
      FORWARDER_ABI,
      gasRelayer
    );

    // Verify the user can claim
    const canClaim = await forwarderContract.canMetaClaim(
      validatedData.contractId,
      validatedData.beneficiary
    );

    if (!canClaim) {
      return NextResponse.json(
        { error: 'User cannot claim this contract' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Execute the gasless claim
    console.log('⛽ Executing gasless claim transaction...');
    
    const claimTx = await forwarderContract.claim(
      validatedData.contractId,
      validatedData.preimage
    );

    console.log('📝 Claim transaction sent:', claimTx.hash);
    
    // Wait for confirmation
    const receipt = await claimTx.wait();
    
    console.log('✅ Gasless claim confirmed:', {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Gasless claim executed successfully'
    }, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error processing gasless claim:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400, headers: corsHeaders }
      );
    }

    // Handle specific blockchain errors
    if (error instanceof Error) {
      let message = error.message;
      let status = 500;

      if (message.includes('insufficient funds')) {
        message = 'Gas relayer has insufficient funds';
        status = 503;
      } else if (message.includes('revert')) {
        message = 'Transaction reverted: ' + message;
        status = 400;
      } else if (message.includes('nonce')) {
        message = 'Nonce error, please retry';
        status = 409;
      }

      return NextResponse.json(
        { error: message },
        { status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}