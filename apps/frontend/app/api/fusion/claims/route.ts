import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get available claim endpoints
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Fusion Swap Claims API',
      status: 'success',
      availableEndpoints: {
        gasless: '/api/fusion/claims/gasless',
        manual: '/api/fusion/claims/manual (coming soon)',
        batch: '/api/fusion/claims/batch (coming soon)'
      },
      description: 'Use the gasless endpoint for automated claim processing',
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in claims endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to get claims information' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Create new claim request
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Claims endpoint - use /api/fusion/claims/gasless for gasless claims',
      status: 'info',
      redirectTo: '/api/fusion/claims/gasless'
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error in claims endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process claim request' },
      { status: 500, headers: corsHeaders }
    );
  }
} 