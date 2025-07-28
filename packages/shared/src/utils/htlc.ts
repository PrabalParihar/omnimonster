import { ethers } from 'ethers';

export interface HTLCParams {
  srcChain: string | number;
  dstChain: string | number;
  nonce: string | number;
  hashlock: string;
}

/**
 * Generate a deterministic HTLC ID using SHA256
 * Format: sha256(srcChain + dstChain + nonce + hashlock)
 */
export function generateHTLCId(params: HTLCParams): string {
  const { srcChain, dstChain, nonce, hashlock } = params;
  
  // Normalize inputs to strings
  const srcChainStr = srcChain.toString();
  const dstChainStr = dstChain.toString();
  const nonceStr = nonce.toString();
  
  // Ensure hashlock is properly formatted (remove 0x prefix if present)
  const hashlockHex = hashlock.startsWith('0x') ? hashlock.slice(2) : hashlock;
  
  // Concatenate all parameters
  const combined = srcChainStr + dstChainStr + nonceStr + hashlockHex;
  
  // Generate SHA256 hash
  const hash = ethers.sha256(ethers.toUtf8Bytes(combined));
  
  return hash;
}

/**
 * Generate a random preimage (32 bytes)
 */
export function generatePreimage(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Generate hashlock from preimage using SHA256
 */
export function generateHashlock(preimage: string): string {
  // Ensure preimage is properly formatted
  const preimageBytes = preimage.startsWith('0x') ? preimage : `0x${preimage}`;
  return ethers.sha256(preimageBytes);
}

/**
 * Verify that a preimage matches a hashlock
 */
export function verifyPreimage(preimage: string, hashlock: string): boolean {
  const computedHash = generateHashlock(preimage);
  return computedHash.toLowerCase() === hashlock.toLowerCase();
}

/**
 * Generate a random nonce for HTLC creation
 */
export function generateNonce(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

/**
 * Calculate timelock (Unix timestamp) for a given duration in seconds
 */
export function calculateTimelock(durationSeconds: number): number {
  return Math.floor(Date.now() / 1000) + durationSeconds;
}

/**
 * Check if a timelock has expired
 */
export function isTimelockExpired(timelock: number): boolean {
  return Math.floor(Date.now() / 1000) >= timelock;
}

/**
 * Convert timelock to human-readable format
 */
export function formatTimelock(timelock: number): string {
  return new Date(timelock * 1000).toISOString();
}

/**
 * Parse amount from string to appropriate format for each chain type
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Format amount from wei/base units to human-readable format
 */
export function formatAmount(amount: bigint | string, decimals: number = 18): string {
  return ethers.formatUnits(amount.toString(), decimals);
}

/**
 * Swap state enum matching both EVM and Cosmos contracts
 */
export enum SwapState {
  INVALID = 0,
  OPEN = 1,
  CLAIMED = 2,
  REFUNDED = 3
}

/**
 * HTLC contract details interface (unified for both chains)
 */
export interface HTLCDetails {
  contractId: string;
  token: string;
  beneficiary: string;
  originator: string;
  hashLock: string;
  timelock: number;
  value: string;
  state: SwapState;
}

/**
 * HTLC creation parameters
 */
export interface CreateHTLCParams {
  contractId: string;
  beneficiary: string;
  hashLock: string;
  timelock: number;
  value: string;
  token?: string; // address(0) for ETH, undefined for native cosmos tokens
}

/**
 * Cross-chain swap parameters
 */
export interface CrossChainSwapParams {
  srcChain: string;
  dstChain: string;
  srcToken: string;
  dstToken: string;
  amount: string;
  beneficiary: string;
  timelock: number;
  preimage?: string; // Optional, will be generated if not provided
}

/**
 * Event data structures for HTLC events
 */
export interface FundedEvent {
  contractId: string;
  originator: string;
  beneficiary: string;
  token: string;
  value: string;
  hashLock: string;
  timelock: number;
  blockNumber?: number;
  transactionHash?: string;
}

export interface ClaimedEvent {
  contractId: string;
  beneficiary: string;
  preimage: string;
  value: string;
  blockNumber?: number;
  transactionHash?: string;
}

export interface RefundedEvent {
  contractId: string;
  originator: string;
  value: string;
  blockNumber?: number;
  transactionHash?: string;
}