import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import { swapDatabase, SwapRecord, SwapEvent } from './database'
import { 
  EvmHTLCClient,
  CosmosHTLCClient,
  evmChains, 
  cosmosChains,
  generatePreimage,
  generateHashlock,
  generateHTLCId,
  calculateTimelock,
  CreateHTLCParams,
  HTLCDetails,
  SwapState
} from '../../../packages/shared/src'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'

interface CreateSwapParams {
  fromChain: string
  toChain: string
  amount: string
  beneficiary: string
  timelock: number
  slippage: number
  dryRun: boolean
  privateKey?: string
  mnemonic?: string
}

interface SwapResult {
  id: string
  status: string
  message: string
}

interface ActiveHTLC {
  id: string
  chain: string
  client: EvmHTLCClient | CosmosHTLCClient
  preimage: string
  hashlock: string
  timelock: number
  amount: string
  beneficiary: string
  txHash?: string
  contractDetails?: HTLCDetails
  cosmosSigner?: any // Store the DirectSecp256k1HdWallet for getting accounts
}

class RealAtomicOrchestratorService extends EventEmitter {
  private isRunning = false
  private activeSwaps = new Map<string, {
    sourceHTLC?: ActiveHTLC
    destHTLC?: ActiveHTLC
    swapRecord: SwapRecord
    preimage: string
    hashlock: string
  }>()

  constructor() {
    super()
  }

  async createSwap(params: CreateSwapParams): Promise<SwapResult> {
    const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Generate real cryptographic parameters
    const preimage = generatePreimage()
    const hashlock = generateHashlock(preimage)
    const timelock = calculateTimelock(params.timelock)
    
    console.log('🔐 Generated atomic swap parameters:', {
      swapId,
      preimage: preimage.substring(0, 10) + '...',
      hashlock: hashlock.substring(0, 10) + '...',
      timelock: new Date(timelock * 1000).toISOString()
    })

    // Create swap record
    const swapRecord: SwapRecord = {
      id: swapId,
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      beneficiary: params.beneficiary,
      timelock: params.timelock,
      slippage: params.slippage,
      dryRun: params.dryRun,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      // Create initial event
      const initiatedEvent: SwapEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type: 'initiated',
        data: {
          preimage: preimage.substring(0, 10) + '...',
          hashlock: hashlock.substring(0, 10) + '...',
          timelock
        },
        timestamp: Date.now()
      }

      // Save to database atomically
      await swapDatabase.transaction(async () => {
        await swapDatabase.createSwap(swapRecord)
        await swapDatabase.createEvent(initiatedEvent)
      })

      // Store in memory for processing
      this.activeSwaps.set(swapId, {
        swapRecord,
        preimage,
        hashlock
      })

      // Emit event to listeners
      this.emit('swapEvent', initiatedEvent)

      if (params.dryRun) {
        const completedEvent: SwapEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          swapId,
          type: 'completed',
          data: {
            message: 'Dry run completed - no real transactions executed',
            srcTxHash: 'dry_run_src_tx',
            dstTxHash: 'dry_run_dst_tx'
          },
          timestamp: Date.now()
        }

        await swapDatabase.transaction(async () => {
          await swapDatabase.updateSwap(swapId, {
            status: 'completed',
            srcTxHash: 'dry_run_src_tx',
            dstTxHash: 'dry_run_dst_tx',
            updatedAt: Date.now()
          })
          await swapDatabase.createEvent(completedEvent)
        })

        this.emit('swapEvent', completedEvent)
        return { id: swapId, status: 'completed', message: 'Dry run completed successfully' }
      }

      // Start real atomic swap execution
      this.processRealAtomicSwap(swapId, params)

      return { id: swapId, status: 'initiated', message: 'Real atomic swap initiated' }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const errorEvent: SwapEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type: 'failed',
        data: {
          message: errorMessage
        },
        timestamp: Date.now()
      }

      try {
        await swapDatabase.transaction(async () => {
          await swapDatabase.updateSwap(swapId, {
            status: 'failed',
            errorMessage,
            updatedAt: Date.now()
          })
          await swapDatabase.createEvent(errorEvent)
        })
        this.emit('swapEvent', errorEvent)
      } catch (updateError) {
        console.error('Failed to update swap status after error:', updateError)
      }

      throw new Error(`Failed to create atomic swap: ${errorMessage}`)
    }
  }

  private async processRealAtomicSwap(swapId: string, params: CreateSwapParams): Promise<void> {
    const swapData = this.activeSwaps.get(swapId)
    if (!swapData) {
      throw new Error('Swap data not found')
    }

    try {
      // Step 1: Create source chain HTLC
      await this.emitSwapEvent(swapId, 'locking_source', { message: 'Creating HTLC on source chain' })
      
      const sourceClientResult = await this.createClientForChain(params.fromChain, params)
      const sourceClient = sourceClientResult.client
      const srcHTLCId = generateHTLCId({
        srcChain: params.fromChain,
        dstChain: params.toChain,
        nonce: Date.now().toString(),
        hashlock: swapData.hashlock
      })

      const sourceHTLCParams: CreateHTLCParams = {
        contractId: srcHTLCId,
        beneficiary: params.beneficiary,
        hashLock: swapData.hashlock,
        timelock: calculateTimelock(params.timelock),
        value: this.parseAmountForChain(params.amount, params.fromChain)
      }

      const sourceTx = await this.createHTLC(sourceClient, params.fromChain, sourceHTLCParams, sourceClientResult.signer)
      
      swapData.sourceHTLC = {
        id: srcHTLCId,
        chain: params.fromChain,
        client: sourceClient,
        preimage: swapData.preimage,
        hashlock: swapData.hashlock,
        timelock: calculateTimelock(params.timelock),
        amount: params.amount,
        beneficiary: params.beneficiary,
        txHash: sourceTx.hash
      }

      await this.emitSwapEvent(swapId, 'source_locked', { 
        txHash: sourceTx.hash,
        htlcId: srcHTLCId,
        blockNumber: sourceTx.blockNumber
      })

      // Update database
      await swapDatabase.updateSwap(swapId, {
        status: 'source_locked',
        srcTxHash: sourceTx.hash,
        updatedAt: Date.now()
      })

      // Step 2: Create destination chain HTLC
      await this.emitSwapEvent(swapId, 'locking_destination', { message: 'Creating HTLC on destination chain' })
      
      const destClientResult = await this.createClientForChain(params.toChain, params)
      const destClient = destClientResult.client
      const dstHTLCId = generateHTLCId({
        srcChain: params.toChain,
        dstChain: params.fromChain,
        nonce: Date.now().toString(),
        hashlock: swapData.hashlock
      })

      const destHTLCParams: CreateHTLCParams = {
        contractId: dstHTLCId,
        beneficiary: await this.getWalletAddress(sourceClient, sourceClientResult.signer), // Source wallet can claim from dest
        hashLock: swapData.hashlock,
        timelock: calculateTimelock(params.timelock),
        value: this.parseAmountForChain(params.amount, params.toChain)
      }

      const destTx = await this.createHTLC(destClient, params.toChain, destHTLCParams, destClientResult.signer)

      swapData.destHTLC = {
        id: dstHTLCId,
        chain: params.toChain,
        client: destClient,
        preimage: swapData.preimage,
        hashlock: swapData.hashlock,
        timelock: calculateTimelock(params.timelock),
        amount: params.amount,
        beneficiary: await this.getWalletAddress(sourceClient),
        txHash: destTx.hash
      }

      await this.emitSwapEvent(swapId, 'destination_locked', { 
        txHash: destTx.hash,
        htlcId: dstHTLCId,
        blockNumber: destTx.blockNumber
      })

      // Update database
      await swapDatabase.updateSwap(swapId, {
        status: 'destination_locked',
        dstTxHash: destTx.hash,
        updatedAt: Date.now()
      })

      // Step 3: Claim destination HTLC (reveals preimage)
      await this.emitSwapEvent(swapId, 'claiming_destination', { message: 'Claiming destination HTLC' })
      
      const claimDestTx = await this.claimHTLC(destClient, dstHTLCId, swapData.preimage, destClientResult.signer)
      
      await this.emitSwapEvent(swapId, 'destination_claimed', { 
        txHash: claimDestTx.hash,
        preimage: swapData.preimage.substring(0, 10) + '...',
        blockNumber: claimDestTx.blockNumber
      })

      // Update database
      await swapDatabase.updateSwap(swapId, {
        status: 'destination_claimed',
        claimDstTxHash: claimDestTx.hash,
        updatedAt: Date.now()
      })

      // Step 4: Complete the swap
      await this.emitSwapEvent(swapId, 'completed', { 
        message: 'Cross-chain atomic swap completed successfully',
        totalTimeMs: Date.now() - swapData.swapRecord.createdAt
      })

      // Final database update
      await swapDatabase.updateSwap(swapId, {
        status: 'completed',
        updatedAt: Date.now()
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Real atomic swap failed:', error)

      await this.emitSwapEvent(swapId, 'failed', { 
        message: errorMessage,
        error: error instanceof Error ? error.stack : undefined
      })

      await swapDatabase.updateSwap(swapId, {
        status: 'failed',
        errorMessage,
        updatedAt: Date.now()
      })

      throw error
    }
  }



  private async createClientForChain(chain: string, params: CreateSwapParams): Promise<{ client: EvmHTLCClient | CosmosHTLCClient; signer?: any }> {
    if (chain === 'sepolia' || chain === 'polygonAmoy') {
      if (!params.privateKey) {
        throw new Error('Private key required for EVM transactions')
      }

      const chainConfig = chain === 'sepolia' ? evmChains.sepolia : evmChains.polygonAmoy
      
      // Validate HTLC address
      if (!chainConfig.htlcAddress) {
        throw new Error(`HTLC contract not deployed on ${chainConfig.name}`)
      }

      let normalizedPrivateKey = params.privateKey
      if (!normalizedPrivateKey.startsWith('0x')) {
        normalizedPrivateKey = '0x' + normalizedPrivateKey
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl)
      const signer = new ethers.Wallet(normalizedPrivateKey, provider)
      
      return { client: new EvmHTLCClient({ chain: chainConfig, provider, signer }) }
      
    } else if (chain === 'cosmosTestnet') {
      if (!params.mnemonic) {
        throw new Error('Mnemonic required for Cosmos transactions')
      }

      const chainConfig = cosmosChains.cosmosTestnet
      const client = new CosmosHTLCClient({ chain: chainConfig })
      const signer = await DirectSecp256k1HdWallet.fromMnemonic(params.mnemonic, {
        prefix: chainConfig.addressPrefix
      })
      await client.connectWithSigner(signer)
      
      return { client, signer }
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  private async createHTLC(
    client: EvmHTLCClient | CosmosHTLCClient,
    chain: string,
    params: CreateHTLCParams,
    signer?: any
  ): Promise<{ hash: string; blockNumber?: number }> {
    if (client instanceof EvmHTLCClient) {
      const tx = await client.lock(params)
      const receipt = await tx.wait()
      
      if (!receipt || receipt.status !== 1) {
        throw new Error('HTLC creation transaction failed')
      }
      
      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    } else if (client instanceof CosmosHTLCClient) {
      if (!signer) throw new Error('Signer required for Cosmos transactions')
      
      const accounts = await signer.getAccounts()
      const result = await client.instantiateHTLC(params, accounts[0].address)
      
      return {
        hash: result.result.transactionHash
      }
    } else {
      throw new Error('Unknown client type')
    }
  }

  private async claimHTLC(
    client: EvmHTLCClient | CosmosHTLCClient,
    htlcId: string,
    preimage: string,
    signer?: any
  ): Promise<{ hash: string; blockNumber?: number }> {
    if (client instanceof EvmHTLCClient) {
      const isClaimable = await client.isClaimable(htlcId)
      if (!isClaimable) {
        throw new Error('HTLC is not claimable')
      }
      
      const tx = await client.claim(htlcId, preimage)
      const receipt = await tx.wait()
      
      if (!receipt || receipt.status !== 1) {
        throw new Error('HTLC claim transaction failed')
      }
      
      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    } else if (client instanceof CosmosHTLCClient) {
      if (!signer) throw new Error('Signer required for Cosmos transactions')
      
      const accounts = await signer.getAccounts()
      const result = await client.claim(htlcId, accounts[0].address, preimage)
      
      return {
        hash: result.transactionHash
      }
    } else {
      throw new Error('Unknown client type')
    }
  }

  private async getWalletAddress(client: EvmHTLCClient | CosmosHTLCClient, signer?: any): Promise<string> {
    if (client instanceof EvmHTLCClient) {
      const signer = client.getSigner()
      return await signer!.getAddress()
    } else if (client instanceof CosmosHTLCClient) {
      if (!signer) throw new Error('Signer required for Cosmos address')
      const accounts = await signer.getAccounts()
      return accounts[0].address
    } else {
      throw new Error('Unknown client type')
    }
  }

  private parseAmountForChain(amount: string, chain: string): string {
    if (chain === 'sepolia' || chain === 'polygonAmoy') {
      return ethers.parseEther(amount).toString()
    } else if (chain === 'cosmosTestnet') {
      return (parseFloat(amount) * 1_000_000).toString() // Convert to uatom
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  private async emitSwapEvent(swapId: string, type: string, data: Record<string, unknown>): Promise<void> {
    const event: SwapEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      swapId,
      type,
      data,
      timestamp: Date.now()
    }

    await swapDatabase.createEvent(event)
    this.emit('swapEvent', event)
  }

  async getSwap(id: string): Promise<SwapRecord | null> {
    const result = await swapDatabase.getSwap(id)
    return result || null
  }

  async getSwaps(): Promise<SwapRecord[]> {
    return await swapDatabase.getSwaps()
  }

  async getSwapEvents(swapId: string): Promise<SwapEvent[]> {
    return await swapDatabase.getSwapEvents(swapId)
  }

  async cancelSwap(id: string): Promise<boolean> {
    try {
      const swap = await swapDatabase.getSwap(id)
      if (!swap) return false

      if (swap.status === 'completed' || swap.status === 'failed') {
        return false
      }

      await swapDatabase.updateSwap(id, {
        status: 'cancelled',
        updatedAt: Date.now()
      })

      await this.emitSwapEvent(id, 'cancelled', { message: 'Swap cancelled by user' })
      return true
    } catch (error) {
      console.error('Failed to cancel swap:', error)
      return false
    }
  }
}

export const realAtomicOrchestratorService = new RealAtomicOrchestratorService() 