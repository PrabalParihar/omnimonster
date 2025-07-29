import { EventEmitter } from 'events'
import { swapDatabase, SwapRecord, SwapEvent } from './database'

interface CreateSwapParams {
  fromChain: string
  toChain: string
  amount: string
  beneficiary: string
  timelock: number
  slippage: number
  dryRun: boolean
}

interface SwapResult {
  id: string
  status: string
  message: string
}

class OrchestratorService extends EventEmitter {
  private isRunning = false

  constructor() {
    super()
  }

  async createSwap(params: CreateSwapParams): Promise<SwapResult> {
    const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
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
      status: 'initiated',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      // Create initial event
      const initialEvent: SwapEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type: 'initiated',
        data: {
          message: 'Swap initiated',
          params
        },
        timestamp: Date.now()
      }

      // Save swap and initial event atomically
      await swapDatabase.createSwapWithEvent(swapRecord, initialEvent)

      // Emit to listeners
      this.emit('swapEvent', initialEvent)

      // Start the swap process
      if (!this.isRunning) {
        this.isRunning = true
        this.processSwap(swapId, params)
      }

      return {
        id: swapId,
        status: 'initiated',
        message: 'Swap created successfully'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      try {
        // Check if swap was created before trying to update it
        const existingSwap = await swapDatabase.getSwap(swapId)
        if (existingSwap) {
          // Try to update swap status and emit error event atomically
          const errorEvent: SwapEvent = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            swapId,
            type: 'failed',
            data: {
              message: errorMessage
            },
            timestamp: Date.now()
          }

          await swapDatabase.transaction(async (client) => {
            await swapDatabase.updateSwap(swapId, {
              status: 'failed',
              errorMessage
            })
            await swapDatabase.createEvent(errorEvent)
          })

          // Emit to listeners
          this.emit('swapEvent', errorEvent)
        }
      } catch (updateError) {
        console.error('Failed to update swap status after error:', updateError)
      }

      throw new Error(`Failed to create swap: ${errorMessage}`)
    }
  }

  private async processSwap(swapId: string, _params: CreateSwapParams) {
    try {
      // Simulate swap process steps
      await this.simulateStep(swapId, 'generating_params', 'Generating HTLC parameters', 2000)
      await this.simulateStep(swapId, 'creating_src_htlc', 'Creating source HTLC', 3000)
      await this.simulateStep(swapId, 'creating_dst_htlc', 'Creating destination HTLC', 3000)
      await this.simulateStep(swapId, 'claiming_dst', 'Claiming destination funds', 2000)
      await this.simulateStep(swapId, 'claiming_src', 'Claiming source funds', 2000)
      
      // Complete the swap
      const completedEvent: SwapEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type: 'completed',
        data: {
          message: 'Swap completed successfully'
        },
        timestamp: Date.now()
      }

      await swapDatabase.transaction(async (client) => {
        await swapDatabase.updateSwap(swapId, { status: 'completed' })
        await swapDatabase.createEvent(completedEvent)
      })

      this.emit('swapEvent', completedEvent)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const failedEvent: SwapEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type: 'failed',
        data: {
          message: errorMessage
        },
        timestamp: Date.now()
      }

      await swapDatabase.transaction(async (client) => {
        await swapDatabase.updateSwap(swapId, {
          status: 'failed',
          errorMessage
        })
        await swapDatabase.createEvent(failedEvent)
      })

      this.emit('swapEvent', failedEvent)
    } finally {
      this.isRunning = false
    }
  }

  private async simulateStep(swapId: string, status: string, message: string, delay: number) {
    const stepEvent: SwapEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      swapId,
      type: status,
      data: {
        message,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }

    // Update status and emit event atomically
    await swapDatabase.transaction(async (client) => {
      await swapDatabase.updateSwap(swapId, { status })
      await swapDatabase.createEvent(stepEvent)
    })

    // Emit to listeners
    this.emit('swapEvent', stepEvent)

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  private async emitSwapEvent(swapId: string, type: string, data: Record<string, unknown>) {
    const event: SwapEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      swapId,
      type,
      data,
      timestamp: Date.now()
    }

    try {
      // Save event to database - this will fail if swap doesn't exist (FK constraint)
      await swapDatabase.createEvent(event)

      // Emit to listeners
      this.emit('swapEvent', event)
    } catch (error) {
      console.error(`Failed to emit swap event for swap ${swapId}:`, error)
      throw error
    }
  }

  async getSwap(swapId: string): Promise<SwapRecord | undefined> {
    return await swapDatabase.getSwap(swapId)
  }

  async getSwaps(): Promise<SwapRecord[]> {
    return await swapDatabase.getAllSwaps()
  }

  async getSwapEvents(swapId: string): Promise<SwapEvent[]> {
    return await swapDatabase.getEventsForSwap(swapId)
  }

  async cancelSwap(swapId: string): Promise<boolean> {
    const swap = await swapDatabase.getSwap(swapId)
    if (!swap || swap.status === 'completed' || swap.status === 'failed') {
      return false
    }

    const cancelledEvent: SwapEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      swapId,
      type: 'cancelled',
      data: {
        message: 'Swap cancelled by user'
      },
      timestamp: Date.now()
    }

    await swapDatabase.transaction(async (client) => {
      await swapDatabase.updateSwap(swapId, {
        status: 'cancelled',
        errorMessage: 'Swap cancelled by user'
      })
      await swapDatabase.createEvent(cancelledEvent)
    })

    this.emit('swapEvent', cancelledEvent)

    return true
  }

  // Mock blockchain interaction methods
  private async createEVMHTLC(_chain: string, _amount: string, _beneficiary: string, _timelock: number): Promise<{ txHash: string; htlcId: string }> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      htlcId: `htlc_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  private async createCosmosHTLC(_chain: string, _amount: string, _beneficiary: string, _timelock: number): Promise<{ txHash: string; htlcId: string }> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      txHash: `cosmos_${Math.random().toString(16).substr(2, 64)}`,
      htlcId: `htlc_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  private async claimEVMHTLC(_chain: string, _htlcId: string, _preimage: string): Promise<{ txHash: string }> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`
    }
  }

  private async claimCosmosHTLC(_chain: string, _htlcId: string, _preimage: string): Promise<{ txHash: string }> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      txHash: `cosmos_${Math.random().toString(16).substr(2, 64)}`
    }
  }
}

// Export singleton instance
export const orchestratorService = new OrchestratorService() 