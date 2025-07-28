import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { getDatabase, SwapRecord, SwapEvent, SwapStatus, SwapEventType } from './database';
import { 
  generatePreimage, 
  generateHashlock, 
  generateHTLCId, 
  calculateTimelock,
  EvmHTLCClient,
  CosmosHTLCClient,
  evmChains,
  cosmosChains,
  CreateHTLCParams
} from '../../../packages/shared/src';

export interface SwapRequest {
  fromChain: string;
  toChain: string;
  amount: string;
  beneficiary: string;
  timelock?: number;
  privateKey?: string;
  mnemonic?: string;
  dryRun?: boolean;
}

export interface SwapResponse {
  id: string;
  status: SwapStatus;
  message: string;
}

export class OrchestratorService extends EventEmitter {
  private db = getDatabase();
  private activeSwaps = new Map<string, AbortController>();

  async executeSwap(request: SwapRequest): Promise<SwapResponse> {
    const swapId = `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      // Create swap record
      const swapRecord = this.db.createSwap({
        id: swapId,
        fromChain: request.fromChain,
        toChain: request.toChain,
        amount: request.amount,
        beneficiary: request.beneficiary,
        timelock: request.timelock || 3600,
        status: 'initiated'
      });

      // Emit initiated event
      this.emitEvent(swapId, 'INITIATED', { request });

      // Start swap execution in background
      this.executeSwapAsync(swapId, request).catch(error => {
        console.error(`Swap ${swapId} failed:`, error);
        this.updateSwapStatus(swapId, 'failed', error.message);
        this.emitEvent(swapId, 'FAILED', { error: error.message });
      });

      return {
        id: swapId,
        status: 'initiated',
        message: 'Swap initiated successfully'
      };

    } catch (error) {
      console.error('Failed to initiate swap:', error);
      throw new Error(`Failed to initiate swap: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeSwapAsync(swapId: string, request: SwapRequest): Promise<void> {
    const abortController = new AbortController();
    this.activeSwaps.set(swapId, abortController);

    try {
      // Step 1: Generate parameters
      this.updateSwapStatus(swapId, 'generating_params');
      this.emitEvent(swapId, 'PARAMS_GENERATED', { message: 'Generating swap parameters...' });

      const preimage = generatePreimage();
      const hashlock = generateHashlock(preimage);
      const timelock = calculateTimelock(request.timelock || 3600);
      const nonce = Date.now().toString();

      const srcHTLCId = generateHTLCId({
        srcChain: request.fromChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
        dstChain: request.toChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
        nonce,
        hashlock
      });

      const dstHTLCId = generateHTLCId({
        srcChain: request.toChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
        dstChain: request.fromChain === 'sepolia' ? evmChains.sepolia.chainId : cosmosChains.cosmosTestnet.chainId,
        nonce,
        hashlock
      });

      // Update swap with generated parameters
      this.db.updateSwap(swapId, {
        preimage,
        hashlock,
        srcHTLCId,
        dstHTLCId
      });

      this.emitEvent(swapId, 'PARAMS_GENERATED', { 
        preimage, 
        hashlock, 
        srcHTLCId, 
        dstHTLCId,
        timelock 
      });

      if (request.dryRun) {
        this.updateSwapStatus(swapId, 'completed');
        this.emitEvent(swapId, 'COMPLETE', { message: 'Dry run completed successfully' });
        return;
      }

      // Step 2: Initialize clients
      const { srcClient, dstClient } = await this.initializeClients(request);

      // Step 3: Create source HTLC
      this.updateSwapStatus(swapId, 'creating_src_htlc');
      this.emitEvent(swapId, 'LOCK_SRC', { message: 'Creating HTLC on source chain...' });

      const srcTxHash = await this.createSourceHTLC(srcClient, request, srcHTLCId, hashlock, timelock);
      
      this.db.updateSwap(swapId, { srcTxHash });
      this.emitEvent(swapId, 'LOCK_SRC', { 
        message: 'Source HTLC created successfully',
        txHash: srcTxHash,
        htlcId: srcHTLCId
      });

      // Step 4: Create destination HTLC
      this.updateSwapStatus(swapId, 'creating_dst_htlc');
      this.emitEvent(swapId, 'LOCK_DST', { message: 'Creating HTLC on destination chain...' });

      const dstTxHash = await this.createDestinationHTLC(dstClient, request, dstHTLCId, hashlock, timelock);
      
      this.db.updateSwap(swapId, { dstTxHash });
      this.emitEvent(swapId, 'LOCK_DST', { 
        message: 'Destination HTLC created successfully',
        txHash: dstTxHash,
        htlcId: dstHTLCId
      });

      // Step 5: Claim destination HTLC
      this.updateSwapStatus(swapId, 'claiming_dst');
      this.emitEvent(swapId, 'CLAIM_DST', { message: 'Claiming destination HTLC...' });

      const claimDstTxHash = await this.claimHTLC(dstClient, request.toChain, dstHTLCId, preimage);
      
      this.db.updateSwap(swapId, { claimDstTxHash });
      this.emitEvent(swapId, 'CLAIM_DST', { 
        message: 'Destination HTLC claimed successfully',
        txHash: claimDstTxHash,
        preimageRevealed: preimage
      });

      // Step 6: Claim source HTLC
      this.updateSwapStatus(swapId, 'claiming_src');
      this.emitEvent(swapId, 'CLAIM_SRC', { message: 'Claiming source HTLC...' });

      const claimSrcTxHash = await this.claimHTLC(srcClient, request.fromChain, srcHTLCId, preimage);
      
      this.db.updateSwap(swapId, { claimSrcTxHash });
      this.emitEvent(swapId, 'CLAIM_SRC', { 
        message: 'Source HTLC claimed successfully',
        txHash: claimSrcTxHash
      });

      // Step 7: Complete
      this.updateSwapStatus(swapId, 'completed');
      this.emitEvent(swapId, 'COMPLETE', { 
        message: 'Cross-chain atomic swap completed successfully!',
        summary: {
          srcHTLCId,
          dstHTLCId,
          amount: request.amount,
          preimage
        }
      });

    } catch (error) {
      console.error(`Swap ${swapId} execution failed:`, error);
      this.updateSwapStatus(swapId, 'failed', error instanceof Error ? error.message : String(error));
      this.emitEvent(swapId, 'FAILED', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      this.activeSwaps.delete(swapId);
    }
  }

  private async initializeClients(request: SwapRequest) {
    // This is a simplified version - you'll need to implement proper client initialization
    // based on your existing CLI logic
    
    let srcClient: any;
    let dstClient: any;

    if (request.fromChain === 'sepolia') {
      srcClient = new EvmHTLCClient(evmChains.sepolia.rpcUrl);
    } else if (request.fromChain === 'polygonAmoy') {
      srcClient = new EvmHTLCClient(evmChains.polygonAmoy.rpcUrl);
    } else {
      srcClient = new CosmosHTLCClient(cosmosChains.cosmosTestnet.rpcUrl);
    }

    if (request.toChain === 'sepolia') {
      dstClient = new EvmHTLCClient(evmChains.sepolia.rpcUrl);
    } else if (request.toChain === 'polygonAmoy') {
      dstClient = new EvmHTLCClient(evmChains.polygonAmoy.rpcUrl);
    } else {
      dstClient = new CosmosHTLCClient(cosmosChains.cosmosTestnet.rpcUrl);
    }

    return { srcClient, dstClient };
  }

  private async createSourceHTLC(client: any, request: SwapRequest, htlcId: string, hashlock: string, timelock: number): Promise<string> {
    // Mock implementation - replace with actual HTLC creation
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction time
    return `0x${Math.random().toString(16).slice(2, 66)}`;
  }

  private async createDestinationHTLC(client: any, request: SwapRequest, htlcId: string, hashlock: string, timelock: number): Promise<string> {
    // Mock implementation - replace with actual HTLC creation
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction time
    return `0x${Math.random().toString(16).slice(2, 66)}`;
  }

  private async claimHTLC(client: any, chain: string, htlcId: string, preimage: string): Promise<string> {
    // Mock implementation - replace with actual HTLC claiming
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate transaction time
    return `0x${Math.random().toString(16).slice(2, 66)}`;
  }

  private updateSwapStatus(swapId: string, status: SwapStatus, errorMessage?: string) {
    this.db.updateSwap(swapId, { status, errorMessage });
  }

  private emitEvent(swapId: string, type: SwapEventType, data?: any) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const event = this.db.addEvent({
      id: eventId,
      swapId,
      type,
      data,
      txHash: data?.txHash
    });

    // Emit to SSE clients
    this.emit('swap-event', { swapId, event });
    this.emit(`swap-event-${swapId}`, event);
  }

  getSwap(id: string): SwapRecord | null {
    return this.db.getSwap(id);
  }

  getSwaps(limit?: number, offset?: number): SwapRecord[] {
    return this.db.getSwaps(limit, offset);
  }

  getSwapEvents(swapId: string): SwapEvent[] {
    return this.db.getEvents(swapId);
  }

  cancelSwap(swapId: string): boolean {
    const controller = this.activeSwaps.get(swapId);
    if (controller) {
      controller.abort();
      this.activeSwaps.delete(swapId);
      this.updateSwapStatus(swapId, 'failed', 'Cancelled by user');
      this.emitEvent(swapId, 'FAILED', { error: 'Cancelled by user' });
      return true;
    }
    return false;
  }
}

// Singleton instance
let orchestratorInstance: OrchestratorService | null = null;

export function getOrchestrator(): OrchestratorService {
  if (!orchestratorInstance) {
    orchestratorInstance = new OrchestratorService();
  }
  return orchestratorInstance;
} 