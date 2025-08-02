import { ethers, Contract, Provider, Signer } from 'ethers';
import type { EvmChainConfig } from '../chains';
import type { 
  HTLCDetails, 
  CreateHTLCParams, 
  FundedEvent, 
  ClaimedEvent, 
  RefundedEvent,
  SwapState 
} from '../utils/index';
import { createLogger } from '../utils/logger';

const logger = createLogger('EvmHTLCClient');

// SwapSageHTLC ABI - extracted from the contract artifact
const SWAP_SAGE_HTLC_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_contractId", "type": "bytes32" },
      { "internalType": "bytes32", "name": "_preimage", "type": "bytes32" }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_contractId", "type": "bytes32" },
      { "internalType": "address", "name": "_token", "type": "address" },
      { "internalType": "address payable", "name": "_beneficiary", "type": "address" },
      { "internalType": "bytes32", "name": "_hashLock", "type": "bytes32" },
      { "internalType": "uint256", "name": "_timelock", "type": "uint256" },
      { "internalType": "uint256", "name": "_value", "type": "uint256" }
    ],
    "name": "fund",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_contractId", "type": "bytes32" }],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_contractId", "type": "bytes32" }],
    "name": "getDetails",
    "outputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "address", "name": "beneficiary", "type": "address" },
      { "internalType": "address", "name": "originator", "type": "address" },
      { "internalType": "bytes32", "name": "hashLock", "type": "bytes32" },
      { "internalType": "uint256", "name": "timelock", "type": "uint256" },
      { "internalType": "uint256", "name": "value", "type": "uint256" },
      { "internalType": "uint8", "name": "state", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_contractId", "type": "bytes32" }],
    "name": "isClaimable",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_contractId", "type": "bytes32" }],
    "name": "isRefundable",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "contractId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "originator", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "beneficiary", "type": "address" },
      { "indexed": false, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "hashLock", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "timelock", "type": "uint256" }
    ],
    "name": "Funded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "contractId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "beneficiary", "type": "address" },
      { "indexed": false, "internalType": "bytes32", "name": "preimage", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Claimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "contractId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "originator", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Refunded",
    "type": "event"
  }
] as const;

export interface EvmHTLCClientOptions {
  chain: EvmChainConfig;
  provider?: Provider;
  signer?: Signer;
}

export class EvmHTLCClient {
  private contract: any;
  private provider: Provider;
  private signer?: Signer;
  public readonly chain: EvmChainConfig;

  constructor(options: EvmHTLCClientOptions) {
    this.chain = options.chain;
    
    // Use provided provider or create a new one
    this.provider = options.provider || new ethers.JsonRpcProvider(this.chain.rpcUrl);
    this.signer = options.signer;
    
    // Create contract instance
    const contractProvider = this.signer || this.provider;
    this.contract = new Contract(this.chain.htlcAddress, SWAP_SAGE_HTLC_ABI, contractProvider) as Contract;
  }

  /**
   * Set signer for write operations
   */
  setSigner(signer: Signer): void {
    this.signer = signer;
    this.contract = this.contract.connect(signer);
  }

  /**
   * Lock funds in an HTLC
   */
  async lock(params: CreateHTLCParams): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for lock operation');
    }

    const { contractId, beneficiary, hashLock, timelock, value, token } = params;
    
    logger.info('Preparing HTLC lock transaction', {
      contractId: contractId.substring(0, 10) + '...',
      tokenAddress: token || 'ETH (zero address)',
      beneficiary,
      hashLock: hashLock.substring(0, 10) + '...',
      timelock,
      value,
      isEthTransfer: !token || token === ethers.ZeroAddress
    })
    
    const tokenAddress = token || ethers.ZeroAddress; // Use zero address for ETH
    const isEth = tokenAddress === ethers.ZeroAddress;
    
    const txOptions: { value?: string; gasLimit?: bigint } = {};
    if (isEth) {
      txOptions.value = value;
      console.log('💰 Adding ETH value to transaction options:', ethers.formatEther(value))
    }

    try {
      // Add gas estimation with detailed logging
      console.log('⛽ Estimating gas for fund() transaction...')
      const estimatedGas = await this.contract.fund.estimateGas(
        contractId,
        tokenAddress,
        beneficiary,
        hashLock,
        timelock,
        value,
        txOptions
      )
      console.log('⛽ Gas estimation successful:', estimatedGas.toString())
      
      // Add some buffer to estimated gas
      txOptions.gasLimit = (estimatedGas * BigInt(120)) / BigInt(100)
      
    } catch (gasError) {
      console.error('❌ Gas estimation failed:', gasError)
      
      // Try to get more detailed error information
      if (gasError instanceof Error) {
        console.error('Gas estimation error details:', {
          name: gasError.name,
          message: gasError.message,
          cause: (gasError as any).cause
        })
        
        // Check if it's a contract validation error
        if (gasError.message.includes('execution reverted')) {
          throw new Error(
            'Contract validation failed during gas estimation. This indicates the transaction would revert. ' +
            'Possible causes: duplicate contract ID, invalid timelock, invalid beneficiary, or insufficient balance.'
          )
        }
      }
      
      throw new Error(`Gas estimation failed: ${gasError instanceof Error ? gasError.message : 'Unknown error'}`)
    }

    console.log('📝 Calling contract.fund() with final parameters...')
    return this.contract.fund(
      contractId,
      tokenAddress,
      beneficiary,
      hashLock,
      timelock,
      value,
      txOptions
    );
  }

  /**
   * Claim funds from an HTLC
   */
  async claim(contractId: string, preimage: string): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for claim operation');
    }

    return this.contract.claim(contractId, preimage);
  }

  /**
   * Refund funds from an expired HTLC
   */
  async refund(contractId: string): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for refund operation');
    }

    return this.contract.refund(contractId);
  }

  /**
   * Get HTLC details
   */
  async getDetails(contractId: string): Promise<HTLCDetails> {
    const result = await this.contract.getDetails(contractId);
    
    return {
      contractId,
      token: result.token,
      beneficiary: result.beneficiary,
      originator: result.originator,
      hashLock: result.hashLock,
      timelock: Number(result.timelock),
      value: result.value.toString(),
      state: result.state as SwapState
    };
  }

  /**
   * Check if HTLC is claimable
   */
  async isClaimable(contractId: string): Promise<boolean> {
    return this.contract.isClaimable(contractId);
  }

  /**
   * Check if HTLC is refundable
   */
  async isRefundable(contractId: string): Promise<boolean> {
    return this.contract.isRefundable(contractId);
  }

  /**
   * Get current blockchain time
   */
  async getCurrentTime(): Promise<number> {
    const time = await this.contract.getCurrentTime();
    return Number(time);
  }

  /**
   * Listen for Funded events
   */
  onFunded(callback: (event: FundedEvent) => void): void {
    this.contract.on('Funded', (contractId: any, originator: any, beneficiary: any, token: any, value: any, hashLock: any, timelock: any, event: any) => {
      callback({
        contractId,
        originator,
        beneficiary,
        token,
        value: value.toString(),
        hashLock,
        timelock: Number(timelock),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });
  }

  /**
   * Listen for Claimed events
   */
  onClaimed(callback: (event: ClaimedEvent) => void): void {
    this.contract.on('Claimed', (contractId: any, beneficiary: any, preimage: any, value: any, event: any) => {
      callback({
        contractId,
        beneficiary,
        preimage,
        value: value.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });
  }

  /**
   * Listen for Refunded events
   */
  onRefunded(callback: (event: RefundedEvent) => void): void {
    this.contract.on('Refunded', (contractId: any, originator: any, value: any, event: any) => {
      callback({
        contractId,
        originator,
        value: value.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.contract.removeAllListeners();
  }

  /**
   * Get past events
   */
  async getPastFundedEvents(fromBlock: number = 0, toBlock: number | 'latest' = 'latest'): Promise<FundedEvent[]> {
    const filter = this.contract.filters.Funded();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
    
    return events.map((event: any) => {
      const eventLog = event as ethers.EventLog;
      return {
        contractId: eventLog.args.contractId,
        originator: eventLog.args.originator,
        beneficiary: eventLog.args.beneficiary,
        token: eventLog.args.token,
        value: eventLog.args.value.toString(),
        hashLock: eventLog.args.hashLock,
        timelock: Number(eventLog.args.timelock),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };
    });
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<ethers.TransactionReceipt | null> {
    return this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get contract address
   */
  get contractAddress(): string {
    return this.chain.htlcAddress;
  }

  /**
   * Get provider
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Get signer
   */
  getSigner(): Signer | undefined {
    return this.signer;
  }
}