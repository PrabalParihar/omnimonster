import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';
import { ethers } from 'ethers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get swap quote from pool
export async function POST(request: NextRequest) {
  try {
    const quoteRequest = await request.json();
    
    // Validate required fields
    const requiredFields = ['sourceToken', 'targetToken', 'sourceAmount', 'slippageTolerance'];
    
    for (const field of requiredFields) {
      if (!quoteRequest[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Validate addresses
    if (!ethers.isAddress(quoteRequest.sourceToken) || !ethers.isAddress(quoteRequest.targetToken)) {
      return NextResponse.json(
        { error: 'Invalid token addresses' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate amounts
    if (BigInt(quoteRequest.sourceAmount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid source amount' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate slippage tolerance
    if (quoteRequest.slippageTolerance < 0 || quoteRequest.slippageTolerance > 1) {
      return NextResponse.json(
        { error: 'Invalid slippage tolerance' },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get token information
    const sourceToken = await dao.getSupportedToken(quoteRequest.sourceToken.toLowerCase());
    const targetToken = await dao.getSupportedToken(quoteRequest.targetToken.toLowerCase());

    if (!sourceToken || !targetToken) {
      return NextResponse.json(
        { error: 'Unsupported token pair' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check pool liquidity
    const targetLiquidity = await dao.getPoolLiquidity(quoteRequest.targetToken.toLowerCase());
    if (!targetLiquidity) {
      return NextResponse.json(
        { error: 'No liquidity available for target token' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get price feed data (simplified - in production you'd use actual price oracles)
    const mockPrices = {
      [sourceToken.symbol.toUpperCase()]: 1800.0, // Mock prices
      [targetToken.symbol.toUpperCase()]: 1.0,
    };

    const sourcePrice = mockPrices[sourceToken.symbol.toUpperCase()] || 1.0;
    const targetPrice = mockPrices[targetToken.symbol.toUpperCase()] || 1.0;

    // Calculate exchange rate and amounts
    const baseExchangeRate = sourcePrice / targetPrice;
    const sourceAmountDecimal = parseFloat(ethers.formatUnits(quoteRequest.sourceAmount, sourceToken.decimals));
    
    // Apply fee (e.g., 0.3%)
    const feeRate = 0.003;
    const exchangeRateWithFee = baseExchangeRate * (1 - feeRate);
    
    const targetAmountDecimal = sourceAmountDecimal * exchangeRateWithFee;
    const targetAmount = ethers.parseUnits(targetAmountDecimal.toFixed(targetToken.decimals), targetToken.decimals);

    // Check if we have enough liquidity
    if (BigInt(targetLiquidity.availableBalance) < targetAmount) {
      return NextResponse.json(
        { error: 'Insufficient liquidity for this swap size' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calculate price impact
    const poolSizeDecimal = parseFloat(ethers.formatUnits(targetLiquidity.totalBalance, targetToken.decimals));
    const swapSizeDecimal = parseFloat(ethers.formatUnits(targetAmount.toString(), targetToken.decimals));
    const priceImpact = (swapSizeDecimal / poolSizeDecimal) * 100;

    // Calculate gas savings estimate (typical claim transaction costs ~$5-20)
    const estimatedGasSavings = ethers.parseEther('0.005'); // $5 equivalent

    // Apply slippage tolerance
    const minReceiveAmount = targetAmount * BigInt(Math.floor((1 - quoteRequest.slippageTolerance) * 1000)) / BigInt(1000);

    return NextResponse.json({
      sourceToken: sourceToken.tokenAddress,
      targetToken: targetToken.tokenAddress,
      sourceAmount: quoteRequest.sourceAmount,
      targetAmount: targetAmount.toString(),
      minReceiveAmount: minReceiveAmount.toString(),
      exchangeRate: exchangeRateWithFee,
      priceImpact: Math.min(priceImpact, 100), // Cap at 100%
      poolLiquidity: targetLiquidity.availableBalance,
      estimatedGasSavings: estimatedGasSavings.toString(),
      fee: {
        percentage: feeRate * 100,
        amount: (sourceAmountDecimal * feeRate).toFixed(6)
      },
      expirationTime: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      valid: true,
      timestamp: Date.now()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error generating quote:', error);
    return NextResponse.json(
      { error: 'Failed to generate quote' },
      { status: 500, headers: corsHeaders }
    );
  }
}