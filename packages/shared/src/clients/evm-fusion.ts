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

const logger = createLogger('EvmFusionHTLCClient');

// FusionHTLC ABI - supports both contracts() and getDetails()
const FUSION_HTLC_ABI = [
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
  // contracts() function for SimpleHTLC
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
  // getDetails() function for FusionHTLC
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
  // Events
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
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export class EvmFusionHTLCClient {
  private contract: Contract;
  private provider: Provider;
  private chainConfig: EvmChainConfig;
  private signer?: Signer;
  private contractType: 'SimpleHTLC' | 'FusionHTLC' | null = null;

  constructor(
    chainConfig: EvmChainConfig,
    providerOrSigner: Provider | Signer
  ) {
    this.chainConfig = chainConfig;
    
    if ('getAddress' in providerOrSigner) {
      // It's a signer
      this.signer = providerOrSigner as Signer;
      this.provider = this.signer.provider!;
    } else {
      // It's a provider
      this.provider = providerOrSigner as Provider;
    }

    this.contract = new Contract(
      chainConfig.htlcAddress,
      FUSION_HTLC_ABI,
      this.signer || this.provider
    );
  }

  async detectContractType(): Promise<void> {
    if (this.contractType) return;
    
    const testId = ethers.keccak256(ethers.toUtf8Bytes('test'));
    
    try {
      await this.contract.contracts(testId);
      this.contractType = 'SimpleHTLC';
      logger.info(`Detected SimpleHTLC contract at ${this.chainConfig.htlcAddress}`);
    } catch {
      try {
        await this.contract.getDetails(testId);
        this.contractType = 'FusionHTLC';
        logger.info(`Detected FusionHTLC contract at ${this.chainConfig.htlcAddress}`);
      } catch (error) {
        throw new Error(`Contract at ${this.chainConfig.htlcAddress} doesn't support contracts() or getDetails()`);
      }
    }
  }

  async getContractDetails(contractId: string): Promise<HTLCDetails> {
    await this.detectContractType();
    
    try {
      let result;
      if (this.contractType === 'SimpleHTLC') {
        result = await this.contract.contracts(contractId);
      } else {
        result = await this.contract.getDetails(contractId);
      }
      
      const [token, beneficiary, originator, hashLock, timelock, value, state] = result;
      
      return {
        contractId,
        token,
        beneficiary,
        originator,
        hashLock,
        timelock: timelock.toString(),
        value: value.toString(),
        state: Number(state) as SwapState
      };
    } catch (error) {
      logger.error('Failed to get contract details:', error);
      throw error;
    }
  }

  async createHTLC(params: CreateHTLCParams): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to create HTLC');
    }

    const {
      contractId,
      token,
      beneficiary,
      hashLock,
      timelock,
      value
    } = params;

    try {
      // First approve token transfer if it's an ERC20 token
      if (token !== ethers.ZeroAddress) {
        const tokenContract = new Contract(token, ERC20_ABI, this.signer);
        const currentAllowance = await tokenContract.allowance(
          await this.signer.getAddress(),
          this.chainConfig.htlcAddress
        );
        
        if (BigInt(currentAllowance.toString()) < BigInt(value)) {
          logger.info('Approving token transfer...');
          const approveTx = await tokenContract.approve(
            this.chainConfig.htlcAddress,
            value
          );
          await approveTx.wait();
          logger.info('Token transfer approved');
        }
      }

      // Create the HTLC
      logger.info('Creating HTLC with params:', {
        contractId,
        token,
        beneficiary,
        hashLock,
        timelock,
        value: value.toString()
      });

      const tx = await this.contract.fund(
        contractId,
        token,
        beneficiary,
        hashLock,
        timelock,
        value,
        { value: token === ethers.ZeroAddress ? value : 0 }
      );

      logger.info('HTLC creation transaction sent:', tx.hash);
      return tx;
    } catch (error) {
      logger.error('Failed to create HTLC:', error);
      throw error;
    }
  }

  async claimHTLC(contractId: string, preimage: string): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to claim HTLC');
    }

    try {
      logger.info('Claiming HTLC:', { contractId, preimage });
      const tx = await this.contract.claim(contractId, preimage);
      logger.info('Claim transaction sent:', tx.hash);
      return tx;
    } catch (error) {
      logger.error('Failed to claim HTLC:', error);
      throw error;
    }
  }

  async refundHTLC(contractId: string): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required to refund HTLC');
    }

    try {
      logger.info('Refunding HTLC:', contractId);
      const tx = await this.contract.refund(contractId);
      logger.info('Refund transaction sent:', tx.hash);
      return tx;
    } catch (error) {
      logger.error('Failed to refund HTLC:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (tokenAddress === ethers.ZeroAddress) {
      // Native token balance
      return (await this.provider.getBalance(userAddress)).toString();
    } else {
      // ERC20 token balance
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      return (await tokenContract.balanceOf(userAddress)).toString();
    }
  }

  async waitForHTLCCreation(
    contractId: string,
    fromBlock?: number
  ): Promise<FundedEvent | null> {
    const filter = this.contract.filters.HTLCCreated(contractId);
    const events = await this.contract.queryFilter(filter, fromBlock);
    
    if (events.length > 0) {
      const event = events[0];
      return {
        contractId: event.args![0],
        originator: event.args![1],
        beneficiary: event.args![2],
        token: event.args![3],
        value: event.args![4].toString(),
        hashLock: event.args![5],
        timelock: event.args![6].toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };
    }
    
    return null;
  }

  async waitForHTLCClaim(
    contractId: string,
    fromBlock?: number
  ): Promise<ClaimedEvent | null> {
    const filter = this.contract.filters.HTLCClaimed(contractId);
    const events = await this.contract.queryFilter(filter, fromBlock);
    
    if (events.length > 0) {
      const event = events[0];
      return {
        contractId: event.args![0],
        claimer: event.args![1],
        preimage: event.args![2],
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };
    }
    
    return null;
  }

  async waitForHTLCRefund(
    contractId: string,
    fromBlock?: number
  ): Promise<RefundedEvent | null> {
    const filter = this.contract.filters.HTLCRefunded(contractId);
    const events = await this.contract.queryFilter(filter, fromBlock);
    
    if (events.length > 0) {
      const event = events[0];
      return {
        contractId: event.args![0],
        refunder: event.args![1],
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };
    }
    
    return null;
  }

  getContractAddress(): string {
    return this.chainConfig.htlcAddress;
  }

  getChainId(): number {
    return this.chainConfig.chainId;
  }
}