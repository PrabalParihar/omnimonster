"use client";

import { blockchainService } from './production-blockchain-service';

export interface ClientSwapParams {
  fromChain: string;
  fromToken: string;
  toChain: string;
  toToken: string;
  amount: string;
  beneficiary: string;
  timelock?: number;
  slippage?: number;
  dryRun?: boolean;
}

export interface ClientSwapResult {
  id: string;
  status: string;
  userAddress?: string;
  hashLock?: string;
  contractId?: string;
  htlcAddress?: string;
  transactionHash?: string;
  error?: string;
}

export class ProductionClientSwapService {
  /**
   * Create a production-ready swap with proper error handling
   */
  async createSwap(params: ClientSwapParams): Promise<ClientSwapResult> {
    console.log('🚀 Creating production swap:', params);

    try {
      // Step 1: Create initial swap record via API
      console.log('📝 Step 1: Creating swap record...');
      const response = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create swap record');
      }

      const swapRecord = await response.json();
      console.log('✅ Swap record created:', swapRecord.id);

      // If dry run, return early
      if (params.dryRun) {
        console.log('🧪 Dry run mode - skipping blockchain interactions');
        return {
          id: swapRecord.id,
          status: swapRecord.status,
          hashLock: swapRecord.hashLock
        };
      }

      // Step 2: Connect wallet
      console.log('👛 Step 2: Connecting wallet...');
      let userAddress: string;
      try {
        userAddress = await blockchainService.connectWallet(params.fromChain);
        console.log('✅ Wallet connected:', userAddress);
      } catch (walletError: any) {
        console.error('❌ Wallet connection failed:', walletError);
        
        // Update swap status to cancelled
        await this.updateSwapStatus(swapRecord.id, 'CANCELLED');
        
        return {
          id: swapRecord.id,
          status: 'CANCELLED',
          error: walletError.message
        };
      }

      // Step 3: Create HTLC on blockchain
      console.log('🔗 Step 3: Creating HTLC on blockchain...');
      try {
        const blockchainResult = await blockchainService.createHTLC({
          fromChain: params.fromChain,
          fromToken: params.fromToken,
          toChain: params.toChain,
          toToken: params.toToken,
          amount: params.amount,
          beneficiary: params.beneficiary,
          timelock: params.timelock || 3600,
          swapId: swapRecord.id,
          hashLock: swapRecord.hashLock
        });

        if (!blockchainResult.success) {
          throw new Error(blockchainResult.error || 'HTLC creation failed');
        }

        console.log('✅ HTLC created:', blockchainResult.contractId);
        console.log('📋 Transaction:', blockchainResult.transactionHash);

        // Step 4: Update swap record with blockchain data
        console.log('💾 Step 4: Updating swap record...');
        const updateResponse = await fetch(`/api/swaps/${swapRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: blockchainResult.userAddress,
            userHtlcContract: blockchainResult.contractId,
            status: 'PENDING' // Keep as PENDING for resolver to process
          })
        });

        if (!updateResponse.ok) {
          console.error('⚠️ Failed to update swap record, but HTLC was created');
        } else {
          console.log('✅ Swap record updated');
        }

        return {
          id: swapRecord.id,
          status: 'PENDING',
          userAddress: blockchainResult.userAddress,
          hashLock: swapRecord.hashLock,
          contractId: blockchainResult.contractId,
          transactionHash: blockchainResult.transactionHash
        };

      } catch (blockchainError: any) {
        console.error('❌ Blockchain operation failed:', blockchainError);
        
        // Update swap status to cancelled
        await this.updateSwapStatus(swapRecord.id, 'CANCELLED');
        
        return {
          id: swapRecord.id,
          status: 'CANCELLED',
          error: blockchainError.message
        };
      }

    } catch (error: any) {
      console.error('❌ Swap creation failed:', error);
      throw error;
    }
  }

  /**
   * Claim tokens from a swap
   */
  async claimSwap(swapId: string, chainKey: string, contractId: string, preimage: string): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      console.log('🎯 Claiming swap:', swapId);

      // Connect wallet
      await blockchainService.connectWallet(chainKey);

      // Claim from HTLC
      const result = await blockchainService.claimHTLC(chainKey, contractId, preimage);

      if (result.success) {
        // Update swap status
        await this.updateSwapStatus(swapId, 'USER_CLAIMED');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Claim failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get swap details
   */
  async getSwapDetails(swapId: string): Promise<any> {
    try {
      const response = await fetch(`/api/swaps/${swapId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch swap details');
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to fetch swap details:', error);
      return null;
    }
  }

  /**
   * Update swap status
   */
  private async updateSwapStatus(swapId: string, status: string): Promise<void> {
    try {
      await fetch(`/api/swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('⚠️ Failed to update swap status:', error);
    }
  }
}

// Export singleton instance
export const productionSwapService = new ProductionClientSwapService();