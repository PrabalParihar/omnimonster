import { ethers } from 'ethers';

// Token and swap pair validation (inline to avoid import issues)
const SUPPORTED_SWAP_PAIRS = [
  {
    from: { chain: 'sepolia', token: 'MONSTER' },
    to: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    description: 'Monster Token → OmniMonster Token (Cross-chain)'
  },
  {
    from: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    to: { chain: 'sepolia', token: 'MONSTER' },
    description: 'OmniMonster Token → Monster Token (Cross-chain)'
  }
];

const CHAIN_TOKENS: Record<string, any[]> = {
  sepolia: [
    {
      symbol: 'MONSTER',
      name: 'Monster Token',
      address: '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E',
      decimals: 18,
      chainId: 11155111,
      icon: '🦄'
    }
  ],
  monadTestnet: [
    {
      symbol: 'OMNIMONSTER',
      name: 'Omni Monster Token', 
      address: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
      decimals: 18,
      chainId: 10143,
      icon: '🌟'
    },
    {
      symbol: 'MONSTER',
      name: 'Monster Token', 
      address: '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B',
      decimals: 18,
      chainId: 10143,
      icon: '🦄'
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

// Pool/Resolver wallet address - this is who can claim user HTLCs in atomic swaps
const POOL_RESOLVER_ADDRESS = '0x2BCc053BB6915F28aC2041855D2292dDca406903';

// Real deployed contract addresses from your .env
const DEPLOYED_CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlc: process.env.NEXT_PUBLIC_SEPOLIA_HTLC || '0xb65Dd3b3E7549a9e0c8F0400c28984AEe470EAE8', // New SimpleHTLC
    forwarder: '0xC2Cb379E217D17d6CcD4CE8c5023512325b630e4',
    monsterToken: process.env.NEXT_PUBLIC_SEPOLIA_MONSTER_TOKEN || '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E'
  },
  monadTestnet: {
    chainId: 10143,
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
    htlc: process.env.NEXT_PUBLIC_MONAD_HTLC || '0x7185D90BCD120dE7d091DF6EA8bd26e912571b61', // New SimpleHTLC
    omnimonsterToken: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
    monsterToken: '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B'
  },
  polygonAmoy: {
    chainId: 80002,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlc: '0x7CaFE0d0E40B8Ed9B93a067EBEB9A6f9F1D1c0E7'
  },
  monadTestnet: {
    chainId: 10143,
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
    htlc: '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9',
    monsterToken: process.env.NEXT_PUBLIC_MONAD_MONSTER_TOKEN || '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B',
    omnimonsterToken: process.env.NEXT_PUBLIC_MONAD_OMNIMONSTER_TOKEN || '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24'
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
        const signer = await ethersProvider.getSigner();
        
        // Check network for Web3Auth too
        const network = await ethersProvider.getNetwork();
        const expectedChainId = DEPLOYED_CONTRACTS[chainKey as keyof typeof DEPLOYED_CONTRACTS]?.chainId;
        
        if (expectedChainId && Number(network.chainId) !== expectedChainId) {
          const networkName = chainKey === 'sepolia' ? 'Ethereum Sepolia' : 
                             chainKey === 'monadTestnet' ? 'Monad Testnet' : 
                             chainKey === 'polygonAmoy' ? 'Polygon Amoy' : chainKey;
          throw new Error(`Please switch your Web3Auth wallet to ${networkName} network (Chain ID: ${expectedChainId}). Current network: Chain ID ${network.chainId}`);
        }
        
        return signer;
      }
    } catch (web3authError: any) {
      if (web3authError.message && web3authError.message.includes('switch your Web3Auth wallet')) {
        throw web3authError; // Re-throw network switch errors
      }
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
      console.log(`🔄 Network mismatch. Current: ${network.chainId}, Expected: ${expectedChainId}`);
      
      // Only try to switch networks if using MetaMask (not Web3Auth)
      // @ts-ignore
      if (window.ethereum && !window.web3authProvider) {
        try {
          console.log('🔄 Requesting network switch...');
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
          console.log('✅ Network switched successfully');
        } catch (switchError: any) {
          console.error('❌ Network switch failed:', switchError);
          if (switchError.code === 4902) {
            throw new Error(`Please add the ${chainKey} network to your wallet`);
          }
          throw new Error(`Please manually switch to ${chainKey} network (Chain ID: ${expectedChainId})`);
        }
      } else {
        // For Web3Auth, we need to inform the user to switch manually
        const networkName = chainKey === 'sepolia' ? 'Ethereum Sepolia' : 
                           chainKey === 'monadTestnet' ? 'Monad Testnet' : 
                           chainKey === 'polygonAmoy' ? 'Polygon Amoy' : chainKey;
        throw new Error(`Please switch your wallet to ${networkName} network (Chain ID: ${expectedChainId}). Current network: Chain ID ${network.chainId}`);
      }
    }

    return signer;
  }

  private generateSecret(): { secret: string; hashLock: string } {
    const secret = ethers.randomBytes(32);
    // Use SHA256 to match SimpleHTLC contract's sha256(abi.encodePacked(preimage)) verification
    const crypto = require('crypto');
    const hashLock = '0x' + crypto.createHash('sha256').update(secret).digest('hex');
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
        'OMNIMONSTER': 0.99, // 1 MONSTER = 0.99 OMNIMONSTER
      },
      'OMNIMONSTER': {
        'MONSTER': 1.01, // 1 OMNIMONSTER = 1.01 MONSTER
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
      } else if (params.fromToken === 'OMNIMONSTER' && params.fromChain === 'monadTestnet') {
        tokenAddress = (tokenConfig as any).omnimonsterToken || '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24';
      } else if (params.fromToken === 'MONSTER' && params.fromChain === 'monadTestnet') {
        tokenAddress = (tokenConfig as any).monsterToken || '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B';
      } else {
        throw new Error(`Token ${params.fromToken} not configured for ${params.fromChain}`);
      }

      console.log(`💰 Token contract: ${tokenAddress}`);
      
      // Check network connection
      const signerProvider = signer.provider;
      if (signerProvider) {
        try {
          const network = await signerProvider.getNetwork();
          console.log(`🌐 Connected to network: Chain ID ${network.chainId}, Name: ${network.name || 'Unknown'}`);
          console.log(`🎯 Expected chain ID: ${tokenConfig.chainId}`);
          
          if (Number(network.chainId) !== tokenConfig.chainId) {
            throw new Error(`Wrong network! Connected to chain ${network.chainId}, but expected ${tokenConfig.chainId}`);
          }
          
          const code = await signerProvider.getCode(tokenAddress);
          console.log(`📄 Contract code exists: ${code !== '0x' && code !== '0x0'}, length: ${code.length}`);
          
          if (code === '0x' || code === '0x0') {
            throw new Error(`No contract found at ${tokenAddress} on chain ${network.chainId}`);
          }
        } catch (error) {
          console.error('❌ Network/contract verification failed:', error);
          throw error;
        }
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      // Check balance
      let balance, decimals;
      try {
        balance = await tokenContract.balanceOf(userAddress);
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error('❌ Failed to interact with token contract:', error);
        console.log('Token address:', tokenAddress);
        console.log('User address:', userAddress);
        throw new Error(`Token contract interaction failed. Please ensure you're connected to the correct network and the token contract exists at ${tokenAddress}`);
      }
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
        
        // Get gas options for approval transaction
        const provider = signer.provider;
        if (!provider) {
          throw new Error('No provider available from signer');
        }
        const approvalGasOptions: any = { gasLimit: 100000 };
        
        try {
          const approvalFeeData = await provider.getFeeData();
          if (approvalFeeData.maxFeePerGas && approvalFeeData.maxPriorityFeePerGas) {
            approvalGasOptions.maxFeePerGas = approvalFeeData.maxFeePerGas * 15n / 10n; // 50% buffer
            approvalGasOptions.maxPriorityFeePerGas = approvalFeeData.maxPriorityFeePerGas * 15n / 10n; // 50% buffer
          } else if (approvalFeeData.gasPrice) {
            approvalGasOptions.gasPrice = approvalFeeData.gasPrice * 15n / 10n; // 50% buffer
          }
        } catch (feeError) {
          console.log('⚠️ Could not get fee data, using fallback gas price');
          try {
            const gasPrice = await provider.getGasPrice();
            approvalGasOptions.gasPrice = gasPrice * 15n / 10n; // 50% buffer
          } catch (gasPriceError) {
            console.log('⚠️ Could not get gas price, using default');
            // Use a reasonable default gas price
            approvalGasOptions.gasPrice = ethers.parseUnits('30', 'gwei');
          }
        }
        
        // Get current nonce for logging
        const approvalNonce = await provider.getTransactionCount(userAddress, 'pending');
        console.log(`📊 Approval transaction using nonce: ${approvalNonce}`);
        
        const approveTx = await tokenContract.approve(tokenConfig.htlc, requiredAmount, approvalGasOptions);
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
      
      // Get current gas price and add buffer for potential replacement
      const provider = signer.provider;
      if (!provider) {
        throw new Error('No provider available from signer');
      }
      
      const gasOptions: any = {
        gasLimit: 300000, // Set reasonable gas limit
        // Note: nonce will be set dynamically for each transaction attempt
      };
      
      try {
        const feeData = await provider.getFeeData();
        let gasPrice = feeData.gasPrice;
        
        // Add 50% buffer to handle potential transaction replacement
        if (gasPrice) {
          gasPrice = gasPrice * 15n / 10n; // 50% increase
        }
        
        // Use Type 2 transactions (EIP-1559) if supported, otherwise legacy
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          gasOptions.maxFeePerGas = feeData.maxFeePerGas * 15n / 10n; // 50% buffer
          gasOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * 15n / 10n; // 50% buffer
        } else if (gasPrice) {
          gasOptions.gasPrice = gasPrice;
        }
      } catch (feeError) {
        console.log('⚠️ Could not get fee data, using fallback gas price');
        try {
          const gasPrice = await provider.getGasPrice();
          gasOptions.gasPrice = gasPrice * 15n / 10n; // 50% buffer
        } catch (gasPriceError) {
          console.log('⚠️ Could not get gas price, using default');
          // Use a reasonable default gas price
          gasOptions.gasPrice = ethers.parseUnits('30', 'gwei');
        }
      }
      
      console.log('⛽ Gas options:', gasOptions);
      
      let fundTx;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Get fresh nonce for each attempt
          const currentNonce = await provider.getTransactionCount(userAddress, 'pending');
          gasOptions.nonce = currentNonce;
          
          console.log(`📊 Attempt ${retryCount + 1} - Using nonce: ${currentNonce}`);
          
          fundTx = await htlcContract.fund(
            contractId,
            tokenAddress,
            params.beneficiary,
            hashLock,
            timelock,
            requiredAmount,
            gasOptions
          );
          break; // Success, exit retry loop
          
        } catch (error: any) {
          retryCount++;
          console.warn(`⚠️ Transaction attempt ${retryCount} failed:`, error.message);
          console.warn(`   Error code: ${error.code}`);
          console.warn(`   Error reason: ${error.reason || 'N/A'}`);
          
          // Handle different types of transaction errors
          const retryableErrors = ['REPLACEMENT_UNDERPRICED', 'NONCE_EXPIRED', 'INSUFFICIENT_FUNDS'];
          const hasNonceError = error.message.includes('nonce') || error.message.includes('transaction count');
          const hasReplacementError = error.message.includes('replacement') || error.message.includes('underpriced');
          const isRetryable = retryableErrors.includes(error.code) || hasNonceError || hasReplacementError;
          
          if (isRetryable && retryCount < maxRetries) {
            console.log('🔄 Retrying with adjusted parameters...');
            
            // Increase gas price by additional 50% for retry
            if (gasOptions.maxFeePerGas) {
              gasOptions.maxFeePerGas = gasOptions.maxFeePerGas * 15n / 10n;
              gasOptions.maxPriorityFeePerGas = gasOptions.maxPriorityFeePerGas * 15n / 10n;
            } else if (gasOptions.gasPrice) {
              gasOptions.gasPrice = gasOptions.gasPrice * 15n / 10n;
            }
            
            // Nonce will be refreshed automatically on next attempt
            
            console.log('⛽ Retry gas options:', gasOptions);
            
            // Wait longer before retry, especially for nonce errors
            const delayMs = hasNonceError ? 3000 : 5000;
            console.log(`⏳ Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          // If it's the last retry or a non-retryable error, throw it
          if (retryCount >= maxRetries || !isRetryable) {
            console.error(`❌ Final error after ${retryCount} attempts:`, error);
            throw error;
          }
        }
      }
      
      if (!fundTx) {
        throw new Error('Failed to send transaction after all retries');
      }

      console.log(`⏳ HTLC funding tx: ${fundTx.hash}`);
      console.log('⏳ Waiting for 2 confirmations...');
      const receipt = await fundTx.wait(2); // Wait for 2 confirmations
      console.log(`✅ HTLC funded successfully with ${receipt?.confirmations || 'N/A'} confirmations`);

      swapResult.transactionHashes.htlcFunding = fundTx.hash;
      swapResult.contractId = contractId; // Set the actual contract ID
      swapResult.status = 'PENDING';

      // Add a small delay to ensure RPC nodes are synced
      console.log('⏳ Waiting for RPC propagation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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