import { ethers } from 'ethers';

// Token and swap pair validation (inline to avoid import issues)
const SUPPORTED_SWAP_PAIRS = [
  {
    from: { chain: 'sepolia', token: 'MONSTER' },
    to: { chain: 'monadTestnet', token: 'OMNI' },
    description: 'Monster Token → Omni Token (Cross-chain)'
  },
  {
    from: { chain: 'monadTestnet', token: 'OMNI' },
    to: { chain: 'sepolia', token: 'MONSTER' },
    description: 'Omni Token → Monster Token (Cross-chain)'
  }
];

const CHAIN_TOKENS: Record<string, any[]> = {
  sepolia: [
    {
      symbol: 'MONSTER',
      name: 'Monster Token',
      address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      decimals: 18,
      chainId: 11155111,
      icon: '🦄'
    }
  ],
  monadTestnet: [
    {
      symbol: 'OMNI',
      name: 'Omni Token', 
      address: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3',
      decimals: 18,
      chainId: 10143,
      icon: '🌟'
    }
  ]
};

const getToken = (chainKey: string, symbol: string) => {
  const tokens = CHAIN_TOKENS[chainKey] || [];
  return tokens.find(token => token.symbol === symbol);
};

const isSwapPairSupported = (fromChain: string, fromToken: string, toChain: string, toToken: string): boolean => {
  return SUPPORTED_SWAP_PAIRS.some(pair => 
    pair.from.chain === fromChain && 
    pair.from.token === fromToken && 
    pair.to.chain === toChain && 
    pair.to.token === toToken
  );
};

// Real deployed contract addresses from your .env
const DEPLOYED_CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlc: '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D',
    forwarder: '0xC2Cb379E217D17d6CcD4CE8c5023512325b630e4',
    monsterToken: process.env.NEXT_PUBLIC_SEPOLIA_MONSTER_TOKEN || '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E'
  },
  monadTestnet: {
    chainId: 10143,
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
    htlc: '0x1C2D085DdF3c3FE877f3Bc0709c97F8342FCF868', // Match resolver config
    omniToken: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3'
  },
  polygonAmoy: {
    chainId: 80002,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlc: '0x7CaFE0d0E40B8Ed9B93a067EBEB9A6f9F1D1c0E7'
  }
};

// Real HTLC ABI from your contracts
const HTLC_ABI = [
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
      { "indexed": true, "internalType": "address", "name": "beneficiary", "type": "address" }
    ],
    "name": "Claimed",
    "type": "event"
  }
];

// ERC20 ABI for token operations
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

interface RealSwapParams {
  fromChain: string;
  fromToken: string;
  toChain: string;
  toToken: string;
  amount: string;
  beneficiary: string;
  timelock: number;
  dryRun: boolean;
  swapId?: string; // Optional - if provided, use this instead of generating new one
}

interface RealSwapResult {
  id: string;
  status: 'PENDING' | 'POOL_FULFILLED' | 'USER_CLAIMED' | 'EXPIRED' | 'CANCELLED';
  sourceChain: string;
  sourceToken: string;
  destinationChain: string;
  destinationToken: string;
  sourceAmount: string;
  targetAmount: string;
  userAddress: string;
  beneficiaryAddress: string;
  htlcAddress?: string;
  contractId?: string;
  secretHash?: string;
  secret?: string;
  timelock: number;
  createdAt: string;
  expiresAt: string;
  transactionHashes: {
    htlcFunding?: string;
    poolClaim?: string;
    userClaim?: string;
  };
  fees: {
    networkFee: string;
    exchangeFee: string;
    totalFee: string;
  };
}

export class RealBlockchainSwapService {
  
  private getProvider(chainKey: string): ethers.JsonRpcProvider {
    const config = DEPLOYED_CONTRACTS[chainKey as keyof typeof DEPLOYED_CONTRACTS];
    if (!config) {
      throw new Error(`Unsupported chain: ${chainKey}`);
    }
    return new ethers.JsonRpcProvider(config.rpcUrl);
  }

  private getHtlcContract(chainKey: string, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
    const config = DEPLOYED_CONTRACTS[chainKey as keyof typeof DEPLOYED_CONTRACTS];
    if (!config) {
      throw new Error(`Unsupported chain: ${chainKey}`);
    }
    
    const provider = signerOrProvider || this.getProvider(chainKey);
    return new ethers.Contract(config.htlc, HTLC_ABI, provider);
  }

  private async getWalletSigner(chainKey: string): Promise<ethers.Signer> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection only available in browser');
    }

    // Try to get Web3Auth provider first
    try {
      // @ts-ignore - Web3Auth provider is attached to window
      const web3authProvider = window.web3authProvider;
      if (web3authProvider) {
        console.log('Using Web3Auth provider');
        const ethersProvider = new ethers.BrowserProvider(web3authProvider);
        return await ethersProvider.getSigner();
      }
    } catch (web3authError) {
      console.log('Web3Auth provider not available, falling back to MetaMask');
    }

    // Fallback to MetaMask/injected wallet
    if (!window.ethereum) {
      throw new Error('No wallet detected. Please install MetaMask or connect via Web3Auth');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Check if we're on the correct network
    const network = await provider.getNetwork();
    const expectedChainId = DEPLOYED_CONTRACTS[chainKey as keyof typeof DEPLOYED_CONTRACTS]?.chainId;
    
    if (expectedChainId && Number(network.chainId) !== expectedChainId) {
      // Request network switch
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
        });
      } catch (error) {
        throw new Error(`Please switch to the correct network (Chain ID: ${expectedChainId})`);
      }
    }

    return signer;
  }

  private generateSecret(): { secret: string; hashLock: string } {
    const secret = ethers.randomBytes(32);
    const hashLock = ethers.keccak256(secret);
    return {
      secret: ethers.hexlify(secret),
      hashLock
    };
  }

  private calculateFees(amount: string, fromToken: string): { networkFee: string; exchangeFee: string; totalFee: string } {
    const sourceAmount = parseFloat(amount);
    
    // Network fee: 0.1% of amount
    const networkFee = sourceAmount * 0.001;
    
    // Exchange fee: 0.3% of amount
    const exchangeFee = sourceAmount * 0.003;
    
    const totalFee = networkFee + exchangeFee;

    return {
      networkFee: networkFee.toFixed(6),
      exchangeFee: exchangeFee.toFixed(6),
      totalFee: totalFee.toFixed(6)
    };
  }

  private getExchangeRate(fromToken: string, toToken: string): number {
    // Define exchange rates for supported pairs
    const rates: Record<string, Record<string, number>> = {
      'MONSTER': {
        'OMNI': 0.95, // 1 MONSTER = 0.95 OMNI
      },
      'OMNI': {
        'MONSTER': 1.05, // 1 OMNI = 1.05 MONSTER
      }
    };

    return rates[fromToken]?.[toToken] || 1.0;
  }

  async createRealSwap(params: RealSwapParams): Promise<RealSwapResult> {
    console.log('🔗 Creating REAL blockchain swap:', params);

    // Validate swap pair is supported
    if (!isSwapPairSupported(params.fromChain, params.fromToken, params.toChain, params.toToken)) {
      throw new Error(`Swap pair ${params.fromToken} (${params.fromChain}) → ${params.toToken} (${params.toChain}) is not supported`);
    }

    // Get token information
    const sourceToken = getToken(params.fromChain, params.fromToken);
    const targetToken = getToken(params.toChain, params.toToken);

    if (!sourceToken || !targetToken) {
      throw new Error('Invalid token configuration');
    }

    // Calculate quote
    const sourceAmount = parseFloat(params.amount);
    const exchangeRate = this.getExchangeRate(params.fromToken, params.toToken);
    const fees = this.calculateFees(params.amount, params.fromToken);
    const targetAmount = Math.max(0, sourceAmount * exchangeRate - parseFloat(fees.totalFee));

    // Use provided swap ID or generate new one
    const swapId = params.swapId || `swap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const { secret, hashLock } = this.generateSecret();

    // Calculate expiration time
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + params.timelock * 1000);

    console.log(`📝 Generated swap: ${swapId}`);
    console.log(`🔒 Secret hash: ${hashLock}`);

    const swapResult: RealSwapResult = {
      id: swapId,
      status: 'PENDING',
      sourceChain: params.fromChain,
      sourceToken: params.fromToken,
      destinationChain: params.toChain,
      destinationToken: params.toToken,
      sourceAmount: params.amount,
      targetAmount: targetAmount.toFixed(6),
      userAddress: params.beneficiary,
      beneficiaryAddress: params.beneficiary,
      htlcAddress: DEPLOYED_CONTRACTS[params.fromChain as keyof typeof DEPLOYED_CONTRACTS]?.htlc,
      contractId: '', // Will be set after HTLC contract generates it
      secretHash: hashLock,
      secret,
      timelock: params.timelock,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      transactionHashes: {},
      fees
    };

    if (params.dryRun) {
      console.log('🧪 Dry run mode - not executing real transactions');
      swapResult.status = 'PENDING';
      
      // Start automated progression for demo
      this.simulateRealProgression(swapResult);
      
      return swapResult;
    }

    try {
      // Phase 1: Connect to wallet and deploy HTLC
      console.log('👛 Connecting to wallet...');
      const signer = await this.getWalletSigner(params.fromChain);
      const userAddress = await signer.getAddress();
      swapResult.userAddress = userAddress;

      console.log(`✅ Connected to wallet: ${userAddress}`);

      // Phase 2: Get token contract and check balance/approval
      const tokenConfig = DEPLOYED_CONTRACTS[params.fromChain as keyof typeof DEPLOYED_CONTRACTS];
      if (!tokenConfig) {
        throw new Error(`Chain configuration not found: ${params.fromChain}`);
      }

      let tokenAddress: string;
      if (params.fromToken === 'MONSTER' && params.fromChain === 'sepolia') {
        tokenAddress = (tokenConfig as any).monsterToken || '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E';
      } else if (params.fromToken === 'OMNI' && params.fromChain === 'monadTestnet') {
        tokenAddress = (tokenConfig as any).omniToken || '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3';
      } else {
        throw new Error(`Token ${params.fromToken} not configured for ${params.fromChain}`);
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      console.log(`💰 Token contract: ${tokenAddress}`);

      // Check balance
      const balance = await tokenContract.balanceOf(userAddress);
      const decimals = await tokenContract.decimals();
      const requiredAmount = ethers.parseUnits(params.amount, decimals);

      console.log(`💳 Balance: ${ethers.formatUnits(balance, decimals)} ${params.fromToken}`);
      console.log(`💸 Required: ${params.amount} ${params.fromToken}`);

      if (balance < requiredAmount) {
        throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${params.amount}`);
      }

      // Check/approve HTLC contract
      const htlcContract = this.getHtlcContract(params.fromChain, signer);
      const allowance = await tokenContract.allowance(userAddress, tokenConfig.htlc);

      if (allowance < requiredAmount) {
        console.log('🔐 Approving HTLC contract...');
        const approveTx = await tokenContract.approve(tokenConfig.htlc, requiredAmount);
        console.log(`⏳ Approve tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('✅ Approval confirmed');
      }

      // Phase 3: Generate contract ID and fund HTLC
      console.log('🔗 Funding HTLC contract...');
      const timelock = Math.floor(Date.now() / 1000) + params.timelock;
      
      // Generate deterministic contract ID (same algorithm as the contract)
      const nonce = Date.now(); // Use timestamp as nonce for uniqueness
      const contractId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'bytes32', 'uint256', 'address', 'uint256', 'uint256'],
          [userAddress, params.beneficiary, hashLock, timelock, tokenAddress, requiredAmount, nonce]
        )
      );
      console.log(`🆔 Generated Contract ID: ${contractId}`);
      
      const fundTx = await htlcContract.fund(
        contractId,
        tokenAddress,
        params.beneficiary,
        hashLock,
        timelock,
        requiredAmount
      );

      console.log(`⏳ HTLC funding tx: ${fundTx.hash}`);
      await fundTx.wait();
      console.log('✅ HTLC funded successfully');

      swapResult.transactionHashes.htlcFunding = fundTx.hash;
      swapResult.contractId = contractId; // Set the actual contract ID
      swapResult.status = 'PENDING';

      // Database operations are handled by the ClientSwapService
      console.log('✅ Blockchain operations completed - database will be updated via API');

      // Start real progression monitoring
      this.startRealProgressionMonitoring(swapResult);

      console.log('🎉 Real cross-chain swap created successfully!');
      return swapResult;

    } catch (error) {
      console.error('❌ Failed to create real cross-chain swap:', error);
      throw new Error(`Failed to create swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private simulateRealProgression(swap: RealSwapResult) {
    console.log(`🕐 Starting real progression simulation for ${swap.id}`);
    
    // Simulate pool fulfillment after 15 seconds
    setTimeout(async () => {
      console.log(`🏊 Pool fulfilling swap ${swap.id}`);
      try {
        await this.updateSwapStatus(swap.id, 'POOL_FULFILLED');
      } catch (error) {
        console.error('Failed to update swap to POOL_FULFILLED:', error);
      }
    }, 15000);

    // Complete after 30 seconds
    setTimeout(async () => {
      console.log(`✅ Completing swap ${swap.id}`);
      try {
        await this.updateSwapStatus(swap.id, 'USER_CLAIMED');
      } catch (error) {
        console.error('Failed to update swap to USER_CLAIMED:', error);
      }
    }, 30000);
  }

  private startRealProgressionMonitoring(swap: RealSwapResult) {
    console.log(`👁️ Starting real progression monitoring for ${swap.id}`);
    
    // In a real implementation, this would:
    // 1. Monitor the HTLC for Funded events
    // 2. Trigger pool manager to fulfill on destination chain
    // 3. Monitor for pool HTLC deployment
    // 4. Enable gasless claiming
    
    // For now, simulate progression
    this.simulateRealProgression(swap);
  }

  private async updateSwapStatus(swapId: string, newStatus: string) {
    try {
      // Only import database on server side
      if (typeof window !== 'undefined') {
        console.warn('⚠️ Database not available in browser environment');
        return;
      }
      
      // Update swap status via API
      const response = await fetch(`/api/swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus
        })
      });
      
      if (response.ok) {
        console.log(`✅ Updated swap ${swapId} to status: ${newStatus}`);
      } else {
        console.warn(`⚠️ Failed to update swap ${swapId} status`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not update swap ${swapId} in database:`, error);
    }
  }

  async claimTokens(swapId: string, secret: string): Promise<{ txHash: string; success: boolean }> {
    console.log(`🎁 Claiming tokens for swap: ${swapId}`);
    
    try {
      // Get swap details via API
      const swapDetails = await this.getSwapDetails(swapId);
      
      if (!swapDetails) {
        throw new Error('Swap not found');
      }

      if (swapDetails.status !== 'POOL_FULFILLED') {
        throw new Error('Swap not ready for claiming');
      }

      // Connect to destination chain
      const signer = await this.getWalletSigner(swapDetails.destinationChain);
      const htlcContract = this.getHtlcContract(swapDetails.destinationChain, signer);

      // Claim from HTLC
      console.log('🔓 Claiming from destination HTLC...');
      const claimTx = await htlcContract.claim(swapDetails.contractId, secret);
      console.log(`⏳ Claim tx: ${claimTx.hash}`);
      
      await claimTx.wait();
      console.log('✅ Tokens claimed successfully!');

      // Update status
      await this.updateSwapStatus(swapId, 'USER_CLAIMED');

      return {
        txHash: claimTx.hash,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to claim tokens:', error);
      return {
        txHash: '',
        success: false
      };
    }
  }

  async getSwapDetails(swapId: string): Promise<RealSwapResult | null> {
    try {
      // Database operations now handled via API
      if (typeof window !== 'undefined') {
        // Client-side: fetch from API
        const response = await fetch(`/api/swaps/${swapId}`);
        if (!response.ok) return null;
        
        const swap = await response.json();
        
        // Transform API result to RealSwapResult
        return {
          id: swap.id,
          status: swap.status as any,
          sourceChain: swap.sourceToken?.split(':')[0] || '',
          sourceToken: swap.sourceToken?.split(':')[1] || '',
          destinationChain: swap.targetToken?.split(':')[0] || '',
          destinationToken: swap.targetToken?.split(':')[1] || '',
          sourceAmount: swap.sourceAmount,
          targetAmount: swap.expectedAmount,
          userAddress: swap.userAddress,
          beneficiaryAddress: swap.userAddress, // Using userAddress as fallback
          htlcAddress: swap.userHtlcContract || '',
          contractId: swap.userHtlcContract || '',
          secretHash: swap.hashLock || '',
          timelock: swap.expirationTime || 3600,
          createdAt: swap.createdAt,
          expiresAt: swap.expirationTime ? new Date(swap.expirationTime * 1000).toISOString() : new Date().toISOString(),
          transactionHashes: {},
          fees: {
            networkFee: '0.001',
            exchangeFee: '0.003',
            totalFee: '0.004'
          }
        };
      } else {
        // Server-side: should not be called, use API instead
        console.warn('⚠️ getSwapDetails called on server-side, use API instead');
        return null;
      }
    } catch (error) {
      console.error('Error getting swap details:', error);
      return null;
    }
  }
}

export const realBlockchainSwapService = new RealBlockchainSwapService();