import { 
  SigningCosmWasmClient, 
  CosmWasmClient,
  ExecuteResult,
  InstantiateResult
} from '@cosmjs/cosmwasm-stargate';
import { StargateClient } from '@cosmjs/stargate';
import { OfflineSigner } from '@cosmjs/proto-signing';
import { fromHex } from '@cosmjs/encoding';
import { GasPrice } from '@cosmjs/stargate';
import type { CosmosChainConfig } from '../chains.js';
import { SwapState } from '../utils/index.js';
import type { 
  HTLCDetails, 
  CreateHTLCParams, 
  FundedEvent, 
  ClaimedEvent, 
  RefundedEvent
} from '../utils/index.js';

// CosmWasm message types based on the Rust contract
export interface InstantiateMsg {
  sender: string;
  beneficiary: string;
  hash_lock: string; // base64 encoded
  timelock: number;
  amount: string;
  token?: string; // None for native tokens, Some for CW20
}

export interface ExecuteMsg {
  fund?: Record<string, never>;
  claim?: { preimage: string }; // base64 encoded
  refund?: Record<string, never>;
  receive?: {
    sender: string;
    amount: string;
    msg: string; // base64 encoded CW20HookMsg
  };
}

export interface QueryMsg {
  get_swap?: Record<string, never>;
  is_claimable?: Record<string, never>;
  is_refundable?: Record<string, never>;
}

export interface SwapResponse {
  sender: string;
  beneficiary: string;
  hash_lock: string; // base64 encoded
  timelock: number;
  amount: string;
  token?: string;
  state: 'Open' | 'Claimed' | 'Refunded';
}

export interface CosmosHTLCClientOptions {
  chain: CosmosChainConfig;
  client?: CosmWasmClient | SigningCosmWasmClient;
  signer?: OfflineSigner;
}

export class CosmosHTLCClient {
  private client: CosmWasmClient | SigningCosmWasmClient;
  private signingClient?: SigningCosmWasmClient;
  public readonly chain: CosmosChainConfig;

  constructor(options: CosmosHTLCClientOptions) {
    this.chain = options.chain;
    
    if (options.client) {
      this.client = options.client;
      if (options.client instanceof SigningCosmWasmClient) {
        this.signingClient = options.client;
      }
    } else {
      // Create read-only client if no client provided
      throw new Error('Client connection must be established before use. Call connectWithSigner or provide client in options.');
    }
  }

  /**
   * Connect with signer for write operations
   */
  async connectWithSigner(signer: OfflineSigner): Promise<void> {
    this.signingClient = await SigningCosmWasmClient.connectWithSigner(
      this.chain.rpcUrl,
      signer,
      { gasPrice: GasPrice.fromString(`0.025${this.chain.nativeDenom}`) }
    );
    this.client = this.signingClient;
  }

  /**
   * Get signer address - Note: Address must be provided to methods directly
   */
  getSignerAddress(): string {
    throw new Error('Please provide signer address directly to client methods. CosmJS requires explicit address handling.');
  }

  /**
   * Instantiate a new HTLC contract
   * Note: This creates a new contract instance per HTLC
   */
  async instantiateHTLC(
    params: CreateHTLCParams,
    senderAddress: string,
    codeId?: number
  ): Promise<{ contractAddress: string; result: InstantiateResult }> {
    if (!this.signingClient) {
      throw new Error('Signing client required for instantiate operation');
    }

    const actualCodeId = codeId || parseInt(this.chain.codeId || '1');
    
    // Convert hex hashLock to base64
    const hashLockHex = params.hashLock.startsWith('0x') ? params.hashLock.slice(2) : params.hashLock;
    const hashLockBytes = fromHex(hashLockHex);
    const hashLockBase64 = Buffer.from(hashLockBytes).toString('base64');

    const instantiateMsg: InstantiateMsg = {
      sender: senderAddress,
      beneficiary: params.beneficiary,
      hash_lock: hashLockBase64,
      timelock: params.timelock,
      amount: params.value,
      token: params.token || undefined
    };

    const result = await this.signingClient.instantiate(
      senderAddress,
      actualCodeId,
      instantiateMsg,
      `SwapSage HTLC ${params.contractId}`,
      'auto',
      { funds: params.token ? [] : [{ denom: this.chain.nativeDenom, amount: params.value }] }
    );

    return {
      contractAddress: result.contractAddress,
      result
    };
  }

  /**
   * Lock funds in an existing HTLC (fund message)
   */
  async lock(contractAddress: string, senderAddress: string, amount?: string): Promise<ExecuteResult> {
    if (!this.signingClient) {
      throw new Error('Signing client required for lock operation');
    }

    const executeMsg: ExecuteMsg = { fund: {} };
    const funds = amount ? [{ denom: this.chain.nativeDenom, amount }] : [];

    return this.signingClient.execute(
      senderAddress,
      contractAddress,
      executeMsg,
      'auto',
      'Funding HTLC',
      funds
    );
  }

  /**
   * Claim funds from an HTLC
   */
  async claim(contractAddress: string, senderAddress: string, preimage: string): Promise<ExecuteResult> {
    if (!this.signingClient) {
      throw new Error('Signing client required for claim operation');
    }

    // Convert hex preimage to base64
    const preimageHex = preimage.startsWith('0x') ? preimage.slice(2) : preimage;
    const preimageBytes = fromHex(preimageHex);
    const preimageBase64 = Buffer.from(preimageBytes).toString('base64');

    const executeMsg: ExecuteMsg = {
      claim: { preimage: preimageBase64 }
    };

    return this.signingClient.execute(
      senderAddress,
      contractAddress,
      executeMsg,
      'auto',
      'Claiming HTLC'
    );
  }

  /**
   * Refund funds from an expired HTLC
   */
  async refund(contractAddress: string, senderAddress: string): Promise<ExecuteResult> {
    if (!this.signingClient) {
      throw new Error('Signing client required for refund operation');
    }

    const executeMsg: ExecuteMsg = { refund: {} };

    return this.signingClient.execute(
      senderAddress,
      contractAddress,
      executeMsg,
      'auto',
      'Refunding HTLC'
    );
  }

  /**
   * Get HTLC details
   */
  async getDetails(contractAddress: string): Promise<HTLCDetails> {
    const queryMsg: QueryMsg = { get_swap: {} };
    const response: SwapResponse = await this.client.queryContractSmart(contractAddress, queryMsg);
    
    // Convert base64 hash_lock back to hex
    const hashLockBytes = Buffer.from(response.hash_lock, 'base64');
    const hashLockHex = '0x' + Buffer.from(hashLockBytes).toString('hex');

    // Map state string to enum
    let state: SwapState;
    switch (response.state) {
      case 'Open': state = SwapState.OPEN; break;
      case 'Claimed': state = SwapState.CLAIMED; break;
      case 'Refunded': state = SwapState.REFUNDED; break;
      default: state = SwapState.INVALID; break;
    }
    
    return {
      contractId: contractAddress, // Use contract address as ID in Cosmos
      token: response.token || '',
      beneficiary: response.beneficiary,
      originator: response.sender,
      hashLock: hashLockHex,
      timelock: response.timelock,
      value: response.amount,
      state
    };
  }

  /**
   * Check if HTLC is claimable
   */
  async isClaimable(contractAddress: string): Promise<boolean> {
    const queryMsg: QueryMsg = { is_claimable: {} };
    return this.client.queryContractSmart(contractAddress, queryMsg);
  }

  /**
   * Check if HTLC is refundable
   */
  async isRefundable(contractAddress: string): Promise<boolean> {
    const queryMsg: QueryMsg = { is_refundable: {} };
    return this.client.queryContractSmart(contractAddress, queryMsg);
  }

  /**
   * Get current blockchain time
   */
  async getCurrentTime(): Promise<number> {
    const client = await StargateClient.connect(this.chain.rpcUrl);
    const block = await client.getBlock();
    return Math.floor(new Date(block.header.time).getTime() / 1000);
  }

  /**
   * Search for transactions by events
   */
  async searchTxs(query: string): Promise<any[]> {
    const client = await StargateClient.connect(this.chain.rpcUrl);
    return client.searchTx(query);
  }

  /**
   * Get funded events by searching for wasm events
   */
  async getFundedEvents(contractAddress?: string): Promise<FundedEvent[]> {
    const query = contractAddress 
      ? `wasm.contract_address='${contractAddress}' AND wasm.method='fund'`
      : "wasm.method='fund'";
    
    const txs = await this.searchTxs(query);
    
    return txs.map(tx => {
      const events = tx.events || [];
      const wasmEvent = events.find((e: any) => e.type === 'wasm');
      const attributes = wasmEvent?.attributes || [];
      
      return {
        contractId: contractAddress || '',
        originator: this.getAttribute(attributes, 'sender') || '',
        beneficiary: this.getAttribute(attributes, 'beneficiary') || '',
        token: this.getAttribute(attributes, 'token') || '',
        value: this.getAttribute(attributes, 'amount') || '0',
        hashLock: this.getAttribute(attributes, 'hash_lock') || '',
        timelock: parseInt(this.getAttribute(attributes, 'timelock') || '0'),
        blockNumber: tx.height,
        transactionHash: tx.hash
      };
    });
  }

  /**
   * Get claimed events
   */
  async getClaimedEvents(contractAddress?: string): Promise<ClaimedEvent[]> {
    const query = contractAddress 
      ? `wasm.contract_address='${contractAddress}' AND wasm.method='claim'`
      : "wasm.method='claim'";
    
    const txs = await this.searchTxs(query);
    
    return txs.map(tx => {
      const events = tx.events || [];
      const wasmEvent = events.find((e: any) => e.type === 'wasm');
      const attributes = wasmEvent?.attributes || [];
      
      return {
        contractId: contractAddress || '',
        beneficiary: this.getAttribute(attributes, 'beneficiary') || '',
        preimage: this.getAttribute(attributes, 'preimage') || '',
        value: this.getAttribute(attributes, 'amount') || '0',
        blockNumber: tx.height,
        transactionHash: tx.hash
      };
    });
  }

  /**
   * Get refunded events
   */
  async getRefundedEvents(contractAddress?: string): Promise<RefundedEvent[]> {
    const query = contractAddress 
      ? `wasm.contract_address='${contractAddress}' AND wasm.method='refund'`
      : "wasm.method='refund'";
    
    const txs = await this.searchTxs(query);
    
    return txs.map(tx => {
      const events = tx.events || [];
      const wasmEvent = events.find((e: any) => e.type === 'wasm');
      const attributes = wasmEvent?.attributes || [];
      
      return {
        contractId: contractAddress || '',
        originator: this.getAttribute(attributes, 'sender') || '',
        value: this.getAttribute(attributes, 'amount') || '0',
        blockNumber: tx.height,
        transactionHash: tx.hash
      };
    });
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string, denom?: string): Promise<string> {
    const client = await StargateClient.connect(this.chain.rpcUrl);
    const balance = await client.getBalance(address, denom || this.chain.nativeDenom);
    return balance.amount;
  }

  /**
   * Get contract address (for single-contract mode)
   */
  get contractAddress(): string {
    return this.chain.htlcAddress;
  }

  /**
   * Helper to get attribute value from event attributes
   */
  private getAttribute(attributes: any[], key: string): string | undefined {
    const attr = attributes.find(a => a.key === key);
    return attr?.value;
  }

  /**
   * Get client instance
   */
  getClient(): CosmWasmClient | SigningCosmWasmClient {
    return this.client;
  }

  /**
   * Get signing client if available
   */
  getSigningClient(): SigningCosmWasmClient | undefined {
    return this.signingClient;
  }
}