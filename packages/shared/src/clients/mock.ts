import { ethers } from 'ethers';
import type { 
  HTLCDetails, 
  CreateHTLCParams, 
  FundedEvent, 
  ClaimedEvent, 
  RefundedEvent,
  SwapState 
} from '../utils/index.js';
import type { EvmChainConfig, CosmosChainConfig } from '../chains.js';

/**
 * Mock EVM HTLC Client for testing
 */
export class MockEvmHTLCClient {
  public readonly chain: EvmChainConfig;
  private htlcs: Map<string, HTLCDetails> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(chain: EvmChainConfig) {
    this.chain = chain;
  }

  async lock(params: CreateHTLCParams): Promise<any> {
    const mockTx = {
      hash: `0x${Math.random().toString(16).slice(2)}`,
      wait: async () => ({
        status: 1,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: `0x${Math.random().toString(16).slice(2)}`
      })
    };

    // Store HTLC details
    const htlc: HTLCDetails = {
      contractId: params.contractId,
      token: params.token || ethers.ZeroAddress,
      beneficiary: params.beneficiary,
      originator: '0x' + Math.random().toString(16).slice(2, 42), // Mock originator
      hashLock: params.hashLock,
      timelock: params.timelock,
      value: params.value,
      state: 1 // OPEN
    };

    this.htlcs.set(params.contractId, htlc);

    // Emit funded event
    setTimeout(() => {
      const fundedEvent: FundedEvent = {
        contractId: params.contractId,
        originator: htlc.originator,
        beneficiary: params.beneficiary,
        token: htlc.token,
        value: params.value,
        hashLock: params.hashLock,
        timelock: params.timelock,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: mockTx.hash
      };

      this.emitEvent('Funded', fundedEvent);
    }, 100);

    return mockTx;
  }

  async claim(contractId: string, preimage: string): Promise<any> {
    const htlc = this.htlcs.get(contractId);
    if (!htlc) {
      throw new Error('HTLC not found');
    }

    // Verify preimage matches hashlock
    const expectedHash = ethers.sha256(preimage);
    if (expectedHash.toLowerCase() !== htlc.hashLock.toLowerCase()) {
      throw new Error('Invalid preimage');
    }

    // Check if claimable (not expired)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= htlc.timelock) {
      throw new Error('Timelock expired');
    }

    htlc.state = 2; // CLAIMED
    this.htlcs.set(contractId, htlc);

    const mockTx = {
      hash: `0x${Math.random().toString(16).slice(2)}`,
      wait: async () => ({
        status: 1,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: `0x${Math.random().toString(16).slice(2)}`
      })
    };

    // Emit claimed event
    setTimeout(() => {
      const claimedEvent: ClaimedEvent = {
        contractId,
        beneficiary: htlc.beneficiary,
        preimage,
        value: htlc.value,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: mockTx.hash
      };

      this.emitEvent('Claimed', claimedEvent);
    }, 100);

    return mockTx;
  }

  async refund(contractId: string): Promise<any> {
    const htlc = this.htlcs.get(contractId);
    if (!htlc) {
      throw new Error('HTLC not found');
    }

    // Check if refundable (expired)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < htlc.timelock) {
      throw new Error('Timelock not expired');
    }

    htlc.state = 3; // REFUNDED
    this.htlcs.set(contractId, htlc);

    const mockTx = {
      hash: `0x${Math.random().toString(16).slice(2)}`,
      wait: async () => ({
        status: 1,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: `0x${Math.random().toString(16).slice(2)}`
      })
    };

    // Emit refunded event
    setTimeout(() => {
      const refundedEvent: RefundedEvent = {
        contractId,
        originator: htlc.originator,
        value: htlc.value,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: mockTx.hash
      };

      this.emitEvent('Refunded', refundedEvent);
    }, 100);

    return mockTx;
  }

  async getDetails(contractId: string): Promise<HTLCDetails> {
    const htlc = this.htlcs.get(contractId);
    if (!htlc) {
      throw new Error('HTLC not found');
    }
    return htlc;
  }

  async isClaimable(contractId: string): Promise<boolean> {
    const htlc = this.htlcs.get(contractId);
    if (!htlc) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return htlc.state === 1 && currentTime < htlc.timelock;
  }

  async isRefundable(contractId: string): Promise<boolean> {
    const htlc = this.htlcs.get(contractId);
    if (!htlc) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return htlc.state === 1 && currentTime >= htlc.timelock;
  }

  async getCurrentTime(): Promise<number> {
    return Math.floor(Date.now() / 1000);
  }

  onFunded(callback: (event: FundedEvent) => void): void {
    this.addEventListener('Funded', callback);
  }

  onClaimed(callback: (event: ClaimedEvent) => void): void {
    this.addEventListener('Claimed', callback);
  }

  onRefunded(callback: (event: RefundedEvent) => void): void {
    this.addEventListener('Refunded', callback);
  }

  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  get contractAddress(): string {
    return this.chain.htlcAddress;
  }

  private addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }
}

/**
 * Mock Cosmos HTLC Client for testing
 */
export class MockCosmosHTLCClient {
  public readonly chain: CosmosChainConfig;
  private htlcs: Map<string, HTLCDetails> = new Map();

  constructor(chain: CosmosChainConfig) {
    this.chain = chain;
  }

  async instantiateHTLC(
    params: CreateHTLCParams,
    senderAddress: string,
    codeId?: number
  ): Promise<{ contractAddress: string; result: any }> {
    const contractAddress = `${this.chain.addressPrefix}1${'0'.repeat(39)}${Math.random().toString(16).slice(2, 8)}`;
    
    const htlc: HTLCDetails = {
      contractId: contractAddress,
      token: params.token || '',
      beneficiary: params.beneficiary,
      originator: senderAddress,
      hashLock: params.hashLock,
      timelock: params.timelock,
      value: params.value,
      state: 1 // OPEN
    };

    this.htlcs.set(contractAddress, htlc);

    return {
      contractAddress,
      result: {
        contractAddress,
        transactionHash: `${Math.random().toString(16).slice(2)}`,
        gasUsed: Math.floor(Math.random() * 200000),
        gasWanted: Math.floor(Math.random() * 300000)
      }
    };
  }

  async lock(contractAddress: string, senderAddress: string, amount?: string): Promise<any> {
    return {
      transactionHash: `${Math.random().toString(16).slice(2)}`,
      gasUsed: Math.floor(Math.random() * 200000)
    };
  }

  async claim(contractAddress: string, senderAddress: string, preimage: string): Promise<any> {
    const htlc = this.htlcs.get(contractAddress);
    if (!htlc) {
      throw new Error('HTLC not found');
    }

    // Verify preimage matches hashlock
    const expectedHash = ethers.sha256(preimage);
    if (expectedHash.toLowerCase() !== htlc.hashLock.toLowerCase()) {
      throw new Error('Invalid preimage');
    }

    htlc.state = 2; // CLAIMED
    this.htlcs.set(contractAddress, htlc);

    return {
      transactionHash: `${Math.random().toString(16).slice(2)}`,
      gasUsed: Math.floor(Math.random() * 200000)
    };
  }

  async refund(contractAddress: string, senderAddress: string): Promise<any> {
    const htlc = this.htlcs.get(contractAddress);
    if (!htlc) {
      throw new Error('HTLC not found');
    }

    htlc.state = 3; // REFUNDED
    this.htlcs.set(contractAddress, htlc);

    return {
      transactionHash: `${Math.random().toString(16).slice(2)}`,
      gasUsed: Math.floor(Math.random() * 200000)
    };
  }

  async getDetails(contractAddress: string): Promise<HTLCDetails> {
    const htlc = this.htlcs.get(contractAddress);
    if (!htlc) {
      throw new Error('HTLC not found');
    }
    return htlc;
  }

  async isClaimable(contractAddress: string): Promise<boolean> {
    const htlc = this.htlcs.get(contractAddress);
    if (!htlc) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return htlc.state === 1 && currentTime < htlc.timelock;
  }

  async isRefundable(contractAddress: string): Promise<boolean> {
    const htlc = this.htlcs.get(contractAddress);
    if (!htlc) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return htlc.state === 1 && currentTime >= htlc.timelock;
  }

  async getCurrentTime(): Promise<number> {
    return Math.floor(Date.now() / 1000);
  }

  async getBalance(address: string, denom?: string): Promise<string> {
    return Math.floor(Math.random() * 1000000).toString();
  }

  get contractAddress(): string {
    return this.chain.htlcAddress;
  }
}

/**
 * Factory functions for creating mock clients
 */
export function createMockEvmClient(chain: EvmChainConfig): MockEvmHTLCClient {
  return new MockEvmHTLCClient(chain);
}

export function createMockCosmosClient(chain: CosmosChainConfig): MockCosmosHTLCClient {
  return new MockCosmosHTLCClient(chain);
}