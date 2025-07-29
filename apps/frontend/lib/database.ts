import { Pool } from 'pg'

// Database schema and types
export interface SwapRecord {
  id: string
  fromChain: string
  toChain: string
  amount: string
  beneficiary: string
  timelock: number
  slippage: number
  dryRun: boolean
  status: string
  createdAt: number
  updatedAt: number
  srcTxHash?: string
  dstTxHash?: string
  claimSrcTxHash?: string
  claimDstTxHash?: string
  errorMessage?: string
}

export interface SwapEvent {
  id: string
  swapId: string
  type: string
  data: Record<string, unknown>
  timestamp: number
}

class SwapDatabase {
  private pool: Pool

  constructor() {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/swapsage'
    
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.initTables()
  }

  private async initTables() {
    const client = await this.pool.connect()
    try {
      // Create swaps table
      await client.query(`
        CREATE TABLE IF NOT EXISTS swaps (
          id TEXT PRIMARY KEY,
          "fromChain" TEXT NOT NULL,
          "toChain" TEXT NOT NULL,
          amount TEXT NOT NULL,
          beneficiary TEXT NOT NULL,
          timelock INTEGER NOT NULL,
          slippage REAL NOT NULL,
          "dryRun" BOOLEAN NOT NULL,
          status TEXT NOT NULL,
          "createdAt" BIGINT NOT NULL,
          "updatedAt" BIGINT NOT NULL,
          "srcTxHash" TEXT,
          "dstTxHash" TEXT,
          "claimSrcTxHash" TEXT,
          "claimDstTxHash" TEXT,
          "errorMessage" TEXT
        )
      `)

      // Create events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS swap_events (
          id TEXT PRIMARY KEY,
          "swapId" TEXT NOT NULL,
          type TEXT NOT NULL,
          data JSONB NOT NULL,
          "timestamp" BIGINT NOT NULL,
          FOREIGN KEY ("swapId") REFERENCES swaps (id)
        )
      `)

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps (status)
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps ("createdAt")
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_events_swap_id ON swap_events ("swapId")
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON swap_events ("timestamp")
      `)
    } finally {
      client.release()
    }
  }

  // Swap operations
  async createSwap(swap: SwapRecord): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(`
        INSERT INTO swaps (
          id, "fromChain", "toChain", amount, beneficiary, timelock, slippage, "dryRun",
          status, "createdAt", "updatedAt", "srcTxHash", "dstTxHash", "claimSrcTxHash", "claimDstTxHash", "errorMessage"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        swap.id,
        swap.fromChain,
        swap.toChain,
        swap.amount,
        swap.beneficiary,
        swap.timelock,
        swap.slippage,
        swap.dryRun,
        swap.status,
        swap.createdAt,
        swap.updatedAt,
        swap.srcTxHash,
        swap.dstTxHash,
        swap.claimSrcTxHash,
        swap.claimDstTxHash,
        swap.errorMessage
      ])
    } finally {
      client.release()
    }
  }

  async getSwap(id: string): Promise<SwapRecord | undefined> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM swaps WHERE id = $1', [id])
      
      if (result.rows.length === 0) return undefined

      const row = result.rows[0]
      return {
        id: row.id,
        fromChain: row.fromChain,
        toChain: row.toChain,
        amount: row.amount,
        beneficiary: row.beneficiary,
        timelock: row.timelock,
        slippage: row.slippage,
        dryRun: row.dryRun,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        srcTxHash: row.srcTxHash,
        dstTxHash: row.dstTxHash,
        claimSrcTxHash: row.claimSrcTxHash,
        claimDstTxHash: row.claimDstTxHash,
        errorMessage: row.errorMessage
      }
    } finally {
      client.release()
    }
  }

  async getAllSwaps(): Promise<SwapRecord[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM swaps ORDER BY "createdAt" DESC')
      
      return result.rows.map(row => ({
        id: row.id,
        fromChain: row.fromChain,
        toChain: row.toChain,
        amount: row.amount,
        beneficiary: row.beneficiary,
        timelock: row.timelock,
        slippage: row.slippage,
        dryRun: row.dryRun,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        srcTxHash: row.srcTxHash,
        dstTxHash: row.dstTxHash,
        claimSrcTxHash: row.claimSrcTxHash,
        claimDstTxHash: row.claimDstTxHash,
        errorMessage: row.errorMessage
      }))
    } finally {
      client.release()
    }
  }

  async updateSwap(id: string, updates: Partial<SwapRecord>): Promise<void> {
    const client = await this.pool.connect()
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id')
      const setClause = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ')
      const values = fields.map(field => updates[field as keyof SwapRecord])
      
      await client.query(`
        UPDATE swaps SET ${setClause}, "updatedAt" = $${fields.length + 2} WHERE id = $1
      `, [id, ...values, Date.now()])
    } finally {
      client.release()
    }
  }

  async deleteSwap(id: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      
      // Delete associated events first
      await client.query('DELETE FROM swap_events WHERE "swapId" = $1', [id])
      
      // Delete swap
      await client.query('DELETE FROM swaps WHERE id = $1', [id])
      
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Event operations
  async createEvent(event: SwapEvent): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(`
        INSERT INTO swap_events (id, "swapId", type, data, "timestamp")
        VALUES ($1, $2, $3, $4, $5)
      `, [
        event.id,
        event.swapId,
        event.type,
        JSON.stringify(event.data),
        event.timestamp
      ])
    } finally {
      client.release()
    }
  }

  // Transaction wrapper for atomic operations
  async createSwapWithEvent(swap: SwapRecord, event: SwapEvent): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      
      // Create swap first
      await client.query(`
        INSERT INTO swaps (
          id, "fromChain", "toChain", amount, beneficiary, timelock, slippage, "dryRun",
          status, "createdAt", "updatedAt", "srcTxHash", "dstTxHash", "claimSrcTxHash", "claimDstTxHash", "errorMessage"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        swap.id,
        swap.fromChain,
        swap.toChain,
        swap.amount,
        swap.beneficiary,
        swap.timelock,
        swap.slippage,
        swap.dryRun,
        swap.status,
        swap.createdAt,
        swap.updatedAt,
        swap.srcTxHash,
        swap.dstTxHash,
        swap.claimSrcTxHash,
        swap.claimDstTxHash,
        swap.errorMessage
      ])

      // Then create event
      await client.query(`
        INSERT INTO swap_events (id, "swapId", type, data, "timestamp")
        VALUES ($1, $2, $3, $4, $5)
      `, [
        event.id,
        event.swapId,
        event.type,
        JSON.stringify(event.data),
        event.timestamp
      ])
      
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getEventsForSwap(swapId: string): Promise<SwapEvent[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM swap_events WHERE "swapId" = $1 ORDER BY "timestamp" ASC', [swapId])
      
      return result.rows.map(row => ({
        id: row.id,
        swapId: row.swapId,
        type: row.type,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        timestamp: row.timestamp
      }))
    } finally {
      client.release()
    }
  }

  // Get all swaps
  async getSwaps(): Promise<SwapRecord[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT * FROM swaps ORDER BY "createdAt" DESC')
      
      return result.rows.map(row => ({
        id: row.id,
        fromChain: row.fromChain,
        toChain: row.toChain,
        amount: row.amount,
        beneficiary: row.beneficiary,
        timelock: row.timelock,
        slippage: row.slippage,
        dryRun: row.dryRun,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        srcTxHash: row.srcTxHash,
        dstTxHash: row.dstTxHash,
        claimSrcTxHash: row.claimSrcTxHash,
        claimDstTxHash: row.claimDstTxHash,
        errorMessage: row.errorMessage
      }))
    } finally {
      client.release()
    }
  }

  // Alias for getEventsForSwap to match orchestrator interface
  async getSwapEvents(swapId: string): Promise<SwapEvent[]> {
    return this.getEventsForSwap(swapId)
  }

  // Transaction wrapper for custom operations
  async transaction(fn: (client: any) => Promise<void>): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await fn(client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Utility methods
  async close(): Promise<void> {
    await this.pool.end()
  }
}

// Export singleton instance
export const swapDatabase = new SwapDatabase() 