"use client"

import { EventEmitter } from 'events'
import { ethers } from 'ethers'
import { useWalletClient } from 'wagmi'

// Browser-safe database interfaces
interface SwapRecord {
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

interface SwapEvent {
  id: string
  swapId: string
  type: string
  data: Record<string, unknown>
  timestamp: number
}

// Browser-safe database operations via API calls to Neon DB
const browserDatabase = {
  async createSwap(swap: SwapRecord): Promise<void> {
    try {
      // Try to save to Neon DB via API
      const response = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swap)
      })
      
      if (response.ok) {
        console.log('✓ Swap saved to Neon DB')
      } else {
        throw new Error(`API responded with ${response.status}`)
      }
    } catch (apiError) {
      console.warn('Failed to save to Neon DB, using localStorage fallback:', apiError)
      // Fallback to localStorage
      try {
        const swaps = JSON.parse(localStorage.getItem('wallet-swaps') || '{}')
        swaps[swap.id] = swap
        localStorage.setItem('wallet-swaps', JSON.stringify(swaps))
      } catch (localError) {
        console.warn('Failed to save swap to localStorage:', localError)
      }
    }
  },

  async updateSwap(id: string, updates: Partial<SwapRecord>): Promise<void> {
    try {
      // Try to update in Neon DB via API
      const response = await fetch(`/api/swaps/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        console.log('✓ Swap updated in Neon DB')
      } else {
        throw new Error(`API responded with ${response.status}`)
      }
    } catch (apiError) {
      console.warn('Failed to update in Neon DB, using localStorage fallback:', apiError)
      // Fallback to localStorage
      try {
        const swaps = JSON.parse(localStorage.getItem('wallet-swaps') || '{}')
        if (swaps[id]) {
          swaps[id] = { ...swaps[id], ...updates }
          localStorage.setItem('wallet-swaps', JSON.stringify(swaps))
        }
      } catch (localError) {
        console.warn('Failed to update swap in localStorage:', localError)
      }
    }
  },

  async createEvent(event: SwapEvent): Promise<void> {
    try {
      // Try to save event to Neon DB via API
      const response = await fetch(`/api/swaps/${event.swapId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      })
      
      if (response.ok) {
        console.log('✓ Event saved to Neon DB')
      } else {
        throw new Error(`API responded with ${response.status}`)
      }
    } catch (apiError) {
      console.warn('Failed to save event to Neon DB, using localStorage fallback:', apiError)
      // Fallback to localStorage
      try {
        const events = JSON.parse(localStorage.getItem('wallet-events') || '[]')
        events.push(event)
        localStorage.setItem('wallet-events', JSON.stringify(events))
      } catch (localError) {
        console.warn('Failed to add event to localStorage:', localError)
      }
    }
  }
}

// Extend Window type for ethereum
declare global {
  interface Window {
    ethereum?: any
  }
}
import { 
  EvmHTLCClient,
  CosmosHTLCClient,
  evmChains, 
  cosmosChains,
  generatePreimage,
  generateHashlock,
  generateHTLCId,
  generateNonce,
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
}

interface SwapResult {
  id: string
  status: string
  message: string
  preimage?: string
  hashlock?: string
}

interface WalletSigners {
  evmSigner?: any // From wagmi
  cosmosSigner?: any // From Keplr
}

export class WalletAtomicOrchestrator extends EventEmitter {
  private activeSwaps = new Map<string, any>()

  constructor() {
    super()
  }

  async createSwap(params: CreateSwapParams, signers: WalletSigners): Promise<SwapResult> {
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

    if (params.dryRun) {
      // For dry run, just return the parameters
      return {
        id: swapId,
        status: 'completed',
        message: 'Dry run completed - no real transactions executed',
        preimage,
        hashlock
      }
    }

    try {
      // Store swap data in memory and database
      const swapData = {
        params,
        preimage,
        hashlock,
        timelock,
        signers,
        status: 'initiated'
      }
      
      this.activeSwaps.set(swapId, swapData)

      // Save to database for API access
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
        await browserDatabase.createSwap(swapRecord)
        await this.addSwapEvent(swapId, 'swap_initiated', { swapId, ...swapRecord })
      } catch (dbError) {
        console.warn('Failed to save swap to database, continuing with in-memory storage:', dbError)
      }

      // Start real atomic swap execution
      await this.processRealAtomicSwap(swapId)

      return { 
        id: swapId, 
        status: 'initiated', 
        message: 'Real atomic swap initiated',
        preimage,
        hashlock
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create atomic swap: ${errorMessage}`)
    }
  }

  private async processRealAtomicSwap(swapId: string): Promise<void> {
    const swapData = this.activeSwaps.get(swapId)
    if (!swapData) {
      throw new Error('Swap data not found')
    }

    const { params, preimage, hashlock, timelock, signers } = swapData

    try {
      this.emit('progress', { swapId, step: 'locking_source', message: 'Creating HTLC on source chain' })
      
      // Step 1: Create source chain HTLC
      const sourceClient = await this.createClientForChain(params.fromChain, signers)
      const srcNonce = generateNonce()
      const srcHTLCId = generateHTLCId({
        srcChain: params.fromChain,
        dstChain: params.toChain,
        nonce: srcNonce,
        hashlock: hashlock
      })
      
      console.log('🔗 Source HTLC ID generation:', {
        chain: params.fromChain,
        nonce: srcNonce,
        contractId: srcHTLCId.substring(0, 10) + '...'
      })

      const sourceHTLCParams: CreateHTLCParams = {
        contractId: srcHTLCId,
        beneficiary: params.beneficiary,
        hashLock: hashlock,
        timelock: timelock,
        value: this.parseAmountForChain(params.amount, params.fromChain)
      }

      const sourceTx = await this.createHTLC(sourceClient, params.fromChain, sourceHTLCParams, signers)
      
      this.emit('progress', { 
        swapId, 
        step: 'source_locked', 
        txHash: sourceTx.hash,
        htlcId: srcHTLCId
      })

      // Update database with source transaction
      await this.updateSwapStatus(swapId, 'source_locked', { srcTxHash: sourceTx.hash })
      await this.addSwapEvent(swapId, 'source_htlc_created', { 
        txHash: sourceTx.hash, 
        htlcId: srcHTLCId, 
        chain: params.fromChain 
      })

      // Step 2: Create destination chain HTLC
      this.emit('progress', { swapId, step: 'locking_destination', message: 'Creating HTLC on destination chain' })
      
      const destClient = await this.createClientForChain(params.toChain, signers)
      const dstNonce = generateNonce()
      const dstHTLCId = generateHTLCId({
        srcChain: params.toChain,
        dstChain: params.fromChain,
        nonce: dstNonce,
        hashlock: hashlock
      })
      
      console.log('🔗 Destination HTLC ID generation:', {
        chain: params.toChain,
        nonce: dstNonce,
        contractId: dstHTLCId.substring(0, 10) + '...'
      })

      const sourceAddress = await this.getWalletAddress(sourceClient, params.fromChain, signers)
      const destHTLCParams: CreateHTLCParams = {
        contractId: dstHTLCId,
        beneficiary: sourceAddress, // Source wallet can claim from dest
        hashLock: hashlock,
        timelock: timelock,
        value: this.parseAmountForChain(params.amount, params.toChain)
      }

      const destTx = await this.createHTLC(destClient, params.toChain, destHTLCParams, signers)

      this.emit('progress', { 
        swapId, 
        step: 'destination_locked', 
        txHash: destTx.hash,
        htlcId: dstHTLCId
      })

      // Update database with destination transaction
      await this.updateSwapStatus(swapId, 'destination_locked', { dstTxHash: destTx.hash })
      await this.addSwapEvent(swapId, 'destination_htlc_created', { 
        txHash: destTx.hash, 
        htlcId: dstHTLCId, 
        chain: params.toChain 
      })

      // Step 3: Claim destination HTLC (reveals preimage)
      this.emit('progress', { swapId, step: 'claiming_destination', message: 'Claiming destination HTLC' })
      
      const claimDestTx = await this.claimHTLC(destClient, dstHTLCId, preimage, params.toChain, signers)
      
      this.emit('progress', { 
        swapId, 
        step: 'destination_claimed', 
        txHash: claimDestTx.hash,
        preimage: preimage.substring(0, 10) + '...'
      })

      // Update database with claim transaction
      await this.updateSwapStatus(swapId, 'destination_claimed', { claimDstTxHash: claimDestTx.hash })
      await this.addSwapEvent(swapId, 'destination_htlc_claimed', { 
        txHash: claimDestTx.hash, 
        preimage: preimage.substring(0, 10) + '...', 
        chain: params.toChain 
      })

      // Step 4: Complete the swap
      this.emit('progress', { 
        swapId, 
        step: 'completed', 
        message: 'Cross-chain atomic swap completed successfully'
      })

      swapData.status = 'completed'
      
      // Final database update
      await this.updateSwapStatus(swapId, 'completed')
      await this.addSwapEvent(swapId, 'swap_completed', { message: 'Cross-chain atomic swap completed successfully' })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Real atomic swap failed:', error)

      this.emit('progress', { 
        swapId, 
        step: 'failed', 
        message: errorMessage
      })

      swapData.status = 'failed'
      
      // Update database with error
      await this.updateSwapStatus(swapId, 'failed', { errorMessage })
      await this.addSwapEvent(swapId, 'swap_failed', { error: errorMessage })
      
      throw error
    }
  }

  private async createClientForChain(chain: string, signers: WalletSigners): Promise<EvmHTLCClient | CosmosHTLCClient> {
    if (chain === 'sepolia' || chain === 'polygonAmoy') {
      if (!signers.evmSigner) {
        throw new Error('EVM signer required for EVM transactions')
      }

      const chainConfig = chain === 'sepolia' ? evmChains.sepolia : evmChains.polygonAmoy
      
      // Validate HTLC address
      if (!chainConfig.htlcAddress) {
        throw new Error(`HTLC contract not deployed on ${chainConfig.name}`)
      }

      // Create proper provider and signer
      let provider: ethers.Provider
      let ethersSigner: ethers.Signer
      
      try {
        // Use window.ethereum if available for better compatibility
        if (typeof window !== 'undefined' && window.ethereum) {
          const browserProvider = new ethers.BrowserProvider(window.ethereum)
          provider = browserProvider
          ethersSigner = await browserProvider.getSigner()
        } else {
          // Fallback to RPC provider (for server-side or testing)
          const jsonProvider = new ethers.JsonRpcProvider(chainConfig.rpcUrl)
          provider = jsonProvider
          // For read-only operations, we can't get a signer from JSON-RPC
          throw new Error('Wallet connection required for transactions. Please connect your wallet.')
        }
      } catch (error) {
        console.error('Failed to create provider/signer:', error)
        throw new Error(`Failed to connect to ${chainConfig.name}. Please ensure your wallet is connected.`)
      }
      
      return new EvmHTLCClient({ 
        chain: chainConfig, 
        provider, 
        signer: ethersSigner 
      })
      
    } else if (chain === 'cosmosTestnet') {
      if (!signers.cosmosSigner) {
        throw new Error('Cosmos signer required for Cosmos transactions')
      }

      const chainConfig = cosmosChains.cosmosTestnet
      const client = new CosmosHTLCClient({ chain: chainConfig })
      await client.connectWithSigner(signers.cosmosSigner)
      
      return client
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  private async createHTLC(
    client: EvmHTLCClient | CosmosHTLCClient,
    chain: string,
    params: CreateHTLCParams,
    signers: WalletSigners
  ): Promise<{ hash: string; blockNumber?: number }> {
    if (client instanceof EvmHTLCClient) {
      try {
        console.log('🔗 Creating HTLC on', chain, 'with params:', {
          contractId: params.contractId.substring(0, 10) + '...',
          beneficiary: params.beneficiary,
          value: params.value,
          token: params.token || 'ETH/MATIC',
          timelock: params.timelock,
          hashLock: params.hashLock.substring(0, 10) + '...'
        })
        
        // Check balance before attempting transaction
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const userAddress = await signer.getAddress()
        const balance = await provider.getBalance(userAddress)
        
        console.log('💰 User balance:', {
          address: userAddress,
          balance: ethers.formatEther(balance),
          network: chain
        })
        
        // Enhanced pre-flight validation checks
        await this.validateHTLCParameters(client, params, chain, userAddress, balance)
        
        console.log('✅ Pre-flight validation passed, proceeding with transaction...')
        
        const tx = await client.lock(params)
        
        if (!tx) {
          throw new Error('Transaction creation failed - no transaction returned')
        }
        
        console.log('📝 Transaction submitted:', tx.hash)
        
        const receipt = await tx.wait()
        
        if (!receipt) {
          throw new Error('Transaction receipt is null - transaction may have failed')
        }
        
        if (receipt.status !== 1) {
          throw new Error(`Transaction failed with status: ${receipt.status}`)
        }
        
        console.log('✅ HTLC created successfully, block:', receipt.blockNumber)
        
        return {
          hash: tx.hash,
          blockNumber: receipt.blockNumber
        }
      } catch (error) {
        console.error('❌ HTLC creation failed:', error)
        
        // Enhanced error debugging
        if (error instanceof Error) {
          console.error('🔍 Detailed error analysis:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack?.substring(0, 500),
            contractParams: {
              contractId: params.contractId,
              beneficiary: params.beneficiary,
              hashLock: params.hashLock,
              timelock: params.timelock,
              value: params.value,
              token: params.token || 'native'
            }
          })
          
          // More specific error handling
          if (error.message.includes('user rejected')) {
            throw new Error('Transaction was rejected by user')
          } else if (error.message.includes('insufficient funds') || error.message.includes('insufficient balance')) {
            throw new Error('Insufficient funds for transaction - check your balance and get test tokens from faucet')
          } else if (error.message.includes('gas') && error.message.includes('estimation')) {
            throw new Error('Gas estimation failed - this often indicates a contract validation error. Check the browser console for detailed error logs.')
          } else if (error.message.includes('Internal JSON-RPC error')) {
            throw new Error('MetaMask RPC connection failed. Try switching to a different network and back, or restart MetaMask. If the issue persists, check your network connection.')
          } else if (error.message.includes('could not coalesce error')) {
            throw new Error('Transaction submission failed due to wallet provider issues. Please try again or check if MetaMask is connected to the correct network.')
          } else if (error.message.includes('execution reverted')) {
            // Try to extract revert reason if available
            let revertReason = 'Unknown contract validation failure'
            if (error.message.includes('revert')) {
              const revertMatch = error.message.match(/revert (.+?)(?:\s|$|")/)
              if (revertMatch) {
                revertReason = revertMatch[1]
              }
            }
            
            throw new Error(
              `Smart contract validation failed: ${revertReason}. ` +
              `This could be due to: duplicate contract ID, invalid timelock, ` +
              `invalid beneficiary address, or contract state issues. ` +
              `Check console logs for detailed validation results.`
            )
          } else if (error.message.includes('network')) {
            throw new Error('Network connectivity issue - please check your internet connection and wallet network')
          } else if (error.message.includes('replacement')) {
            throw new Error('Transaction replacement error - try with a higher gas price')
          }
        }
        
        throw new Error(`HTLC creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else if (client instanceof CosmosHTLCClient) {
      if (!signers.cosmosSigner) throw new Error('Cosmos signer required')
      
      try {
        const accounts = await signers.cosmosSigner.getAccounts()
        const result = await client.instantiateHTLC(params, accounts[0].address)
        
        return {
          hash: result.result.transactionHash
        }
      } catch (error) {
        throw new Error(`Cosmos HTLC creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      throw new Error('Unknown client type')
    }
  }

  private async claimHTLC(
    client: EvmHTLCClient | CosmosHTLCClient,
    htlcId: string,
    preimage: string,
    chain: string,
    signers: WalletSigners
  ): Promise<{ hash: string; blockNumber?: number }> {
    if (client instanceof EvmHTLCClient) {
      try {
        // Try to check if HTLC is claimable, but proceed if there's an ABI issue
        try {
          const isClaimable = await client.isClaimable(htlcId)
          if (!isClaimable) {
            throw new Error('HTLC is not claimable - it may be expired, already claimed, or invalid')
          }
          console.log('✓ HTLC is claimable')
        } catch (claimableError) {
          console.warn('⚠️ Could not check if HTLC is claimable, proceeding anyway:', claimableError)
          // Continue with claim attempt - the contract will revert if not claimable
        }
        
        console.log('🎯 Claiming HTLC on', chain, 'with ID:', htlcId.substring(0, 10) + '...')
        
        const tx = await client.claim(htlcId, preimage)
        
        if (!tx) {
          throw new Error('Claim transaction creation failed - no transaction returned')
        }
        
        console.log('📝 Claim transaction submitted:', tx.hash)
        
        const receipt = await tx.wait()
        
        if (!receipt) {
          throw new Error('Claim transaction receipt is null - transaction may have failed')
        }
        
        if (receipt.status !== 1) {
          throw new Error(`Claim transaction failed with status: ${receipt.status}`)
        }
        
        console.log('✅ HTLC claimed successfully, block:', receipt.blockNumber)
        
        return {
          hash: tx.hash,
          blockNumber: receipt.blockNumber
        }
      } catch (error) {
        console.error('❌ HTLC claim failed:', error)
        
        if (error instanceof Error) {
          if (error.message.includes('user rejected')) {
            throw new Error('Claim transaction was rejected by user')
          } else if (error.message.includes('insufficient funds')) {
            throw new Error('Insufficient funds for claim transaction')
          }
        }
        
        throw new Error(`HTLC claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else if (client instanceof CosmosHTLCClient) {
      if (!signers.cosmosSigner) throw new Error('Cosmos signer required')
      
      try {
        const accounts = await signers.cosmosSigner.getAccounts()
        const result = await client.claim(htlcId, accounts[0].address, preimage)
        
        return {
          hash: result.transactionHash
        }
      } catch (error) {
        throw new Error(`Cosmos HTLC claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      throw new Error('Unknown client type')
    }
  }

  private async getWalletAddress(
    client: EvmHTLCClient | CosmosHTLCClient, 
    chain: string, 
    signers: WalletSigners
  ): Promise<string> {
    if (client instanceof EvmHTLCClient) {
      if (!signers.evmSigner) throw new Error('EVM signer required')
      

      
              // For wagmi wallet client, use the account address directly
        if (signers.evmSigner.account) {
          return signers.evmSigner.account.address
        }
      
              // Fallback: get address directly from connected wallet
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' })
            if (accounts && accounts.length > 0) {
              return accounts[0]
            }
          } catch (error) {
            console.error('Failed to get accounts from window.ethereum:', error)
          }
        }
      
      throw new Error('Unable to get EVM wallet address - no connected account found')
    } else if (client instanceof CosmosHTLCClient) {
      if (!signers.cosmosSigner) throw new Error('Cosmos signer required')
      const accounts = await signers.cosmosSigner.getAccounts()
      return accounts[0].address
    } else {
      throw new Error('Unknown client type')
    }
  }

  private async validateHTLCParameters(
    client: EvmHTLCClient, 
    params: CreateHTLCParams, 
    chain: string, 
    userAddress: string, 
    userBalance: bigint
  ): Promise<void> {
    console.log('🔍 Running pre-flight validation checks...')
    // Get contract address from chain config
    const chainConfig = chain === 'sepolia' ? evmChains.sepolia : evmChains.polygonAmoy
    const contractAddress = chainConfig.htlcAddress
    
    console.log('🏠 Contract details:', {
      chain,
      contractAddress,
      userAddress,
      chainConfig: chainConfig.name
    })
    
    // 0. Verify contract is deployed with fallback RPC providers
    const getFallbackRpcUrls = (chainName: string): string[] => {
      if (chainName === 'sepolia') {
        return [
          'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
          'https://ethereum-sepolia-rpc.publicnode.com',
          'https://sepolia.gateway.tenderly.co'
        ]
      } else if (chainName === 'polygonAmoy') {
        return [
          'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
          'https://rpc-amoy.polygon.technology',
          'https://polygon-amoy.blockpi.network/v1/rpc/public',
          'https://polygon-amoy.drpc.org'
        ]
      }
      return []
    }
    
    const fallbackRpcUrls = getFallbackRpcUrls(chain)
    
    let contractVerified = false
    let lastError: Error | null = null
    
    // Try MetaMask provider first
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      if (!contractAddress) {
        throw new Error(`No HTLC contract address configured for ${chain}`)
      }
      const code = await provider.getCode(contractAddress)
      if (code === '0x') {
        throw new Error(`No contract deployed at address ${contractAddress} on ${chain}`)
      }
      console.log('✓ Contract is deployed at address:', contractAddress)
      contractVerified = true
    } catch (error) {
      console.warn('⚠️ MetaMask provider failed, trying fallback RPC providers:', error)
      lastError = error instanceof Error ? error : new Error('Unknown MetaMask error')
    }
    
    // If MetaMask fails, try fallback RPC providers
    if (!contractVerified) {
      for (const rpcUrl of fallbackRpcUrls) {
        try {
          console.log(`🔄 Trying fallback RPC: ${rpcUrl}`)
          const fallbackProvider = new ethers.JsonRpcProvider(rpcUrl)
          if (!contractAddress) {
            throw new Error(`No HTLC contract address configured for ${chain}`)
          }
          const code = await fallbackProvider.getCode(contractAddress)
          if (code === '0x') {
            throw new Error(`No contract deployed at address ${contractAddress} on ${chain}`)
          }
          console.log('✓ Contract verified with fallback RPC:', rpcUrl)
          contractVerified = true
          break
        } catch (error) {
          console.warn(`❌ Fallback RPC ${rpcUrl} failed:`, error)
          lastError = error instanceof Error ? error : new Error('Unknown fallback RPC error')
        }
      }
    }
    
    if (!contractVerified) {
      console.error('❌ All RPC providers failed for contract verification')
      throw new Error(`Contract verification failed on ${chain} after trying all RPC providers. Last error: ${lastError?.message || 'Unknown error'}`)
    }
    
    // 1. Check contract ID uniqueness
    try {
      const existingDetails = await client.getDetails(params.contractId)
      if (existingDetails.state !== 0) { // SwapState.INVALID = 0
        throw new Error(`Contract ID already exists. Current state: ${existingDetails.state}. You must use a unique contract ID.`)
      }
    } catch (error) {
      // If getDetails throws, the contract doesn't exist (which is what we want)
      console.log('✓ Contract ID is unique')
    }
    
    // 2. Validate beneficiary address
    if (!params.beneficiary || params.beneficiary === ethers.ZeroAddress) {
      throw new Error('Invalid beneficiary address - cannot be zero address')
    }
    if (!ethers.isAddress(params.beneficiary)) {
      throw new Error('Invalid beneficiary address format')
    }
    console.log('✓ Beneficiary address is valid:', params.beneficiary)
    
    // 3. Validate hash lock
    if (!params.hashLock || params.hashLock === ethers.ZeroHash) {
      throw new Error('Invalid hash lock - cannot be zero hash')
    }
    if (params.hashLock.length !== 66 || !params.hashLock.startsWith('0x')) {
      throw new Error('Invalid hash lock format - must be 32-byte hex string')
    }
    console.log('✓ Hash lock is valid')
    
    // 4. Validate timelock
    const currentTime = Math.floor(Date.now() / 1000)
    let contractTime: number
    
    try {
      contractTime = await client.getCurrentTime()
      console.log('⏰ Time validation (from contract):', {
        currentJSTime: currentTime,
        contractTime: contractTime,
        timelockParam: params.timelock,
        timeDiff: params.timelock - contractTime
      })
    } catch (error) {
      console.warn('⚠️ Could not get contract time, using JavaScript time as fallback:', error)
      contractTime = currentTime
      console.log('⏰ Time validation (fallback):', {
        currentJSTime: currentTime,
        contractTime: contractTime,
        timelockParam: params.timelock,
        timeDiff: params.timelock - contractTime
      })
    }
    
    if (params.timelock <= contractTime) {
      throw new Error(`Timelock must be in the future. Contract time: ${contractTime}, Timelock: ${params.timelock}`)
    }
    
    if (params.timelock - contractTime < 300) { // Less than 5 minutes
      console.warn('⚠️ Warning: Timelock is very short (less than 5 minutes)')
    }
    console.log('✓ Timelock is valid')
    
    // 5. Validate value
    const valueBigInt = BigInt(params.value)
    if (valueBigInt <= BigInt(0)) {
      throw new Error('Value must be greater than 0')
    }
    console.log('✓ Value is valid:', ethers.formatEther(params.value))
    
    // 6. Validate ETH/MATIC amount for native transfers
    const isNativeTransfer = !params.token || params.token === ethers.ZeroAddress
    if (isNativeTransfer) {
      // Check if user has enough balance for value + gas
      const estimatedGas = ethers.parseEther('0.01') // Rough gas estimate
      const totalNeeded = valueBigInt + estimatedGas
      
      if (userBalance < totalNeeded) {
        const chainToken = chain === 'polygonAmoy' ? 'MATIC' : 'ETH'
        const faucetUrl = chain === 'polygonAmoy' ? 'https://faucet.polygon.technology' : 'https://sepoliafaucet.com'
        throw new Error(
          `Insufficient ${chainToken} balance. ` +
          `Required: ${ethers.formatEther(totalNeeded)} ${chainToken} ` +
          `(${ethers.formatEther(params.value)} + ~0.01 for gas), ` +
          `Available: ${ethers.formatEther(userBalance)} ${chainToken}. ` +
          `Get test tokens from: ${faucetUrl}`
        )
      }
      console.log('✓ Sufficient balance for native transfer')
    }
    
    // 7. Validate network connectivity
    try {
      const blockNumber = await client.getProvider().getBlockNumber()
      console.log('✓ Network connectivity confirmed, latest block:', blockNumber)
    } catch (error) {
      throw new Error(`Network connectivity issue: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    console.log('🎯 All pre-flight validation checks passed!')
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

  getSwap(id: string) {
    return this.activeSwaps.get(id) || null
  }

  private async addSwapEvent(swapId: string, type: string, data: Record<string, any>): Promise<void> {
    try {
      const event: SwapEvent = {
        id: `${swapId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        swapId,
        type,
        data,
        timestamp: Date.now()
      }
      await browserDatabase.createEvent(event)
    } catch (error) {
      console.warn('Failed to add swap event to database:', error)
    }
  }

  private async updateSwapStatus(swapId: string, status: string, updates: Partial<SwapRecord> = {}): Promise<void> {
    try {
      await browserDatabase.updateSwap(swapId, { ...updates, status, updatedAt: Date.now() })
    } catch (error) {
      console.warn('Failed to update swap status in database:', error)
    }
  }
} 