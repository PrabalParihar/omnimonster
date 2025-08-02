import { ethers, JsonRpcProvider, Wallet, Contract } from 'ethers';
import { randomBytes, createHash } from 'crypto';
import { swapDatabase, SwapRecord, SwapEvent } from './database';

// Contract ABIs (simplified for the essential functions)
const FUSION_HTLC_ABI = [
  'function fundERC20(bytes32 contractId, address payable beneficiary, bytes32 hashLock, uint256 timelock, address token, uint256 value)',
  'function fundETH(bytes32 contractId, address payable beneficiary, bytes32 hashLock, uint256 timelock) payable',
  'function claim(bytes32 contractId, bytes32 preimage)',
  'function refund(bytes32 contractId)',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function generateId(address originator, address beneficiary, bytes32 hashLock, uint256 timelock, address token, uint256 value, uint256 nonce) pure returns (bytes32)',
  'function isClaimable(bytes32 contractId) view returns (bool)',
  'function isRefundable(bytes32 contractId) view returns (bool)',
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)',
  'event HTLCClaimed(bytes32 indexed contractId, address indexed claimer, bytes32 preimage)',
  'event HTLCRefunded(bytes32 indexed contractId, address indexed refunder)'
];

const FUSION_POOL_MANAGER_ABI = [
  'function fulfillSwap(bytes32 userContractId, address userToken, address poolToken, uint256 userAmount, uint256 poolAmount, address user, uint256 timelock, bytes32 hashLock) returns (bytes32)',
  'function claimUserTokens(bytes32 userContractId, bytes32 preimage)',
  'function canFulfillSwap(address token, uint256 amount) view returns (bool)',
  'function getTokenPool(address token) view returns (uint256 totalBalance, uint256 availableBalance, uint256 reservedBalance, uint256 minThreshold, bool isActive)',
  'function getSupportedTokens() view returns (address[])',
  'event SwapFulfilled(bytes32 indexed userContractId, bytes32 indexed poolContractId, address indexed user, address userToken, address poolToken, uint256 userAmount, uint256 poolAmount)',
  'event SwapCompleted(bytes32 indexed userContractId, bytes32 indexed poolContractId)'
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

interface SwapRequest {
  fromChain: string;
  toChain: string;
  amount: string;
  beneficiary: string;
  timelock?: number;
  slippage?: number;
  dryRun?: boolean;
}

interface SwapResult {
  id: string;
  status: 'pending' | 'pool_fulfilled' | 'user_claimed' | 'expired' | 'cancelled';
  userContractId?: string;
  poolContractId?: string;
  preimage?: string;
  hashLock?: string;
  events?: any[];
  createdAt: Date;
  updatedAt: Date;
}

// Contract addresses from deployment
const CONTRACT_ADDRESSES = {
  localhost: {
    FusionHTLC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    FusionPoolManager: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    FusionForwarder: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    SwapSageHTLCForwarder: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    SimpleMonsterToken: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
  }
};

export class RealAtomicOrchestrator {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private htlcContract: Contract;
  private poolManagerContract: Contract;
  private activeSwaps: Map<string, SwapResult> = new Map();

  constructor() {
    // Initialize with localhost for development
    this.provider = new JsonRpcProvider('http://127.0.0.1:8545');
    
    // Use the first test account from Hardhat
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    this.wallet = new Wallet(privateKey, this.provider);
    
    // Initialize contracts
    const addresses = CONTRACT_ADDRESSES.localhost;
    this.htlcContract = new Contract(addresses.FusionHTLC, FUSION_HTLC_ABI, this.wallet);
    this.poolManagerContract = new Contract(addresses.FusionPoolManager, FUSION_POOL_MANAGER_ABI, this.wallet);
  }

  async createSwap(request: SwapRequest): Promise<SwapResult> {
    try {
      console.log('🔄 Creating swap request:', request);
      
      if (request.dryRun) {
        return this.createDryRunSwap(request);
      }

      // Generate unique preimage and hash lock
      const preimage = '0x' + randomBytes(32).toString('hex');
      const hashLock = '0x' + createHash('sha256').update(Buffer.from(preimage.slice(2), 'hex')).digest('hex');
      
      // Default timelock: 24 hours from now
      const timelock = Math.floor(Date.now() / 1000) + (request.timelock || 24 * 60 * 60);
      
      // For demo, we'll use the test token
      const tokenAddress = CONTRACT_ADDRESSES.localhost.SimpleMonsterToken;
      const amount = ethers.parseEther(request.amount);
      
      // Generate contract ID
      const nonce = Math.floor(Date.now() / 1000);
      const contractId = await this.htlcContract.generateId(
        this.wallet.address,
        request.beneficiary,
        hashLock,
        timelock,
        tokenAddress,
        amount,
        nonce
      );

      // Create swap record for database
      const swapRecord: SwapRecord = {
        id: contractId,
        fromChain: request.fromChain,
        toChain: request.toChain,
        amount: request.amount,
        beneficiary: request.beneficiary,
        timelock,
        slippage: request.slippage || 1,
        dryRun: false,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        preimage,
        hashlock: hashLock,
        contractIds: {
          source: contractId
        }
      };

      // Create initial event
      const initialEvent: SwapEvent = {
        id: '0x' + randomBytes(16).toString('hex'),
        swapId: contractId,
        type: 'SwapCreated',
        data: {
          fromChain: request.fromChain,
          toChain: request.toChain,
          amount: request.amount,
          beneficiary: request.beneficiary,
          hashLock,
          timelock: new Date(timelock * 1000).toISOString()
        },
        timestamp: Date.now()
      };

      // Save to database
      try {
        await swapDatabase.createSwapWithEvent(swapRecord, initialEvent);
      } catch (dbError) {
        console.error('❌ Database save failed, but continuing:', dbError);
      }

      // Create swap result
      const swapResult: SwapResult = {
        id: contractId,
        status: 'pending',
        userContractId: contractId,
        preimage,
        hashLock,
        events: [initialEvent],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in memory as fallback
      this.activeSwaps.set(contractId, swapResult);

      console.log('✅ Swap created:', {
        id: contractId,
        hashLock,
        timelock: new Date(timelock * 1000).toISOString()
      });

      return swapResult;

    } catch (error) {
      console.error('❌ Error creating swap:', error);
      throw error;
    }
  }

  private createDryRunSwap(request: SwapRequest): SwapResult {
    const id = '0x' + randomBytes(32).toString('hex');
    return {
      id,
      status: 'pending',
      events: [
        {
          type: 'SwapCreated',
          timestamp: new Date().toISOString(),
          data: {
            fromChain: request.fromChain,
            toChain: request.toChain,
            amount: request.amount,
            beneficiary: request.beneficiary,
            dryRun: true
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async fundUserHTLC(swapId: string, userAddress: string, tokenAddress: string, amount: string): Promise<void> {
    try {
      const swap = this.activeSwaps.get(swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      console.log('💰 Funding user HTLC:', {
        contractId: swapId,
        user: userAddress,
        token: tokenAddress,
        amount
      });

      // Get ERC20 contract
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.wallet);
      
      // Check allowance and approve if needed
      const allowance = await tokenContract.allowance(userAddress, await this.htlcContract.getAddress());
      const amountBN = ethers.parseEther(amount);
      
      if (allowance < amountBN) {
        console.log('📝 Approving token transfer...');
        const approveTx = await tokenContract.approve(await this.htlcContract.getAddress(), amountBN);
        await approveTx.wait();
      }

      // Fund the HTLC
      const timelock = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
      const fundTx = await this.htlcContract.fundERC20(
        swapId,
        userAddress,
        swap.hashLock,
        timelock,
        tokenAddress,
        amountBN
      );
      
      await fundTx.wait();

      // Update swap status
      swap.status = 'pending';
      swap.updatedAt = new Date();
      swap.events?.push({
        type: 'HTLCFunded',
        timestamp: new Date().toISOString(),
        txHash: fundTx.hash
      });

      console.log('✅ User HTLC funded successfully');

    } catch (error) {
      console.error('❌ Error funding user HTLC:', error);
      throw error;
    }
  }

  async fulfillSwap(swapId: string): Promise<void> {
    try {
      const swap = this.activeSwaps.get(swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      console.log('🔄 Fulfilling swap:', swapId);

      // For demo, use test token addresses
      const userToken = CONTRACT_ADDRESSES.localhost.SimpleMonsterToken;
      const poolToken = CONTRACT_ADDRESSES.localhost.SimpleMonsterToken; // Same token for demo
      
      const userAmount = ethers.parseEther('100'); // Demo amount
      const poolAmount = ethers.parseEther('100'); // 1:1 for demo
      const timelock = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

      // Call pool manager to fulfill swap
      const fulfillTx = await this.poolManagerContract.fulfillSwap(
        swapId,
        userToken,
        poolToken,
        userAmount,
        poolAmount,
        this.wallet.address,
        timelock,
        swap.hashLock
      );

      const receipt = await fulfillTx.wait();
      
      // Extract pool contract ID from events
      const swapFulfilledEvent = receipt?.logs?.find((log: any) => {
        try {
          const parsed = this.poolManagerContract.interface.parseLog(log);
          return parsed?.name === 'SwapFulfilled';
        } catch {
          return false;
        }
      });

      let poolContractId = '';
      if (swapFulfilledEvent) {
        const parsed = this.poolManagerContract.interface.parseLog(swapFulfilledEvent);
        poolContractId = parsed?.args?.poolContractId || '';
      }

      // Update swap status
      swap.status = 'pool_fulfilled';
      swap.poolContractId = poolContractId;
      swap.updatedAt = new Date();
      swap.events?.push({
        type: 'SwapFulfilled',
        timestamp: new Date().toISOString(),
        txHash: fulfillTx.hash,
        poolContractId
      });

      console.log('✅ Swap fulfilled successfully');

    } catch (error) {
      console.error('❌ Error fulfilling swap:', error);
      throw error;
    }
  }

  async claimUserTokens(swapId: string): Promise<void> {
    try {
      const swap = this.activeSwaps.get(swapId);
      if (!swap || !swap.preimage) {
        throw new Error('Swap not found or preimage missing');
      }

      console.log('🎯 Claiming user tokens for swap:', swapId);

      // Pool manager claims user tokens
      const claimTx = await this.poolManagerContract.claimUserTokens(swapId, swap.preimage);
      await claimTx.wait();

      // Update swap status
      swap.status = 'user_claimed';
      swap.updatedAt = new Date();
      swap.events?.push({
        type: 'UserTokensClaimed',
        timestamp: new Date().toISOString(),
        txHash: claimTx.hash
      });

      console.log('✅ User tokens claimed successfully');

    } catch (error) {
      console.error('❌ Error claiming user tokens:', error);
      throw error;
    }
  }

  async getSwapStatus(id: string): Promise<any> {
    const swap = this.activeSwaps.get(id);
    if (!swap) {
      return {
        status: 'not_found',
        events: []
      };
    }

    return {
      status: swap.status,
      events: swap.events || [],
      userContractId: swap.userContractId,
      poolContractId: swap.poolContractId,
      createdAt: swap.createdAt,
      updatedAt: swap.updatedAt
    };
  }

  async getSwaps(): Promise<SwapResult[]> {
    try {
      // Try to get from database first
      const dbSwaps = await swapDatabase.getSwaps();
      return dbSwaps.map(swap => ({
        id: swap.id,
        status: swap.status as 'pending' | 'pool_fulfilled' | 'user_claimed' | 'expired' | 'cancelled',
        userContractId: swap.contractIds?.source,
        poolContractId: swap.contractIds?.destination,
        preimage: swap.preimage,
        hashLock: swap.hashlock,
        events: [], // Events would be loaded separately if needed
        createdAt: new Date(swap.createdAt),
        updatedAt: new Date(swap.updatedAt)
      }));
    } catch (dbError) {
      console.error('❌ Database error, falling back to memory:', dbError);
      // Fallback to memory
      return Array.from(this.activeSwaps.values());
    }
  }

  async getPoolLiquidity(tokenAddress: string): Promise<any> {
    try {
      const poolInfo = await this.poolManagerContract.getTokenPool(tokenAddress);
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      return {
        token: tokenAddress,
        symbol,
        decimals,
        totalBalance: poolInfo.totalBalance.toString(),
        availableBalance: poolInfo.availableBalance.toString(),
        reservedBalance: poolInfo.reservedBalance.toString(),
        minThreshold: poolInfo.minThreshold.toString(),
        isActive: poolInfo.isActive
      };
    } catch (error) {
      console.error('❌ Error getting pool liquidity:', error);
      throw error;
    }
  }

  async getSupportedTokens(): Promise<string[]> {
    try {
      return await this.poolManagerContract.getSupportedTokens();
    } catch (error) {
      console.error('❌ Error getting supported tokens:', error);
      throw error;
    }
  }

  // Utility method to process a full swap flow for testing
  async processFullSwap(request: SwapRequest): Promise<SwapResult> {
    try {
      console.log('🚀 Processing full swap flow...');
      
      // Step 1: Create swap
      const swap = await this.createSwap(request);
      console.log('✅ Step 1: Swap created');

      // Step 2: Fund user HTLC (simulated)
      await this.fundUserHTLC(
        swap.id, 
        request.beneficiary, 
        CONTRACT_ADDRESSES.localhost.SimpleMonsterToken, 
        request.amount
      );
      console.log('✅ Step 2: User HTLC funded');

      // Step 3: Pool fulfills swap
      await this.fulfillSwap(swap.id);
      console.log('✅ Step 3: Swap fulfilled by pool');

      // Step 4: Pool claims user tokens
      await this.claimUserTokens(swap.id);
      console.log('✅ Step 4: User tokens claimed by pool');

      console.log('🎉 Full swap flow completed successfully!');
      return this.activeSwaps.get(swap.id) || swap;

    } catch (error) {
      console.error('❌ Error in full swap flow:', error);
      throw error;
    }
  }
}

export const realAtomicOrchestratorService = new RealAtomicOrchestrator();

export default RealAtomicOrchestrator;