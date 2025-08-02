import { PoolClient } from 'pg';
import { 
  FusionDatabase, 
  UserAuth, 
  SwapRequest, 
  SwapStatus, 
  PoolLiquidity, 
  ResolverOperation, 
  ResolverOperationType,
  OperationStatus,
  GaslessClaim,
  SupportedToken
} from './index';
import { v4 as uuidv4 } from 'uuid';

export class FusionDAO {
  constructor(private db: FusionDatabase) {}

  // Direct query method for complex queries
  async query(text: string, params?: any[]): Promise<any> {
    return this.db.query(text, params);
  }

  // User Authentication Methods
  async createOrUpdateUser(userData: Partial<UserAuth>): Promise<UserAuth> {
    const query = `
      INSERT INTO user_auth (
        web3auth_user_id, email, name, profile_image, login_provider, 
        wallet_address, is_social_login, last_login
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (web3auth_user_id) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        profile_image = EXCLUDED.profile_image,
        last_login = NOW()
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      userData.web3authUserId,
      userData.email,
      userData.name,
      userData.profileImage,
      userData.loginProvider,
      userData.walletAddress,
      userData.isSocialLogin
    ]);
    
    return result.rows[0];
  }

  async getUserByWallet(walletAddress: string): Promise<UserAuth | null> {
    const query = 'SELECT * FROM user_auth WHERE wallet_address = $1';
    const result = await this.db.query(query, [walletAddress]);
    return result.rows[0] || null;
  }

  async getUserByWeb3AuthId(web3authUserId: string): Promise<UserAuth | null> {
    const query = 'SELECT * FROM user_auth WHERE web3auth_user_id = $1';
    const result = await this.db.query(query, [web3authUserId]);
    return result.rows[0] || null;
  }

  // Swap Request Methods
  async createSwapRequest(swapData: Partial<SwapRequest>): Promise<SwapRequest> {
    const id = swapData.id || uuidv4(); // Use provided ID or generate new one
    const query = `
      INSERT INTO swap_requests (
        id, user_address, source_token, source_amount, target_token,
        expected_amount, slippage_tolerance, hash_lock, preimage_hash,
        expiration_time, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      swapData.userAddress,
      swapData.sourceToken,
      swapData.sourceAmount,
      swapData.targetToken,
      swapData.expectedAmount,
      swapData.slippageTolerance,
      swapData.hashLock,
      swapData.preimageHash,
      swapData.expirationTime,
      swapData.status || SwapStatus.PENDING
    ]);
    
    return this.transformDbRowToSwapRequest(result.rows[0]);
  }

  async updateSwapRequest(id: string, updates: Partial<SwapRequest>): Promise<SwapRequest | null> {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE swap_requests 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    values.push(id);
    const result = await this.db.query(query, values);
    const row = result.rows[0];
    return row ? this.transformDbRowToSwapRequest(row) : null;
  }

  async getSwapRequest(id: string): Promise<SwapRequest | null> {
    const query = 'SELECT * FROM swap_requests WHERE id = $1';
    const result = await this.db.query(query, [id]);
    const row = result.rows[0];
    return row ? this.transformDbRowToSwapRequest(row) : null;
  }

  async getSwapsByUser(userAddress: string, status?: SwapStatus): Promise<SwapRequest[]> {
    let query = 'SELECT * FROM swap_requests WHERE user_address = $1';
    const params = [userAddress];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.transformDbRowToSwapRequest(row));
  }

  async getPendingSwaps(limit: number = 10): Promise<SwapRequest[]> {
    const query = `
      SELECT * FROM swap_requests 
      WHERE status = 'PENDING' 
      AND user_htlc_contract IS NOT NULL 
      AND user_htlc_contract != ''
      ORDER BY created_at ASC 
      LIMIT $1
    `;
    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => this.transformDbRowToSwapRequest(row));
  }

  // Pool Liquidity Methods
  async getPoolLiquidity(tokenAddress: string): Promise<PoolLiquidity | null> {
    const query = 'SELECT * FROM pool_liquidity WHERE token_address = $1';
    const result = await this.db.query(query, [tokenAddress]);
    return result.rows[0] || null;
  }

  async updatePoolLiquidity(tokenAddress: string, updates: Partial<PoolLiquidity>): Promise<PoolLiquidity> {
    const query = `
      INSERT INTO pool_liquidity (token_address, total_balance, available_balance, reserved_balance, min_threshold)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (token_address)
      DO UPDATE SET
        total_balance = EXCLUDED.total_balance,
        available_balance = EXCLUDED.available_balance,
        reserved_balance = EXCLUDED.reserved_balance,
        min_threshold = EXCLUDED.min_threshold,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      tokenAddress,
      updates.totalBalance,
      updates.availableBalance,
      updates.reservedBalance,
      updates.minThreshold
    ]);
    
    return result.rows[0];
  }

  async reservePoolLiquidity(tokenAddress: string, amount: string): Promise<boolean> {
    return await this.db.transaction(async (client: PoolClient) => {
      // Check if sufficient liquidity is available
      const checkQuery = `
        SELECT available_balance FROM pool_liquidity 
        WHERE token_address = $1 AND available_balance >= $2
        FOR UPDATE
      `;
      const checkResult = await client.query(checkQuery, [tokenAddress, amount]);
      
      if (checkResult.rows.length === 0) {
        return false; // Insufficient liquidity
      }

      // Reserve the liquidity
      const updateQuery = `
        UPDATE pool_liquidity 
        SET available_balance = available_balance - $2,
            reserved_balance = reserved_balance + $2,
            updated_at = NOW()
        WHERE token_address = $1
      `;
      await client.query(updateQuery, [tokenAddress, amount]);
      
      return true;
    });
  }

  async releasePoolLiquidity(tokenAddress: string, amount: string): Promise<void> {
    const query = `
      UPDATE pool_liquidity 
      SET available_balance = available_balance + $2,
          reserved_balance = reserved_balance - $2,
          updated_at = NOW()
      WHERE token_address = $1
    `;
    await this.db.query(query, [tokenAddress, amount]);
  }

  // Resolver Operations Methods
  async createResolverOperation(operationData: Partial<ResolverOperation>): Promise<ResolverOperation> {
    const id = uuidv4();
    const query = `
      INSERT INTO resolver_operations (
        id, swap_request_id, operation_type, status, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      operationData.swapRequestId,
      operationData.operationType,
      operationData.status || OperationStatus.PENDING,
      operationData.metadata ? JSON.stringify(operationData.metadata) : null
    ]);
    
    return result.rows[0];
  }

  async updateResolverOperation(id: string, updates: Partial<ResolverOperation>): Promise<ResolverOperation | null> {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'metadata') {
          updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.status === OperationStatus.COMPLETED) {
      updateFields.push(`completed_at = NOW()`);
    }

    const query = `
      UPDATE resolver_operations 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    values.push(id);
    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  async getResolverOperationsBySwap(swapRequestId: string): Promise<ResolverOperation[]> {
    const query = 'SELECT * FROM resolver_operations WHERE swap_request_id = $1 ORDER BY started_at';
    const result = await this.db.query(query, [swapRequestId]);
    return result.rows;
  }

  // Gasless Claims Methods
  async createGaslessClaim(claimData: Partial<GaslessClaim>): Promise<GaslessClaim> {
    const id = uuidv4();
    const query = `
      INSERT INTO gasless_claims (
        id, swap_request_id, claimer_address, htlc_contract, contract_id,
        preimage, signature, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      claimData.swapRequestId,
      claimData.claimerAddress,
      claimData.htlcContract,
      claimData.contractId,
      claimData.preimage,
      claimData.signature,
      claimData.status || OperationStatus.PENDING
    ]);
    
    return result.rows[0];
  }

  async updateGaslessClaim(id: string, updates: Partial<GaslessClaim>): Promise<GaslessClaim | null> {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.status === OperationStatus.COMPLETED) {
      updateFields.push(`executed_at = NOW()`);
    }

    const query = `
      UPDATE gasless_claims 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    values.push(id);
    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  async getPendingGaslessClaims(limit: number = 10): Promise<GaslessClaim[]> {
    const query = `
      SELECT * FROM gasless_claims 
      WHERE status = 'PENDING' 
      ORDER BY created_at ASC 
      LIMIT $1
    `;
    const result = await this.db.query(query, [limit]);
    return result.rows;
  }

  // Supported Tokens Methods
  async getSupportedTokens(chainId?: number): Promise<SupportedToken[]> {
    let query = 'SELECT * FROM supported_tokens WHERE is_active = true';
    const params = [];
    
    if (chainId) {
      query += ' AND chain_id = $1';
      params.push(chainId);
    }
    
    query += ' ORDER BY symbol';
    
    const result = await this.db.query(query, params);
    return result.rows;
  }

  async getSupportedToken(tokenAddress: string): Promise<SupportedToken | null> {
    const query = 'SELECT * FROM supported_tokens WHERE token_address = $1 AND is_active = true';
    const result = await this.db.query(query, [tokenAddress]);
    return result.rows[0] || null;
  }

  // Utility Methods
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // System Health and Metrics
  async getSystemMetrics(): Promise<any> {
    const queries = await Promise.all([
      this.db.query('SELECT COUNT(*) as total_swaps FROM swap_requests'),
      this.db.query("SELECT COUNT(*) as pending_swaps FROM swap_requests WHERE status = 'PENDING'"),
      this.db.query("SELECT COUNT(*) as completed_swaps FROM swap_requests WHERE status = 'USER_CLAIMED'"),
      this.db.query('SELECT COUNT(*) as total_users FROM user_auth'),
      this.db.query("SELECT COUNT(*) as pending_claims FROM gasless_claims WHERE status = 'PENDING'")
    ]);

    return {
      totalSwaps: parseInt(queries[0].rows[0].total_swaps),
      pendingSwaps: parseInt(queries[1].rows[0].pending_swaps),
      completedSwaps: parseInt(queries[2].rows[0].completed_swaps),
      totalUsers: parseInt(queries[3].rows[0].total_users),
      pendingClaims: parseInt(queries[4].rows[0].pending_claims)
    };
  }

  // Test connection method for CLI testing
  async testConnection(): Promise<any> {
    try {
      const result = await this.db.query('SELECT NOW() as current_time, version() as postgres_version');
      return {
        connected: true,
        timestamp: result.rows[0].current_time,
        version: result.rows[0].postgres_version
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Database connection failed: ${errorMessage}`);
    }
  }

  // Utility methods for case conversion
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  // Transform database row to SwapRequest object
  private transformDbRowToSwapRequest(row: any): SwapRequest {
    return {
      id: row.id,
      userAddress: row.user_address,
      sourceToken: row.source_token,
      sourceAmount: row.source_amount,
      targetToken: row.target_token,
      expectedAmount: row.expected_amount,
      slippageTolerance: row.slippage_tolerance,
      userHtlcContract: row.user_htlc_contract,
      poolHtlcContract: row.pool_htlc_contract,
      hashLock: row.hash_lock,
      preimageHash: row.preimage_hash,
      expirationTime: row.expiration_time,
      status: row.status,
      poolClaimedAt: row.pool_claimed_at,
      userClaimedAt: row.user_claimed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default FusionDAO;