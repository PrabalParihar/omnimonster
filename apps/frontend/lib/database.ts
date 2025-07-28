import Database from 'better-sqlite3';
import path from 'path';
import { existsSync } from 'fs';

export interface SwapRecord {
  id: string;
  fromChain: string;
  toChain: string;
  amount: string;
  beneficiary: string;
  timelock: number;
  status: SwapStatus;
  createdAt: number;
  updatedAt: number;
  srcHTLCId?: string;
  dstHTLCId?: string;
  preimage?: string;
  hashlock?: string;
  srcTxHash?: string;
  dstTxHash?: string;
  claimSrcTxHash?: string;
  claimDstTxHash?: string;
  errorMessage?: string;
}

export type SwapStatus = 
  | 'initiated'
  | 'generating_params'
  | 'creating_src_htlc'
  | 'creating_dst_htlc'
  | 'claiming_dst'
  | 'claiming_src'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface SwapEvent {
  id: string;
  swapId: string;
  type: SwapEventType;
  timestamp: number;
  data?: any;
  txHash?: string;
}

export type SwapEventType =
  | 'INITIATED'
  | 'PARAMS_GENERATED'
  | 'LOCK_SRC'
  | 'LOCK_DST'
  | 'CLAIM_DST'
  | 'CLAIM_SRC'
  | 'COMPLETE'
  | 'FAILED'
  | 'REFUNDED';

class SwapDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'swaps.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Create swaps table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swaps (
        id TEXT PRIMARY KEY,
        fromChain TEXT NOT NULL,
        toChain TEXT NOT NULL,
        amount TEXT NOT NULL,
        beneficiary TEXT NOT NULL,
        timelock INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'initiated',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        srcHTLCId TEXT,
        dstHTLCId TEXT,
        preimage TEXT,
        hashlock TEXT,
        srcTxHash TEXT,
        dstTxHash TEXT,
        claimSrcTxHash TEXT,
        claimDstTxHash TEXT,
        errorMessage TEXT
      )
    `);

    // Create swap_events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swap_events (
        id TEXT PRIMARY KEY,
        swapId TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT,
        txHash TEXT,
        FOREIGN KEY (swapId) REFERENCES swaps (id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
      CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps(createdAt);
      CREATE INDEX IF NOT EXISTS idx_swap_events_swap_id ON swap_events(swapId);
      CREATE INDEX IF NOT EXISTS idx_swap_events_timestamp ON swap_events(timestamp);
    `);
  }

  // Swap operations
  createSwap(swap: Omit<SwapRecord, 'createdAt' | 'updatedAt'>): SwapRecord {
    const now = Date.now();
    const record: SwapRecord = {
      ...swap,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO swaps (
        id, fromChain, toChain, amount, beneficiary, timelock, status,
        createdAt, updatedAt, srcHTLCId, dstHTLCId, preimage, hashlock,
        srcTxHash, dstTxHash, claimSrcTxHash, claimDstTxHash, errorMessage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.fromChain,
      record.toChain,
      record.amount,
      record.beneficiary,
      record.timelock,
      record.status,
      record.createdAt,
      record.updatedAt,
      record.srcHTLCId || null,
      record.dstHTLCId || null,
      record.preimage || null,
      record.hashlock || null,
      record.srcTxHash || null,
      record.dstTxHash || null,
      record.claimSrcTxHash || null,
      record.claimDstTxHash || null,
      record.errorMessage || null
    );

    return record;
  }

  updateSwap(id: string, updates: Partial<SwapRecord>): SwapRecord | null {
    const existing = this.getSwap(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: Date.now() };

    const stmt = this.db.prepare(`
      UPDATE swaps SET
        status = ?, updatedAt = ?, srcHTLCId = ?, dstHTLCId = ?, preimage = ?,
        hashlock = ?, srcTxHash = ?, dstTxHash = ?, claimSrcTxHash = ?,
        claimDstTxHash = ?, errorMessage = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.status,
      updated.updatedAt,
      updated.srcHTLCId || null,
      updated.dstHTLCId || null,
      updated.preimage || null,
      updated.hashlock || null,
      updated.srcTxHash || null,
      updated.dstTxHash || null,
      updated.claimSrcTxHash || null,
      updated.claimDstTxHash || null,
      updated.errorMessage || null,
      id
    );

    return updated;
  }

  getSwap(id: string): SwapRecord | null {
    const stmt = this.db.prepare('SELECT * FROM swaps WHERE id = ?');
    const row = stmt.get(id) as SwapRecord | undefined;
    return row || null;
  }

  getSwaps(limit = 50, offset = 0): SwapRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM swaps 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as SwapRecord[];
  }

  getSwapsByStatus(status: SwapStatus): SwapRecord[] {
    const stmt = this.db.prepare('SELECT * FROM swaps WHERE status = ? ORDER BY createdAt DESC');
    return stmt.all(status) as SwapRecord[];
  }

  // Event operations
  addEvent(event: Omit<SwapEvent, 'timestamp'>): SwapEvent {
    const fullEvent: SwapEvent = {
      ...event,
      timestamp: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO swap_events (id, swapId, type, timestamp, data, txHash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullEvent.id,
      fullEvent.swapId,
      fullEvent.type,
      fullEvent.timestamp,
      fullEvent.data ? JSON.stringify(fullEvent.data) : null,
      fullEvent.txHash || null
    );

    return fullEvent;
  }

  getEvents(swapId: string): SwapEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM swap_events 
      WHERE swapId = ? 
      ORDER BY timestamp ASC
    `);
    
    const rows = stmt.all(swapId) as any[];
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : undefined,
    }));
  }

  // Cleanup old events (optional, for maintenance)
  cleanupOldEvents(daysOld = 30) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM swap_events WHERE timestamp < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: SwapDatabase | null = null;

export function getDatabase(): SwapDatabase {
  if (!dbInstance) {
    dbInstance = new SwapDatabase();
  }
  return dbInstance;
}

export { SwapDatabase }; 