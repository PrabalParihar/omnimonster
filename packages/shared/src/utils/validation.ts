import { ethers } from 'ethers';
import { ValidationError } from './errors';

/**
 * Validation utilities for HTLC parameters and addresses
 */

export function validateAddress(address: string, name = 'Address'): void {
  if (!address) {
    throw new ValidationError(`${name} is required`);
  }
  
  if (!ethers.isAddress(address)) {
    throw new ValidationError(`${name} is not a valid Ethereum address`);
  }
  
  if (address === ethers.ZeroAddress) {
    throw new ValidationError(`${name} cannot be zero address`);
  }
}

export function validateHashLock(hashLock: string): void {
  if (!hashLock) {
    throw new ValidationError('Hash lock is required');
  }
  
  if (hashLock.length !== 66 || !hashLock.startsWith('0x')) {
    throw new ValidationError('Hash lock must be a 32-byte hex string starting with 0x');
  }
  
  if (hashLock === ethers.ZeroHash) {
    throw new ValidationError('Hash lock cannot be zero hash');
  }
}

export function validateTimelock(timelock: number, currentTime?: number): void {
  if (!timelock || timelock <= 0) {
    throw new ValidationError('Timelock must be greater than 0');
  }
  
  const now = currentTime || Math.floor(Date.now() / 1000);
  if (timelock <= now) {
    throw new ValidationError('Timelock must be in the future');
  }
  
  // Warn if timelock is very short (less than 5 minutes)
  if (timelock - now < 300) {
    console.warn('Warning: Timelock is very short (less than 5 minutes)');
  }
}

export function validateValue(value: string | bigint): void {
  const valueBigInt = typeof value === 'string' ? BigInt(value) : value;
  
  if (valueBigInt <= BigInt(0)) {
    throw new ValidationError('Value must be greater than 0');
  }
}

export function validateContractId(contractId: string): void {
  if (!contractId) {
    throw new ValidationError('Contract ID is required');
  }
  
  if (contractId.length !== 66 || !contractId.startsWith('0x')) {
    throw new ValidationError('Contract ID must be a 32-byte hex string starting with 0x');
  }
}

export function validatePreimage(preimage: string): void {
  if (!preimage) {
    throw new ValidationError('Preimage is required');
  }
  
  if (preimage.length !== 66 || !preimage.startsWith('0x')) {
    throw new ValidationError('Preimage must be a 32-byte hex string starting with 0x');
  }
}

/**
 * Validate all HTLC creation parameters
 */
export function validateCreateHTLCParams(params: {
  contractId: string;
  beneficiary: string;
  hashLock: string;
  timelock: number;
  value: string;
  token?: string;
}): void {
  validateContractId(params.contractId);
  validateAddress(params.beneficiary, 'Beneficiary');
  validateHashLock(params.hashLock);
  validateTimelock(params.timelock);
  validateValue(params.value);
  
  if (params.token && params.token !== ethers.ZeroAddress) {
    validateAddress(params.token, 'Token');
  }
}

/**
 * Validate sufficient balance for transaction
 */
export function validateSufficientBalance(
  userBalance: bigint,
  requiredAmount: bigint,
  gasEstimate: bigint = BigInt(0),
  tokenSymbol = 'ETH'
): void {
  const totalRequired = requiredAmount + gasEstimate;
  
  if (userBalance < totalRequired) {
    throw new ValidationError(
      `Insufficient ${tokenSymbol} balance. ` +
      `Required: ${ethers.formatEther(totalRequired)} ${tokenSymbol}, ` +
      `Available: ${ethers.formatEther(userBalance)} ${tokenSymbol}`
    );
  }
}