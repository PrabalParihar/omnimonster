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

// Get resolver status and metrics
export async function GET(request: NextRequest) {
  try {
    const db = FusionDatabase.getInstance(getDatabaseConfig());
    const dao = new FusionDAO(db);

    // Get pending swaps count
    const pendingSwaps = await dao.getPendingSwaps(1000);
    const queueSize = pendingSwaps.length;

    // Get resolver operation metrics for the last 24 hours
    const operationMetrics = await dao.query(`
      SELECT 
        operation_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))) as avg_duration
      FROM resolver_operations 
      WHERE started_at > NOW() - INTERVAL '24 hours'
      GROUP BY operation_type, status
      ORDER BY operation_type, status
    `);

    // Get overall success metrics
    const successMetrics = await dao.query(`
      SELECT 
        COUNT(*) as total_operations,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful_operations,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_operations,
        AVG(CASE WHEN status = 'COMPLETED' 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) 
            ELSE NULL END) as avg_processing_time
      FROM resolver_operations 
      WHERE started_at > NOW() - INTERVAL '24 hours'
        AND operation_type = 'FINALIZE'
    `);

    // Get swap completion metrics
    const swapMetrics = await dao.query(`
      SELECT 
        COUNT(*) as total_swaps,
        SUM(CASE WHEN status = 'POOL_FULFILLED' THEN 1 ELSE 0 END) as pool_fulfilled,
        SUM(CASE WHEN status = 'USER_CLAIMED' THEN 1 ELSE 0 END) as user_claimed,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_swaps,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_swaps,
        AVG(CASE WHEN status = 'POOL_FULFILLED' AND pool_claimed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (pool_claimed_at - created_at)) 
            ELSE NULL END) as avg_fulfillment_time
      FROM swap_requests 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // Get current processing status
    const currentlyProcessing = await dao.query(`
      SELECT COUNT(*) as count
      FROM resolver_operations 
      WHERE status = 'IN_PROGRESS'
    `);

    // Get error analysis
    const errorAnalysis = await dao.query(`
      SELECT 
        error_message,
        COUNT(*) as count
      FROM resolver_operations 
      WHERE status = 'FAILED' 
        AND started_at > NOW() - INTERVAL '24 hours'
        AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 10
    `);

    const successData = successMetrics.rows[0];
    const swapData = swapMetrics.rows[0];
    const totalOperations = parseInt(successData?.total_operations || '0');
    const successfulOperations = parseInt(successData?.successful_operations || '0');
    const totalSwaps = parseInt(swapData?.total_swaps || '0');
    const poolFulfilled = parseInt(swapData?.pool_fulfilled || '0');

    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
    const fulfillmentRate = totalSwaps > 0 ? (poolFulfilled / totalSwaps) * 100 : 0;

    // Determine if resolver is currently processing
    const isCurrentlyProcessing = parseInt(currentlyProcessing.rows[0]?.count || '0') > 0;

    // Get last successful operation time
    const lastSuccessful = await dao.query(`
      SELECT completed_at
      FROM resolver_operations 
      WHERE status = 'COMPLETED'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    return NextResponse.json({
      processing: isCurrentlyProcessing,
      queueSize,
      lastProcessedAt: lastSuccessful.rows[0]?.completed_at || null,
      metrics: {
        swapsProcessed24h: totalSwaps,
        poolFulfillments24h: poolFulfilled,
        avgProcessingTime: parseFloat(successData?.avg_processing_time || '0'),
        avgFulfillmentTime: parseFloat(swapData?.avg_fulfillment_time || '0'),
        successRate: Math.round(successRate * 100) / 100,
        fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
        totalOperations,
        successfulOperations,
        failedOperations: parseInt(successData?.failed_operations || '0')
      },
      operationBreakdown: operationMetrics.rows,
      swapStatusBreakdown: {
        total: totalSwaps,
        poolFulfilled: poolFulfilled,
        userClaimed: parseInt(swapData?.user_claimed || '0'),
        expired: parseInt(swapData?.expired_swaps || '0'),
        cancelled: parseInt(swapData?.cancelled_swaps || '0')
      },
      recentErrors: errorAnalysis.rows,
      health: {
        status: successRate >= 95 ? 'HEALTHY' : successRate >= 80 ? 'WARNING' : 'CRITICAL',
        queueHealth: queueSize < 10 ? 'HEALTHY' : queueSize < 50 ? 'WARNING' : 'CRITICAL',
        processingHealth: isCurrentlyProcessing ? 'ACTIVE' : 'IDLE'
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching resolver status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resolver status' },
      { status: 500, headers: corsHeaders }
    );
  }
}