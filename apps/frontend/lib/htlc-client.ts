import { ethers } from 'ethers';

// Unified HTLC client that supports both SimpleHTLC and FusionHTLC interfaces
export class UnifiedHTLCClient {
  private contract: ethers.Contract;
  private contractType: 'simple' | 'fusion' | 'unknown' = 'unknown';

  constructor(
    contractAddress: string,
    signerOrProvider: ethers.Signer | ethers.Provider
  ) {
    // Combined ABI supporting both interfaces
    const abi = [
      // SimpleHTLC methods
      'function contracts(bytes32) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
      'function getHTLC(bytes32) view returns (uint8 state, address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value)',
      
      // FusionHTLC methods
      'function getDetails(bytes32) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
      
      // Common claim method
      'function claim(bytes32 contractId, bytes32 preimage) external',
    ];

    this.contract = new ethers.Contract(contractAddress, abi, signerOrProvider);
  }

  async getHTLCDetails(contractId: string): Promise<{
    token: string;
    beneficiary: string;
    originator: string;
    hashLock: string;
    timelock: bigint;
    value: bigint;
    state: number;
  }> {
    // Try different methods in order of likelihood
    const methods = [
      { name: 'getDetails', type: 'fusion' },
      { name: 'contracts', type: 'simple' },
      { name: 'getHTLC', type: 'simple-alt' }
    ];

    for (const method of methods) {
      try {
        let result;
        
        if (method.name === 'getDetails') {
          result = await this.contract.getDetails(contractId);
          this.contractType = 'fusion';
          return {
            token: result[0],
            beneficiary: result[1],
            originator: result[2],
            hashLock: result[3],
            timelock: result[4],
            value: result[5],
            state: Number(result[6])
          };
        } else if (method.name === 'contracts') {
          result = await this.contract.contracts(contractId);
          this.contractType = 'simple';
          return {
            token: result[0],
            beneficiary: result[1],
            originator: result[2],
            hashLock: result[3],
            timelock: result[4],
            value: result[5],
            state: Number(result[6])
          };
        } else if (method.name === 'getHTLC') {
          result = await this.contract.getHTLC(contractId);
          this.contractType = 'simple';
          // Note: getHTLC returns state as first element
          return {
            state: Number(result[0]),
            token: result[1],
            beneficiary: result[2],
            originator: result[3],
            hashLock: result[4],
            timelock: result[5],
            value: result[6]
          };
        }
      } catch (e) {
        // Try next method
        continue;
      }
    }

    throw new Error('Failed to read HTLC state - contract may not exist or uses unknown interface');
  }

  async claim(contractId: string, preimage: string): Promise<ethers.ContractTransactionResponse> {
    return await this.contract.claim(contractId, preimage);
  }

  getContractType(): string {
    return this.contractType;
  }

  getStateDescription(state: number): string {
    const stateNames: Record<number, string> = {
      0: 'INVALID',
      1: 'FUNDED',
      2: 'CLAIMED',
      3: 'REFUNDED'
    };
    return stateNames[state] || 'UNKNOWN';
  }
}