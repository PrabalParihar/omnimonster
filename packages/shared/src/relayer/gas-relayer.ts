import { ethers } from 'ethers';
import { FusionDatabase, FusionDAO, GaslessClaim, OperationStatus } from '../database';
import { EventEmitter } from 'events';

export interface RelayerConfig {
  rpcUrl: string;
  chainId: number;
  relayerPrivateKey: string;
  gasRelayerContractAddress: string;
  processingInterval: number; // ms
  maxBatchSize: number;
  maxGasPrice: string; // wei
  minRelayerBalance: string; // wei
  maxClaimsPerHour: number;
  emergencyStopThreshold: string; // wei - stop if balance drops below this
}

export interface ClaimRequest {
  htlcContract: string;
  contractId: string;
  preimage: string;
  beneficiary: string;
  maxGasPrice: string;
  gasCompensation: string;
  nonce: number;
  deadline: number;
  signature: string;
}

export interface RelayerStats {
  totalClaims: number;
  successfulClaims: number;
  failedClaims: number;
  totalGasUsed: string;
  totalFeesEarned: string;
  averageGasPrice: string;
  uptime: number; // seconds
  currentBalance: string;
  isOperational: boolean;
}

export class FusionGasRelayer extends EventEmitter {
  private dao: FusionDAO;
  private provider: ethers.JsonRpcProvider;
  private relayerWallet: ethers.Wallet;
  private gasRelayerContract: ethers.Contract;
  private isProcessing = false;
  private processingTimer?: NodeJS.Timeout;
  private startTime: number;
  private emergencyStop = false;
  private stats: RelayerStats;

  constructor(
    private config: RelayerConfig,
    database: FusionDatabase
  ) {
    super();
    this.dao = new FusionDAO(database);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.relayerWallet = new ethers.Wallet(config.relayerPrivateKey, this.provider);
    this.startTime = Date.now();
    
    // Initialize stats
    this.stats = {
      totalClaims: 0,
      successfulClaims: 0,
      failedClaims: 0,
      totalGasUsed: '0',
      totalFeesEarned: '0',
      averageGasPrice: '0',
      uptime: 0,
      currentBalance: '0',
      isOperational: false
    };

    // Initialize gas relayer contract
    const gasRelayerABI = [
      "function executeGaslessClaim(tuple(address htlcContract, bytes32 contractId, bytes32 preimage, address beneficiary, uint256 maxGasPrice, uint256 gasCompensation, uint256 nonce, uint256 deadline) request, bytes signature) external",
      "function getUserNonce(address user) external view returns (uint256)",
      "function isRelayerAuthorized(address relayer) external view returns (bool)",
      "function estimateClaimCost(tuple(address htlcContract, bytes32 contractId, bytes32 preimage, address beneficiary, uint256 maxGasPrice, uint256 gasCompensation, uint256 nonce, uint256 deadline) request) external view returns (uint256 estimatedGas, uint256 estimatedCost, uint256 relayerFee, uint256 totalCost)",
      "event GaslessClaimExecuted(address indexed relayer, address indexed beneficiary, address htlcContract, bytes32 contractId, uint256 gasUsed, uint256 gasPrice, uint256 totalCost, uint256 relayerFee)"
    ];
    
    this.gasRelayerContract = new ethers.Contract(
      config.gasRelayerContractAddress,
      gasRelayerABI,
      this.relayerWallet
    );
  }

  /**
   * Start the gas relayer service
   */
  async start(): Promise<void> {
    console.log('Starting Fusion Gas Relayer...');
    
    // Check relayer authorization
    const isAuthorized = await this.gasRelayerContract.isRelayerAuthorized(this.relayerWallet.address);
    if (!isAuthorized) {
      throw new Error('Relayer wallet is not authorized');
    }

    // Check initial balance
    await this.checkBalance();
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    // Start processing loop
    this.processingTimer = setInterval(async () => {
      try {
        await this.processingLoop();
      } catch (error) {
        console.error('Error in gas relayer processing loop:', error);
        this.emit('error', error);
      }
    }, this.config.processingInterval);

    this.stats.isOperational = true;
    console.log(`Gas relayer started with ${this.config.processingInterval}ms interval`);
    this.emit('started');
  }

  /**
   * Stop the gas relayer service
   */
  async stop(): Promise<void> {
    console.log('Stopping Fusion Gas Relayer...');
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    this.isProcessing = false;
    this.stats.isOperational = false;
    this.emergencyStop = false;
    
    console.log('Gas relayer stopped');
    this.emit('stopped');
  }

  /**
   * Main processing loop
   */
  private async processingLoop(): Promise<void> {
    if (this.isProcessing || this.emergencyStop) {
      return;
    }

    this.isProcessing = true;

    try {
      // Update stats
      await this.updateStats();
      
      // Check balance and emergency stop if needed
      await this.checkBalance();
      
      if (this.emergencyStop) {
        console.log('Emergency stop activated - insufficient balance');
        return;
      }

      // Get pending gasless claims
      const pendingClaims = await this.dao.getPendingGaslessClaims(this.config.maxBatchSize);
      
      if (pendingClaims.length === 0) {
        return;
      }

      console.log(`Processing ${pendingClaims.length} pending gasless claims`);

      // Process each claim
      for (const claim of pendingClaims) {
        try {
          await this.processClaim(claim);
        } catch (error) {
          console.error(`Error processing claim ${claim.id}:`, error);
          await this.handleClaimError(claim.id, error as Error);
        }
      }

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single gasless claim
   */
  private async processClaim(claim: GaslessClaim): Promise<void> {
    console.log(`Processing gasless claim ${claim.id} for ${claim.claimerAddress}`);

    try {
      // Update claim status to in progress
      await this.dao.updateGaslessClaim(claim.id, { 
        status: OperationStatus.IN_PROGRESS 
      });

      // Validate claim parameters
      await this.validateClaim(claim);

      // Check rate limits
      await this.checkRateLimit(claim.claimerAddress);

      // Estimate gas cost
      const estimation = await this.estimateClaimCost(claim);
      
      // Check if gas price is acceptable
      if (BigInt(estimation.gasPrice) > BigInt(this.config.maxGasPrice)) {
        throw new Error(`Gas price too high: ${estimation.gasPrice} > ${this.config.maxGasPrice}`);
      }

      // Execute the gasless claim
      const txHash = await this.executeGaslessClaim(claim);
      
      // Wait for confirmation
      const receipt = await this.provider.waitForTransaction(txHash);
      
      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      // Update claim status
      await this.dao.updateGaslessClaim(claim.id, {
        status: OperationStatus.COMPLETED,
        txHash: receipt.hash,
        gasUsed: Number(receipt.gasUsed),
        gasPrice: Number(receipt.gasPrice || 0),
        executedAt: new Date()
      });

      // Update stats
      this.stats.successfulClaims++;
      this.stats.totalGasUsed = (BigInt(this.stats.totalGasUsed) + BigInt(receipt.gasUsed)).toString();
      
      console.log(`Successfully processed gasless claim ${claim.id}, tx: ${receipt.hash}`);
      this.emit('claimProcessed', claim.id, receipt.hash);

    } catch (error) {
      console.error(`Failed to process gasless claim ${claim.id}:`, error);
      throw error;
    }
  }

  /**
   * Validate claim parameters
   */
  private async validateClaim(claim: GaslessClaim): Promise<void> {
    // Check deadline
    if (claim.deadline && Date.now() / 1000 > claim.deadline) {
      throw new Error('Claim request expired');
    }

    // Validate signature format
    if (!claim.signature || claim.signature.length !== 132) {
      throw new Error('Invalid signature format');
    }

    // Validate contract addresses
    if (!ethers.isAddress(claim.htlcContract) || !ethers.isAddress(claim.claimerAddress)) {
      throw new Error('Invalid contract addresses');
    }

    // Check if preimage is valid format
    if (!claim.preimage || claim.preimage.length !== 66) {
      throw new Error('Invalid preimage format');
    }
  }

  /**
   * Check rate limits for a user
   */
  private async checkRateLimit(userAddress: string): Promise<void> {
    // Query recent claims for this user
    const recentClaims = await this.dao.query(
      'SELECT COUNT(*) as count FROM gasless_claims WHERE claimer_address = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
      [userAddress]
    );

    const claimCount = parseInt(recentClaims.rows[0]?.count || '0');
    
    if (claimCount >= this.config.maxClaimsPerHour) {
      throw new Error(`Rate limit exceeded: ${claimCount}/${this.config.maxClaimsPerHour} claims per hour`);
    }
  }

  /**
   * Estimate gas cost for a claim
   */
  private async estimateClaimCost(claim: GaslessClaim): Promise<{
    estimatedGas: number;
    estimatedCost: string;
    relayerFee: string;
    totalCost: string;
    gasPrice: string;
  }> {
    try {
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(this.config.maxGasPrice);

      // Estimate gas using the contract
      const request = {
        htlcContract: claim.htlcContract,
        contractId: claim.contractId,
        preimage: claim.preimage,
        beneficiary: claim.claimerAddress,
        maxGasPrice: gasPrice.toString(),
        gasCompensation: claim.gasCompensation || '0',
        nonce: claim.nonce,
        deadline: claim.deadline
      };

      const [estimatedGas, estimatedCost, relayerFee, totalCost] = await this.gasRelayerContract.estimateClaimCost(request);

      return {
        estimatedGas: Number(estimatedGas),
        estimatedCost: estimatedCost.toString(),
        relayerFee: relayerFee.toString(),
        totalCost: totalCost.toString(),
        gasPrice: gasPrice.toString()
      };

    } catch (error) {
      // Fallback estimation
      const gasPrice = (await this.provider.getFeeData()).gasPrice || BigInt(this.config.maxGasPrice);
      const estimatedGas = 150000; // Conservative estimate
      const estimatedCost = BigInt(estimatedGas) * gasPrice;
      const relayerFee = ethers.parseEther('0.001'); // Base fee
      
      return {
        estimatedGas,
        estimatedCost: estimatedCost.toString(),
        relayerFee: relayerFee.toString(),
        totalCost: (estimatedCost + relayerFee).toString(),
        gasPrice: gasPrice.toString()
      };
    }
  }

  /**
   * Execute gasless claim transaction
   */
  private async executeGaslessClaim(claim: GaslessClaim): Promise<string> {
    const request = {
      htlcContract: claim.htlcContract,
      contractId: claim.contractId,
      preimage: claim.preimage,
      beneficiary: claim.claimerAddress,
      maxGasPrice: this.config.maxGasPrice,
      gasCompensation: claim.gasCompensation || '0',
      nonce: claim.nonce,
      deadline: claim.deadline
    };

    try {
      const tx = await this.gasRelayerContract.executeGaslessClaim(
        request,
        claim.signature,
        {
          gasLimit: 200000, // Conservative gas limit
          maxFeePerGas: this.config.maxGasPrice
        }
      );

      return tx.hash;

    } catch (error) {
      throw new Error(`Failed to execute gasless claim: ${(error as Error).message}`);
    }
  }

  /**
   * Handle claim processing errors
   */
  private async handleClaimError(claimId: string, error: Error): Promise<void> {
    console.error(`Gasless claim ${claimId} error:`, error.message);
    
    // Update claim status
    await this.dao.updateGaslessClaim(claimId, {
      status: OperationStatus.FAILED,
      errorMessage: error.message
    });

    // Update stats
    this.stats.failedClaims++;
    
    this.emit('claimError', claimId, error);
  }

  /**
   * Check relayer balance and trigger emergency stop if needed
   */
  private async checkBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.relayerWallet.address);
    this.stats.currentBalance = balance.toString();
    
    if (balance < BigInt(this.config.emergencyStopThreshold)) {
      this.emergencyStop = true;
      this.stats.isOperational = false;
      
      console.error(`Emergency stop triggered: balance ${ethers.formatEther(balance)} < threshold ${ethers.formatEther(this.config.emergencyStopThreshold)}`);
      this.emit('emergencyStop', balance.toString());
    } else if (balance < BigInt(this.config.minRelayerBalance)) {
      console.warn(`Low balance warning: ${ethers.formatEther(balance)} < ${ethers.formatEther(this.config.minRelayerBalance)}`);
      this.emit('lowBalance', balance.toString());
    }
  }

  /**
   * Update relayer statistics
   */
  private async updateStats(): Promise<void> {
    // Update uptime
    this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Get total claims from database
    const claimStats = await this.dao.query(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful_claims,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_claims,
        COALESCE(SUM(gas_used), 0) as total_gas_used,
        COALESCE(SUM(relay_fee), 0) as total_fees_earned,
        COALESCE(AVG(gas_price), 0) as avg_gas_price
      FROM gasless_claims
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const stats = claimStats.rows[0];
    if (stats) {
      this.stats.totalClaims = parseInt(stats.total_claims);
      this.stats.successfulClaims = parseInt(stats.successful_claims);
      this.stats.failedClaims = parseInt(stats.failed_claims);
      this.stats.totalGasUsed = stats.total_gas_used || '0';
      this.stats.totalFeesEarned = stats.total_fees_earned || '0';
      this.stats.averageGasPrice = stats.avg_gas_price || '0';
    }
  }

  /**
   * Get current relayer statistics
   */
  getStats(): RelayerStats {
    return { ...this.stats };
  }

  /**
   * Submit a new gasless claim request
   */
  async submitClaimRequest(claimRequest: ClaimRequest): Promise<string> {
    // Validate request
    if (!claimRequest.signature || !claimRequest.beneficiary || !claimRequest.htlcContract) {
      throw new Error('Invalid claim request parameters');
    }

    // Check rate limits
    await this.checkRateLimit(claimRequest.beneficiary);

    // Create database record
    const claim = await this.dao.createGaslessClaim({
      swapRequestId: claimRequest.contractId, // This should be mapped properly
      claimerAddress: claimRequest.beneficiary,
      htlcContract: claimRequest.htlcContract,
      contractId: claimRequest.contractId,
      preimage: claimRequest.preimage,
      signature: claimRequest.signature,
      status: OperationStatus.PENDING
    });

    console.log(`Submitted gasless claim request ${claim.id} for ${claimRequest.beneficiary}`);
    this.emit('claimSubmitted', claim.id);

    return claim.id;
  }

  /**
   * Get claim status
   */
  async getClaimStatus(claimId: string): Promise<GaslessClaim | null> {
    return await this.dao.query('SELECT * FROM gasless_claims WHERE id = $1', [claimId])
      .then(result => result.rows[0] || null);
  }

  /**
   * Emergency pause processing
   */
  pause(): void {
    this.isProcessing = false;
    this.stats.isOperational = false;
    console.log('Gas relayer processing paused');
    this.emit('paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.emergencyStop = false;
    this.stats.isOperational = true;
    console.log('Gas relayer processing resumed');
    this.emit('resumed');
  }

  /**
   * Withdraw accumulated fees
   */
  async withdrawFees(recipientAddress: string): Promise<string> {
    // This would interact with the gas relayer contract to withdraw fees
    // For now, just transfer current balance minus minimum required
    const balance = await this.provider.getBalance(this.relayerWallet.address);
    const minBalance = BigInt(this.config.minRelayerBalance);
    
    if (balance <= minBalance) {
      throw new Error('Insufficient balance to withdraw');
    }

    const withdrawAmount = balance - minBalance;
    
    const tx = await this.relayerWallet.sendTransaction({
      to: recipientAddress,
      value: withdrawAmount,
      gasLimit: 21000
    });

    await tx.wait();
    
    console.log(`Withdrew ${ethers.formatEther(withdrawAmount)} ETH to ${recipientAddress}`);
    this.emit('feesWithdrawn', withdrawAmount.toString(), recipientAddress);
    
    return tx.hash;
  }
}

export default FusionGasRelayer;