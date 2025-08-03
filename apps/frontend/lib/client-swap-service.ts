"use client";

import { ethers } from 'ethers';

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
}

export class ClientSwapService {
  /**
   * Create a swap that goes through the proper flow:
   * 1. Create basic record in database via API
   * 2. Handle blockchain interactions client-side
   * 3. Update database with blockchain results
   */
  async createSwap(params: ClientSwapParams): Promise<ClientSwapResult> {
    console.log('🔄 Creating client-side swap:', params);

    try {
      // Step 1: Create initial swap record via API (server-side)
      const response = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create swap record');
      }

      const swapRecord = await response.json();
      console.log('✅ Initial swap record created:', swapRecord.id);

      // Step 2: Handle blockchain interactions if not a dry run
      if (!params.dryRun) {
                  try {
            console.log('🔗 Starting blockchain interactions...');
            
            // Import blockchain service dynamically to avoid SSR issues
            const { realBlockchainSwapService } = await import('./real-blockchain-swap-service');
            const blockchainResult = await realBlockchainSwapService.createRealSwap({
              ...params,
              swapId: swapRecord.id // Pass the database ID to blockchain service
            });
            console.log('✅ Blockchain swap created:', blockchainResult);

          // Step 3: Update the swap record with blockchain data
          // Import ethers for conversion
          const { ethers } = await import('ethers');
          
          // Convert target amount to wei (assuming 18 decimals)
          // The blockchainResult.targetAmount is in decimal format
          const expectedAmountWei = ethers.parseUnits(blockchainResult.targetAmount, 18).toString();
          
          const updateResponse = await fetch(`/api/swaps/${swapRecord.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userAddress: blockchainResult.userAddress,
              hashLock: blockchainResult.secretHash,
              preimageHash: blockchainResult.secret, // FIXED: Save the preimage for resolver
              userHtlcContract: blockchainResult.contractId,
              status: blockchainResult.status,
              expectedAmount: expectedAmountWei
            })
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.text();
            console.error('❌ Failed to update swap record:', {
              status: updateResponse.status,
              statusText: updateResponse.statusText,
              error: errorData
            });
          } else {
            console.log('✅ Swap record updated successfully with blockchain data');
          }

          return {
            id: swapRecord.id,
            status: blockchainResult.status,
            userAddress: blockchainResult.userAddress,
            hashLock: blockchainResult.hashLock,
            contractId: blockchainResult.contractId,
            htlcAddress: blockchainResult.htlcAddress,
            transactionHash: blockchainResult.transactionHash
          };
        } catch (blockchainError) {
          console.error('❌ Blockchain interaction failed:', blockchainError);
          
          // Update swap record with error status
          try {
            await fetch(`/api/swaps/${swapRecord.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'CANCELLED'
              })
            });
          } catch (updateError) {
            console.warn('Failed to update swap with error status');
          }

          throw blockchainError;
        }
      } else {
        // For dry runs, just return the basic record
        return {
          id: swapRecord.id,
          status: swapRecord.status
        };
      }
    } catch (error) {
      console.error('❌ Client swap creation failed:', error);
      throw error;
    }
  }

  /**
   * Get swap status
   */
  async getSwap(id: string): Promise<any> {
    const response = await fetch(`/api/swaps/${id}`);
    if (!response.ok) {
      throw new Error('Failed to get swap');
    }
    return response.json();
  }
}

export const clientSwapService = new ClientSwapService();