#!/usr/bin/env node

/**
 * Generate a test wallet for Party B
 */

const { ethers } = require('ethers');

console.log('🔐 Generating Test Wallet for Party B');
console.log('=====================================');

const wallet = ethers.Wallet.createRandom();

console.log(`Address: ${wallet.address}`);
console.log(`Private Key: ${wallet.privateKey}`);

console.log('\n💰 Fund this wallet with testnet tokens:');
console.log('- Sepolia ETH: https://sepoliafaucet.com/');
console.log('- Polygon Amoy MATIC: https://faucet.polygon.technology/');

console.log('\n🧪 Use this wallet as Party B in your atomic swap tests');
console.log(`Export PARTY_B_KEY="${wallet.privateKey}"`);
console.log(`Export PARTY_B_ADDRESS="${wallet.address}"`);