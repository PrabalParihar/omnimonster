import { NextRequest, NextResponse } from 'next/server';

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/parse-intent - Parse natural language swap intent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mock parsing logic - in real implementation, this would use LangChain agent
    const parsedIntent = await parseSwapIntent(query);

    return NextResponse.json(parsedIntent, {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error parsing intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Mock intent parsing function - replace with actual LangChain implementation
async function parseSwapIntent(query: string): Promise<any> {
  // Simple regex-based parsing for demo purposes
  const lowerQuery = query.toLowerCase();
  
  // Extract amount
  const amountMatch = query.match(/(\d+(?:\.\d+)?)\s*(eth|btc|usdc|matic|tokens?)/i);
  const amount = amountMatch ? amountMatch[1] : '0.1';
  const token = amountMatch ? amountMatch[2].toUpperCase() : 'ETH';
  
  // Extract chains
  let fromChain = 'sepolia';
  let toChain = 'polygonAmoy';
  
  if (lowerQuery.includes('sepolia') || lowerQuery.includes('ethereum')) {
    fromChain = 'sepolia';
  } else if (lowerQuery.includes('polygon')) {
    fromChain = 'polygonAmoy';
  } else if (lowerQuery.includes('cosmos')) {
    fromChain = 'cosmosTestnet';
  }
  
  if (lowerQuery.includes('to polygon') || lowerQuery.includes('polygon')) {
    toChain = 'polygonAmoy';
  } else if (lowerQuery.includes('to ethereum') || lowerQuery.includes('ethereum')) {
    toChain = 'sepolia';
  } else if (lowerQuery.includes('to cosmos')) {
    toChain = 'cosmosTestnet';
  }
  
  // Extract beneficiary address
  const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
  const beneficiary = addressMatch ? addressMatch[0] : '0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8';
  
  // Extract timelock
  const timelockMatch = query.match(/(\d+)\s*hour/);
  const timelock = timelockMatch ? parseInt(timelockMatch[1]) * 3600 : 3600;
  
  // Extract slippage
  const slippageMatch = query.match(/(\d+(?:\.\d+)?)%?\s*slippage/);
  const slippage = slippageMatch ? parseFloat(slippageMatch[1]) : 1;
  
  // Check for dry run
  const dryRun = lowerQuery.includes('dry run') || lowerQuery.includes('simulation') || lowerQuery.includes('test');
  
  // Calculate confidence based on parsing success
  let confidence = 0.8;
  const warnings: string[] = [];
  
  if (!amountMatch) {
    confidence -= 0.2;
    warnings.push('Could not parse amount clearly');
  }
  
  if (!addressMatch) {
    confidence -= 0.1;
    warnings.push('Using default beneficiary address');
  }
  
  if (fromChain === toChain) {
    confidence -= 0.3;
    warnings.push('Source and destination chains are the same');
  }
  
  // Ensure minimum confidence
  confidence = Math.max(confidence, 0.5);
  
  return {
    fromChain,
    toChain,
    amount: `${amount} ${token}`,
    beneficiary,
    timelock,
    slippage,
    dryRun,
    confidence,
    warnings: warnings.length > 0 ? warnings : undefined
  };
} 