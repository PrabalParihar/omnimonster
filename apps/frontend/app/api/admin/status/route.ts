import { NextResponse } from 'next/server';
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../../../../../../packages/shared/src/database';
import { ethers } from 'ethers';
import { GasMonitor } from '../../../../../../packages/shared/src/resolver/gas-monitor';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  let database: FusionDatabase | null = null;
  
  try {
    // Initialize default response structure
    const defaultStatus = {
      swaps: {
        total: 0,
        pending: 0,
        completed: 0,
        failed: 0
      },
      gasBalances: [] as any[],
      recentErrors: [] as any[]
    };

    // Try to get database connection
    try {
      const dbConfig = getDatabaseConfig();
      database = FusionDatabase.getInstance(dbConfig);
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      // Return default status if DB is down
      return NextResponse.json({
        ...defaultStatus,
        error: 'Database connection failed'
      }, { headers: corsHeaders });
    }

    const dao = new FusionDAO(database);
    
    // Get swap statistics with error handling
    let swapStats = { rows: [{ total: 0, pending: 0, completed: 0, failed: 0 }] };
    try {
      swapStats = await dao.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'USER_CLAIMED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'CANCELLED' OR status = 'EXPIRED' THEN 1 END) as failed
        FROM swap_requests
      `);
    } catch (queryError) {
      console.error('Failed to get swap stats:', queryError);
    }
    
    // Check gas balances with error handling
    let gasBalances: any[] = [];
    try {
      const gasMonitor = new GasMonitor();
      const poolWalletKey = process.env.POOL_WALLET_PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
      const poolWallet = new ethers.Wallet(poolWalletKey);
      
      const chains = [
        { name: 'sepolia', rpc: 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3' },
        { name: 'monadTestnet', rpc: 'https://testnet-rpc.monad.xyz' },
        { name: 'polygonAmoy', rpc: 'https://rpc-amoy.polygon.technology' }
      ];
      
      gasBalances = await Promise.all(
        chains.map(async (chain) => {
          try {
            const provider = new ethers.JsonRpcProvider(chain.rpc);
            const balance = await gasMonitor.checkGasBalance(provider, poolWallet.address, chain.name);
            return {
              chain: chain.name,
              balance: balance.formatted,
              isLow: balance.isLow,
              address: poolWallet.address
            };
          } catch (error) {
            console.error(`Failed to check gas for ${chain.name}:`, error);
            return {
              chain: chain.name,
              balance: 'Error',
              isLow: true,
              address: poolWallet.address
            };
          }
        })
      );
    } catch (gasError) {
      console.error('Failed to check gas balances:', gasError);
    }
    
    // Get recent errors with error handling
    let recentErrors: any[] = [];
    try {
      const errorResult = await dao.query(`
        SELECT 
          created_at as time,
          error_message as message,
          swap_request_id as swap_id
        FROM resolver_operations
        WHERE status = 'FAILED' 
          AND error_message IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      recentErrors = errorResult.rows.map((row: any) => ({
        time: new Date(row.time).toLocaleString(),
        message: row.message || 'Unknown error',
        swapId: row.swap_id
      }));
    } catch (errorQuery) {
      console.error('Failed to get recent errors:', errorQuery);
    }
    
    const status = {
      swaps: {
        total: parseInt(swapStats.rows[0]?.total || '0'),
        pending: parseInt(swapStats.rows[0]?.pending || '0'),
        completed: parseInt(swapStats.rows[0]?.completed || '0'),
        failed: parseInt(swapStats.rows[0]?.failed || '0')
      },
      gasBalances,
      recentErrors
    };
    
    return NextResponse.json(status, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Unexpected error in status API:', error);
    return NextResponse.json({
      swaps: { total: 0, pending: 0, completed: 0, failed: 0 },
      gasBalances: [],
      recentErrors: [],
      error: 'Internal server error'
    }, { status: 500, headers: corsHeaders });
  } finally {
    // Close database connection if needed
    if (database) {
      try {
        await database.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}