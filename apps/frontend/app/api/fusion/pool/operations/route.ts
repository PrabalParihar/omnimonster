import { NextRequest, NextResponse } from 'next/server';
import { FusionDatabase, FusionDAO, getDatabaseConfig } from '@swap-sage/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get pool operations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tokenAddress = searchParams.get('tokenAddress');
    const operationType = searchParams.get('type'); // RESERVE, CLAIM, RELEASE
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 7d, 30d

    // Calculate time boundaries
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Build query with filters
    let query = `
      SELECT 
        po.id,
        po.swap_request_id,
        po.operation_type,
        po.token_address,
        po.amount,
        po.tx_hash,
        po.created_at,
        st.symbol,
        st.name,
        st.decimals,
        sr.user_address,
        sr.source_amount,
        sr.expected_amount,
        sr.status as swap_status
      FROM pool_operations po
      JOIN supported_tokens st ON po.token_address = st.token_address
      LEFT JOIN swap_requests sr ON po.swap_request_id = sr.id
      WHERE po.created_at >= $1
    `;

    const queryParams: any[] = [startTime.toISOString()];
    let paramIndex = 2;

    if (tokenAddress) {
      query += ` AND po.token_address = $${paramIndex}`;
      queryParams.push(tokenAddress.toLowerCase());
      paramIndex++;
    }

    if (operationType) {
      query += ` AND po.operation_type = $${paramIndex}`;
      queryParams.push(operationType);
      paramIndex++;
    }

    query += ` ORDER BY po.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const operationsResult = await dao.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM pool_operations po
      WHERE po.created_at >= $1
    `;

    const countParams: any[] = [startTime.toISOString()];
    let countParamIndex = 2;

    if (tokenAddress) {
      countQuery += ` AND po.token_address = $${countParamIndex}`;
      countParams.push(tokenAddress.toLowerCase());
      countParamIndex++;
    }

    if (operationType) {
      countQuery += ` AND po.operation_type = $${countParamIndex}`;
      countParams.push(operationType);
    }

    const countResult = await dao.query(countQuery, countParams);
    const totalOperations = parseInt(countResult.rows[0]?.total || '0');

    // Get operation summary stats
    const summaryQuery = await dao.query(`
      SELECT 
        po.operation_type,
        COUNT(*) as count,
        SUM(CAST(po.amount AS DECIMAL)) as total_amount,
        st.symbol
      FROM pool_operations po
      JOIN supported_tokens st ON po.token_address = st.token_address
      WHERE po.created_at >= $1
      ${tokenAddress ? 'AND po.token_address = $2' : ''}
      GROUP BY po.operation_type, st.symbol
      ORDER BY count DESC
    `, tokenAddress ? [startTime.toISOString(), tokenAddress.toLowerCase()] : [startTime.toISOString()]);

    // Format operations data
    const operations = operationsResult.rows.map(op => ({
      id: op.id,
      swapId: op.swap_request_id,
      type: op.operation_type,
      tokenAddress: op.token_address,
      tokenSymbol: op.symbol,
      tokenName: op.name,
      tokenDecimals: op.decimals,
      amount: op.amount,
      userAddress: op.user_address,
      swapStatus: op.swap_status,
      txHash: op.tx_hash,
      timestamp: op.created_at,
      relatedSwap: op.swap_request_id ? {
        id: op.swap_request_id,
        userAddress: op.user_address,
        sourceAmount: op.source_amount,
        expectedAmount: op.expected_amount,
        status: op.swap_status
      } : null
    }));

    return NextResponse.json({
      operations,
      pagination: {
        total: totalOperations,
        limit,
        offset,
        hasMore: offset + limit < totalOperations
      },
      summary: summaryQuery.rows,
      timeframe,
      filters: {
        tokenAddress,
        operationType,
        startTime: startTime.toISOString()
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching pool operations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool operations' },
      { status: 500, headers: corsHeaders }
    );
  }
}