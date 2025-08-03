import { ethers } from 'ethers';
import { FusionDatabase, FusionDAO, SwapRequest, SwapStatus, ResolverOperationType, OperationStatus } from '../database';
import { EventEmitter } from 'events';
import { getToken } from '../tokens';

export interface ResolverConfig {
  processingInterval: number; // ms
  maxBatchSize: number;
  maxRetries: number;
  gasLimit: number;
  maxGasPrice: string; // wei
  htlcContractAddress: string;
  poolWalletPrivateKey: string;
  rpcUrl: string;
  chainId: number;
  chainName: string; // Add chain identifier
}

export interface PoolLiquidityInfo {
  tokenAddress: string;
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  minThreshold: string;
}

export interface PriceInfo {
  tokenAddress: string;
  priceUsd: number;
  confidence: number;
  lastUpdated: Date;
}

// Define both ABIs
const FUSION_HTLC_ABI = [
  // getDetails for FusionHTLC
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
  // contracts for SimpleHTLC
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "contracts",
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
  // Other functions
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
    "inputs": [{ "internalType": "bytes32", "name": "_contractId", "type": "bytes32" }],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "name": "HTLCCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "contractId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "claimer", "type": "address" },
      { "indexed": false, "internalType": "bytes32", "name": "preimage", "type": "bytes32" }
    ],
    "name": "HTLCClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "contractId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "refunder", "type": "address" }
    ],
    "name": "HTLCRefunded",
    "type": "event"
  }
];

// ERC20 ABI for token operations
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

export class FusionResolver extends EventEmitter {
  private dao: FusionDAO;
  private provider: ethers.JsonRpcProvider;
  private poolWallet: ethers.Wallet;
  private htlcContract: ethers.Contract;
  private isProcessing = false;
  private processingTimer?: NodeJS.Timeout;
  private chainName: string;
  private contractType: 'SimpleHTLC' | 'FusionHTLC' | null = null;

  constructor(
    private config: ResolverConfig,
    database: FusionDatabase
  ) {
    super();
    this.chainName = config.chainName;
    this.dao = new FusionDAO(database);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.poolWallet = new ethers.Wallet(config.poolWalletPrivateKey, this.provider);
    
    // Initialize contract with combined ABI
    this.htlcContract = new ethers.Contract(
      config.htlcContractAddress,
      FUSION_HTLC_ABI,
      this.poolWallet
    );
  }

  async detectContractType(): Promise<void> {
    if (this.contractType) return;
    
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    
    try {
      await this.htlcContract.contracts(testId);
      this.contractType = 'SimpleHTLC';
      console.log(`✅ Detected SimpleHTLC contract at ${this.config.htlcContractAddress} on ${this.chainName}`);
    } catch {
      try {
        await this.htlcContract.getDetails(testId);
        this.contractType = 'FusionHTLC';
        console.log(`✅ Detected FusionHTLC contract at ${this.config.htlcContractAddress} on ${this.chainName}`);
      } catch (error) {
        console.error(`❌ Contract at ${this.config.htlcContractAddress} doesn't support contracts() or getDetails()`);
        throw new Error(`Invalid HTLC contract on ${this.chainName}`);
      }
    }
  }

  async getContractDetails(contractId: string): Promise<any> {
    await this.detectContractType();
    
    try {
      if (this.contractType === 'SimpleHTLC') {
        return await this.htlcContract.contracts(contractId);
      } else {
        return await this.htlcContract.getDetails(contractId);
      }
    } catch (error) {
      console.error(`Failed to get contract details for ${contractId}:`, error);
      throw error;
    }
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting FusionResolver for ${this.chainName}...`);
    
    try {
      await this.detectContractType();
      
      // Start processing timer
      this.processingTimer = setInterval(
        () => this.processSwapQueue(),
        this.config.processingInterval
      );
      
      this.emit('started');
      console.log(`✅ FusionResolver started for ${this.chainName}`);
      
      // Process immediately on start
      await this.processSwapQueue();
    } catch (error) {
      console.error(`Failed to start resolver for ${this.chainName}:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(`Stopping FusionResolver for ${this.chainName}...`);
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
    
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.emit('stopped');
    console.log(`✅ FusionResolver stopped for ${this.chainName}`);
  }

  private async processSwapQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get pending swaps for this chain
      const pendingSwaps = await this.dao.getPendingSwapsForChain(
        this.chainName,
        this.config.maxBatchSize
      );
      
      if (pendingSwaps.length === 0) {
        return;
      }
      
      console.log(`Processing ${pendingSwaps.length} swaps on ${this.chainName}...`);
      
      for (const swap of pendingSwaps) {
        try {
          await this.processSwap(swap);
          this.emit('swapProcessed', swap.id);
        } catch (error: any) {
          console.error(`Failed to process swap ${swap.id}:`, error);
          await this.handleSwapError(swap, error);
          this.emit('error', error);
        }
      }
    } catch (error: any) {
      console.error(`Error in processSwapQueue for ${this.chainName}:`, error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSwap(swap: SwapRequest): Promise<void> {
    console.log(`\n📋 Processing swap ${swap.id} on ${this.chainName}`);
    console.log(`   Status: ${swap.status}`);
    console.log(`   Source: ${swap.sourceChain} -> Target: ${swap.targetChain}`);
    
    // Determine if this resolver should handle source or target chain
    if (this.chainName.toLowerCase() === swap.sourceChain.toLowerCase()) {
      await this.processSourceChain(swap);
    } else if (this.chainName.toLowerCase() === swap.targetChain.toLowerCase()) {
      await this.processTargetChain(swap);
    } else {
      console.log(`⚠️  Swap ${swap.id} not for ${this.chainName}, skipping`);
    }
  }

  private async processSourceChain(swap: SwapRequest): Promise<void> {
    console.log(`Processing source chain for swap ${swap.id}`);
    
    // Validate user HTLC
    await this.validateUserHTLC(swap);
    
    // Update swap status to validated
    await this.dao.updateSwapStatus(swap.id, 'USER_HTLC_FUNDED');
    console.log(`✅ User HTLC validated for swap ${swap.id}`);
  }

  private async processTargetChain(swap: SwapRequest): Promise<void> {
    console.log(`Processing target chain for swap ${swap.id}`);
    
    if (swap.status === 'USER_HTLC_FUNDED' && !swap.poolHtlcContract) {
      // Deploy pool HTLC
      const poolContractId = await this.deployAndVerifyPoolHTLC(swap);
      
      if (poolContractId) {
        // Update swap with pool HTLC info
        await this.dao.updateSwapRequest({
          id: swap.id,
          poolHtlcContract: poolContractId,
          status: 'POOL_FULFILLED'
        });
        
        console.log(`✅ Pool HTLC created for swap ${swap.id}`);
        console.log(`   Pool contract ID: ${poolContractId}`);
      }
    }
  }

  private async validateUserHTLC(swap: SwapRequest): Promise<void> {
    if (!swap.userHtlcContract) {
      throw new Error('User HTLC contract not set');
    }
    
    console.log(`Validating user HTLC ${swap.userHtlcContract}...`);
    
    // Check if HTLC is funded on-chain
    try {
      let contractDetails = await this.getContractDetails(swap.userHtlcContract);
      
      console.log(`HTLC Details for ${swap.userHtlcContract}:`, {
        token: contractDetails.token,
        value: contractDetails.value.toString(),
        state: contractDetails.state
      });
      
      // If state is 0 (INVALID), wait and retry once
      if (contractDetails.state === 0) {
        console.log('HTLC state is 0, waiting 3 seconds and retrying...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        contractDetails = await this.getContractDetails(swap.userHtlcContract);
        console.log(`Retry HTLC Details:`, {
          token: contractDetails.token,
          value: contractDetails.value.toString(),
          state: contractDetails.state
        });
      }
      
      // Check if HTLC is in funded state (state = 1)
      if (contractDetails.state !== 1) {
        throw new Error(`User HTLC ${swap.userHtlcContract} not in funded state (state=${contractDetails.state})`);
      }
      
      // Validate amount matches
      const expectedValue = swap.sourceAmount.toString();
      const actualValue = contractDetails.value.toString();
      
      if (actualValue !== expectedValue) {
        throw new Error(`Amount mismatch: expected ${expectedValue} but got ${actualValue}`);
      }
      
      // Validate hash lock matches
      if (contractDetails.hashLock.toLowerCase() !== swap.hashLock.toLowerCase()) {
        throw new Error(`Hash lock mismatch`);
      }
      
      console.log(`✅ User HTLC validation passed`);
    } catch (error: any) {
      console.error(`❌ HTLC validation error for ${swap.userHtlcContract}:`, error);
      throw new Error(`User HTLC validation failed: ${error.message}`);
    }
  }

  private async deployAndVerifyPoolHTLC(swap: SwapRequest): Promise<string | null> {
    try {
      console.log(`Deploying pool HTLC for swap ${swap.id}...`);
      
      // Generate pool contract ID
      const poolContractId = ethers.keccak256(
        ethers.toUtf8Bytes(`${swap.id}-pool`)
      );
      
      // Get target token info
      const targetToken = getToken(swap.targetChain, swap.targetToken);
      if (!targetToken) {
        throw new Error(`Target token ${swap.targetToken} not found`);
      }
      
      // Calculate target amount (1:1 for now)
      const targetAmount = swap.targetAmount.toString();
      
      // Deploy HTLC
      await this.deployPoolHTLC(
        poolContractId,
        targetToken.address,
        swap.userAddress,
        swap.hashLock,
        swap.timelock,
        targetAmount
      );
      
      // Verify deployment
      const isDeployed = await this.verifyPoolHTLCDeployment(poolContractId);
      if (!isDeployed) {
        throw new Error('Pool HTLC deployment verification failed');
      }
      
      console.log(`✅ Pool HTLC deployed: ${poolContractId}`);
      return poolContractId;
      
    } catch (error: any) {
      console.error(`Failed to deploy pool HTLC:`, error);
      throw error;
    }
  }

  private async verifyPoolHTLCDeployment(contractId: string): Promise<boolean> {
    try {
      const contractDetails = await this.getContractDetails(contractId);
      
      // Check if HTLC is in funded state (state = 1)
      return contractDetails.state === 1;
    } catch (error) {
      console.error(`Failed to verify pool HTLC ${contractId}:`, error);
      return false;
    }
  }

  private async deployPoolHTLC(
    contractId: string,
    tokenAddress: string,
    beneficiary: string,
    hashLock: string,
    timelock: number,
    value: string
  ): Promise<void> {
    console.log(`Deploying HTLC with params:`, {
      contractId,
      tokenAddress,
      beneficiary,
      hashLock,
      timelock,
      value
    });
    
    try {
      // Check if we need to approve tokens first
      if (tokenAddress !== ethers.ZeroAddress) {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          this.poolWallet
        );
        
        const currentAllowance = await tokenContract.allowance(
          this.poolWallet.address,
          this.config.htlcContractAddress
        );
        
        if (BigInt(currentAllowance.toString()) < BigInt(value)) {
          console.log('Approving token transfer...');
          const approveTx = await tokenContract.approve(
            this.config.htlcContractAddress,
            value
          );
          await approveTx.wait();
          console.log('✅ Token approval completed');
        }
      }
      
      // Fund the HTLC
      const tx = await this.htlcContract.fund(
        contractId,
        tokenAddress,
        beneficiary,
        hashLock,
        Math.floor(Date.now() / 1000) + timelock,
        value,
        { 
          value: tokenAddress === ethers.ZeroAddress ? value : 0,
          gasLimit: this.config.gasLimit
        }
      );
      
      console.log(`Pool HTLC tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Pool HTLC confirmed in block ${receipt.blockNumber}`);
      
    } catch (error: any) {
      console.error('Failed to deploy pool HTLC:', error);
      throw new Error(`Failed to deploy pool HTLC: ${error.message}`);
    }
  }

  private async handleSwapError(swap: SwapRequest, error: Error): Promise<void> {
    console.error(`❌ Error processing swap ${swap.id}:`, error.message);
    
    // Update swap status to error
    await this.dao.updateSwapStatus(swap.id, 'ERROR');
    
    // Log error to database
    await this.dao.createResolverOperation({
      swapRequestId: swap.id,
      operationType: 'ERROR' as ResolverOperationType,
      status: 'FAILED' as OperationStatus,
      errorMessage: error.message,
      gasUsed: '0',
      transactionHash: null
    });
  }

  // Public methods for monitoring
  async getPoolLiquidity(tokenAddress: string): Promise<PoolLiquidityInfo> {
    const balance = await this.getTokenBalance(tokenAddress);
    
    // For now, return simple info
    return {
      tokenAddress,
      totalBalance: balance,
      availableBalance: balance,
      reservedBalance: '0',
      minThreshold: '1000000000000000000' // 1 token
    };
  }

  private async getTokenBalance(tokenAddress: string): Promise<string> {
    if (tokenAddress === ethers.ZeroAddress) {
      // Native token
      const balance = await this.provider.getBalance(this.poolWallet.address);
      return balance.toString();
    } else {
      // ERC20 token
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      const balance = await tokenContract.balanceOf(this.poolWallet.address);
      return balance.toString();
    }
  }

  async getPoolWalletAddress(): Promise<string> {
    return this.poolWallet.address;
  }
}