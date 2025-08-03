import { ethers } from 'ethers';
import crypto from 'crypto';

// Chain configurations
const CHAIN_CONFIG = {
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
    htlcAddress: '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7',
    tokens: {
      MONSTER: '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E'
    },
    blockExplorer: 'https://sepolia.etherscan.io'
  },
  monadTestnet: {
    chainId: 10143,
    name: 'Monad Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
    htlcAddress: '0xAAaa9c73a0d91472B8a0eb4DEa373E08d3Cb60B9',
    tokens: {
      OMNIMONSTER: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
      MONSTER: '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B'
    },
    blockExplorer: 'https://testnet.monadexplorer.com'
  }
};

// Contract ABIs
const HTLC_ABI = [
  'function fund(bytes32 contractId, address token, address payable beneficiary, bytes32 hashLock, uint256 timelock, uint256 value) payable',
  'function claim(bytes32 contractId, bytes32 preimage)',
  'function refund(bytes32 contractId)',
  'function getContract(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)',
  'event HTLCClaimed(bytes32 indexed contractId, address indexed claimer, bytes32 preimage)',
  'event HTLCRefunded(bytes32 indexed contractId, address indexed refunder)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

export interface BlockchainSwapParams {
  fromChain: string;
  fromToken: string;
  toChain: string;
  toToken: string;
  amount: string;
  beneficiary: string;
  timelock: number;
  swapId: string;
  hashLock: string;
}

export interface BlockchainSwapResult {
  success: boolean;
  contractId?: string;
  transactionHash?: string;
  error?: string;
  userAddress?: string;
}

export class ProductionBlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  /**
   * Connect to user's wallet (Web3Auth or MetaMask)
   */
  async connectWallet(chainKey: string): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection only available in browser');
    }

    const chainConfig = CHAIN_CONFIG[chainKey as keyof typeof CHAIN_CONFIG];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainKey}`);
    }

    try {
      // Try Web3Auth first
      if ((window as any).web3authProvider) {
        console.log('🔐 Connecting via Web3Auth...');
        this.provider = new ethers.BrowserProvider((window as any).web3authProvider);
      } 
      // Fall back to MetaMask
      else if ((window as any).ethereum) {
        console.log('🦊 Connecting via MetaMask...');
        this.provider = new ethers.BrowserProvider((window as any).ethereum);
        await this.provider.send('eth_requestAccounts', []);
      } else {
        throw new Error('No wallet provider found. Please install MetaMask or use Web3Auth.');
      }

      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      console.log(`✅ Connected to wallet: ${address}`);

      // Verify correct network
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== chainConfig.chainId) {
        throw new Error(
          `Please switch to ${chainConfig.name} (Chain ID: ${chainConfig.chainId}). ` +
          `Currently on Chain ID: ${network.chainId}`
        );
      }

      return address;
    } catch (error: any) {
      console.error('❌ Wallet connection failed:', error);
      throw error;
    }
  }

  /**
   * Create HTLC on blockchain
   */
  async createHTLC(params: BlockchainSwapParams): Promise<BlockchainSwapResult> {
    try {
      console.log('🔗 Creating HTLC on blockchain...');
      
      if (!this.signer || !this.provider) {
        throw new Error('Wallet not connected. Please connect wallet first.');
      }

      const chainConfig = CHAIN_CONFIG[params.fromChain as keyof typeof CHAIN_CONFIG];
      if (!chainConfig) {
        throw new Error(`Unsupported chain: ${params.fromChain}`);
      }

      const tokenAddress = chainConfig.tokens[params.fromToken as keyof typeof chainConfig.tokens];
      if (!tokenAddress) {
        throw new Error(`Token ${params.fromToken} not supported on ${params.fromChain}`);
      }

      const userAddress = await this.signer.getAddress();

      // Step 1: Check token balance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const balance = await tokenContract.balanceOf(userAddress);
      const decimals = await tokenContract.decimals();
      const amount = ethers.parseUnits(params.amount, decimals);

      console.log(`💰 Balance: ${ethers.formatUnits(balance, decimals)} ${params.fromToken}`);
      
      if (balance < amount) {
        throw new Error(`Insufficient balance. You have ${ethers.formatUnits(balance, decimals)} ${params.fromToken}`);
      }

      // Step 2: Check and set approval
      const htlcAddress = chainConfig.htlcAddress;
      const currentAllowance = await tokenContract.allowance(userAddress, htlcAddress);
      
      if (currentAllowance < amount) {
        console.log('🔓 Approving token spending...');
        const approveTx = await tokenContract.approve(htlcAddress, amount);
        console.log(`⏳ Approval tx: ${approveTx.hash}`);
        
        const approveReceipt = await approveTx.wait();
        if (!approveReceipt || approveReceipt.status !== 1) {
          throw new Error('Token approval failed');
        }
        console.log('✅ Token approval successful');
      }

      // Step 3: Create HTLC
      const htlcContract = new ethers.Contract(htlcAddress, HTLC_ABI, this.signer);
      
      // Generate contract ID
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`${params.swapId}-user`));
      
      // Calculate timelock
      const currentTime = Math.floor(Date.now() / 1000);
      const timelock = currentTime + params.timelock;

      console.log('📝 HTLC Parameters:');
      console.log(`   Contract ID: ${contractId}`);
      console.log(`   Beneficiary: ${params.beneficiary}`);
      console.log(`   Hash Lock: ${params.hashLock}`);
      console.log(`   Amount: ${ethers.formatUnits(amount, decimals)} ${params.fromToken}`);
      console.log(`   Expires: ${new Date(timelock * 1000).toISOString()}`);

      // Estimate gas with buffer
      let gasEstimate;
      try {
        gasEstimate = await htlcContract.fund.estimateGas(
          contractId,
          tokenAddress,
          params.beneficiary,
          params.hashLock,
          timelock,
          amount,
          { value: 0 }
        );
        // Add 20% buffer
        gasEstimate = (gasEstimate * 120n) / 100n;
      } catch (estimateError: any) {
        console.warn('⚠️ Gas estimation failed, using default:', estimateError.message);
        gasEstimate = 300000n;
      }

      console.log('⛽ Creating HTLC transaction...');
      const fundTx = await htlcContract.fund(
        contractId,
        tokenAddress,
        params.beneficiary,
        params.hashLock,
        timelock,
        amount,
        { 
          value: 0,
          gasLimit: gasEstimate
        }
      );

      console.log(`⏳ Transaction submitted: ${fundTx.hash}`);
      console.log(`🔍 View on explorer: ${chainConfig.blockExplorer}/tx/${fundTx.hash}`);

      // Wait for confirmation
      const receipt = await fundTx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error('HTLC creation transaction failed');
      }

      console.log('✅ HTLC created successfully!');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      return {
        success: true,
        contractId,
        transactionHash: fundTx.hash,
        userAddress
      };

    } catch (error: any) {
      console.error('❌ HTLC creation failed:', error);
      
      // Parse error for user-friendly message
      let errorMessage = error.message;
      if (error.code === 'CALL_EXCEPTION') {
        errorMessage = 'Transaction failed. Please check your balance and approval.';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas fees.';
      } else if (error.code === 4001) {
        errorMessage = 'Transaction rejected by user.';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Claim tokens from HTLC
   */
  async claimHTLC(
    chainKey: string,
    contractId: string,
    preimage: string
  ): Promise<BlockchainSwapResult> {
    try {
      console.log('🎯 Claiming tokens from HTLC...');

      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const chainConfig = CHAIN_CONFIG[chainKey as keyof typeof CHAIN_CONFIG];
      if (!chainConfig) {
        throw new Error(`Unsupported chain: ${chainKey}`);
      }

      const htlcContract = new ethers.Contract(chainConfig.htlcAddress, HTLC_ABI, this.signer);
      
      // Verify HTLC exists and is claimable
      const htlcDetails = await htlcContract.getContract(contractId);
      if (htlcDetails.state !== 1) { // 1 = Active
        throw new Error('HTLC is not in claimable state');
      }

      console.log('🔓 Submitting claim transaction...');
      const claimTx = await htlcContract.claim(contractId, preimage);
      console.log(`⏳ Claim tx: ${claimTx.hash}`);

      const receipt = await claimTx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error('Claim transaction failed');
      }

      console.log('✅ Tokens claimed successfully!');
      return {
        success: true,
        transactionHash: claimTx.hash
      };

    } catch (error: any) {
      console.error('❌ Claim failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get HTLC details
   */
  async getHTLCDetails(chainKey: string, contractId: string) {
    const chainConfig = CHAIN_CONFIG[chainKey as keyof typeof CHAIN_CONFIG];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainKey}`);
    }

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const htlcContract = new ethers.Contract(chainConfig.htlcAddress, HTLC_ABI, provider);
    
    const details = await htlcContract.getContract(contractId);
    return {
      token: details.token,
      beneficiary: details.beneficiary,
      originator: details.originator,
      hashLock: details.hashLock,
      timelock: Number(details.timelock),
      value: details.value.toString(),
      state: Number(details.state)
    };
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.provider = null;
    this.signer = null;
  }
}

// Export singleton instance
export const blockchainService = new ProductionBlockchainService();