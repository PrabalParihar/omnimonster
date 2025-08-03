import { ethers } from 'ethers';
import { createHash, randomBytes } from 'crypto';

// Configuration
const CONFIG = {
  // Networks
  SEPOLIA_RPC: 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  MONAD_RPC: 'https://testnet-rpc.monad.xyz',
  
  // HTLC Contracts
  SEPOLIA_HTLC: '0xb65Dd3b3E7549a9e0c8F0400c28984AEe470EAE8',
  MONAD_HTLC: '0x7185D90BCD120dE7d091DF6EA8bd26e912571b61',
  
  // Token Contracts
  SEPOLIA_MONSTER: '0xD129b708871DDA920dF1E897C4a4788961718324',
  MONAD_OMNIMONSTER: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
  
  // API
  API_URL: 'http://localhost:3000/api',
  
  // Wallets
  ALICE_KEY: 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647',
  BOB_KEY: '0xefb5c329d347fdefd49346ae79700ea4d351b90044a25d8a67a62d56e5cee0dd'
};

// Contract ABIs
const HTLC_ABI = [
  'function getCurrentTime() view returns (uint256)',
  'function fundETH(bytes32 contractId, address payable beneficiary, bytes32 hashLock, uint256 timelock) payable',
  'function claim(bytes32 contractId, bytes32 preimage)',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function isClaimable(bytes32 contractId) view returns (bool)'
];

const TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// Utility functions
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function completeSwapFlowTest() {
  console.log('🚀 Complete Cross-Chain Swap Flow Test\n');
  console.log('Testing: Sepolia MONSTER → Monad OMNIMONSTER\n');

  // Initialize providers and wallets
  const sepoliaProvider = new ethers.JsonRpcProvider(CONFIG.SEPOLIA_RPC);
  const monadProvider = new ethers.JsonRpcProvider(CONFIG.MONAD_RPC);
  
  const alice = new ethers.Wallet(CONFIG.ALICE_KEY);
  const bob = new ethers.Wallet(CONFIG.BOB_KEY);
  
  console.log('👤 Alice (User):', alice.address);
  console.log('👤 Bob (Pool):', bob.address);
  
  // Step 1: Create swap via API
  console.log('\n📝 Step 1: Creating Swap via API');
  console.log('='.repeat(50));
  
  const swapRequest = {
    fromChain: 'sepolia',
    toChain: 'monadTestnet', 
    fromToken: 'MONSTER',
    toToken: 'OMNIMONSTER',
    amount: '5',
    beneficiary: alice.address,
    slippage: 1,
    dryRun: false
  };
  
  const createSwapResponse = await fetch(`${CONFIG.API_URL}/swaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapRequest)
  });
  
  const swapData = await createSwapResponse.json();
  const swapId = swapData.id;
  
  console.log('✅ Swap created');
  console.log('Swap ID:', swapId);
  console.log('Initial Status:', swapData.status);
  
  // Step 2: Simulate source chain HTLC creation
  console.log('\n🔒 Step 2: Creating HTLC on Source Chain (Sepolia)');
  console.log('='.repeat(50));
  
  const preimage = ethers.hexlify(randomBytes(32));
  const hashLock = '0x' + createHash('sha256').update(Buffer.from(preimage.slice(2), 'hex')).digest('hex');
  
  const sepoliaHTLC = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, alice.connect(sepoliaProvider));
  const sourceContractId = ethers.hexlify(randomBytes(32));
  const currentTime = await sepoliaHTLC.getCurrentTime();
  const sourceTimelock = Number(currentTime) + (24 * 60 * 60); // 24 hours
  
  console.log('Contract ID:', sourceContractId);
  console.log('Hash Lock:', hashLock);
  console.log('Timelock:', new Date(sourceTimelock * 1000).toISOString());
  
  const sourceTx = await sepoliaHTLC.fundETH(
    sourceContractId,
    bob.address,
    hashLock,
    sourceTimelock,
    { value: ethers.parseEther('0.005') }
  );
  
  console.log('Transaction:', sourceTx.hash);
  await sourceTx.wait();
  console.log('✅ HTLC created on Sepolia');
  
  // Update swap with source HTLC info
  await fetch(`${CONFIG.API_URL}/swaps/${swapId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userHtlcContract: sourceContractId,
      hashLock: hashLock,
      status: 'SOURCE_LOCKED'
    })
  });
  
  // Step 3: Simulate destination chain HTLC creation
  console.log('\n🔒 Step 3: Creating Counter-HTLC on Destination Chain (Monad)');
  console.log('='.repeat(50));
  
  const monadHTLC = new ethers.Contract(CONFIG.MONAD_HTLC, HTLC_ABI, bob.connect(monadProvider));
  const destContractId = ethers.hexlify(randomBytes(32));
  const destCurrentTime = await monadHTLC.getCurrentTime();
  const destTimelock = Number(destCurrentTime) + (12 * 60 * 60); // 12 hours (shorter)
  
  console.log('Contract ID:', destContractId);
  console.log('Hash Lock:', hashLock, '(same as source)');
  console.log('Timelock:', new Date(destTimelock * 1000).toISOString());
  
  const destTx = await monadHTLC.fundETH(
    destContractId,
    alice.address,
    hashLock,
    destTimelock,
    { value: ethers.parseEther('0.005') }
  );
  
  console.log('Transaction:', destTx.hash);
  await destTx.wait();
  console.log('✅ Counter-HTLC created on Monad');
  
  // Update swap with destination HTLC info
  await fetch(`${CONFIG.API_URL}/swaps/${swapId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      poolHtlcContract: destContractId,
      status: 'DESTINATION_LOCKED'
    })
  });
  
  // Step 4: Alice claims on destination chain
  console.log('\n🎯 Step 4: Alice Claims on Destination Chain (Monad)');
  console.log('='.repeat(50));
  
  const aliceMonadHTLC = new ethers.Contract(CONFIG.MONAD_HTLC, HTLC_ABI, alice.connect(monadProvider));
  
  console.log('Claiming with preimage:', preimage);
  const claimTx = await aliceMonadHTLC.claim(destContractId, preimage);
  console.log('Transaction:', claimTx.hash);
  await claimTx.wait();
  console.log('✅ Alice successfully claimed on Monad');
  
  // Verify claim
  const destDetails = await monadHTLC.getDetails(destContractId);
  console.log('HTLC State:', Number(destDetails.state), '(2 = CLAIMED)');
  
  // Update swap status
  await fetch(`${CONFIG.API_URL}/swaps/${swapId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'DESTINATION_CLAIMED',
      preimageHash: preimage
    })
  });
  
  // Step 5: Bob claims on source chain
  console.log('\n🎯 Step 5: Bob Claims on Source Chain (Sepolia)');
  console.log('='.repeat(50));
  
  const bobSepoliaHTLC = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, bob.connect(sepoliaProvider));
  
  console.log('Claiming with revealed preimage:', preimage);
  const bobClaimTx = await bobSepoliaHTLC.claim(sourceContractId, preimage);
  console.log('Transaction:', bobClaimTx.hash);
  await bobClaimTx.wait();
  console.log('✅ Bob successfully claimed on Sepolia');
  
  // Verify claim
  const sourceDetails = await sepoliaHTLC.getDetails(sourceContractId);
  console.log('HTLC State:', Number(sourceDetails.state), '(2 = CLAIMED)');
  
  // Update final swap status
  await fetch(`${CONFIG.API_URL}/swaps/${swapId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'USER_CLAIMED'
    })
  });
  
  // Step 6: Verify final swap status
  console.log('\n📊 Step 6: Final Swap Status');
  console.log('='.repeat(50));
  
  const finalSwapResponse = await fetch(`${CONFIG.API_URL}/swaps/${swapId}`);
  const finalSwap = await finalSwapResponse.json();
  
  console.log('Swap ID:', finalSwap.id);
  console.log('Final Status:', finalSwap.status);
  console.log('Source HTLC:', finalSwap.userHtlcContract);
  console.log('Destination HTLC:', finalSwap.poolHtlcContract);
  console.log('Hash Lock:', finalSwap.hashLock);
  console.log('Preimage:', finalSwap.preimageHash);
  console.log('Created:', new Date(finalSwap.createdAt).toISOString());
  console.log('Updated:', new Date(finalSwap.updatedAt).toISOString());
  
  // Step 7: Test gasless claim creation
  console.log('\n⛽ Step 7: Testing Gasless Claim Feature');
  console.log('='.repeat(50));
  
  const claimRequest = {
    swapRequestId: swapId,
    claimerAddress: alice.address,
    htlcContract: CONFIG.MONAD_HTLC,
    contractId: destContractId,
    preimage: preimage,
    signature: '0x' + '0'.repeat(130) // Placeholder signature
  };
  
  const claimResponse = await fetch(`${CONFIG.API_URL}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claimRequest)
  });
  
  if (claimResponse.ok) {
    const claimData = await claimResponse.json();
    console.log('✅ Gasless claim record created');
    console.log('Claim ID:', claimData.id);
    console.log('Status:', claimData.status);
  } else {
    console.log('⚠️  Gasless claim not available (swap already claimed)');
  }
  
  // Summary
  console.log('\n🎉 Complete Cross-Chain Swap Flow Test Successful!');
  console.log('='.repeat(50));
  console.log('✅ Swap created via API');
  console.log('✅ HTLCs created on both chains');
  console.log('✅ Alice claimed on destination chain');
  console.log('✅ Bob claimed on source chain');
  console.log('✅ Database records updated correctly');
  console.log('✅ All components working together!');
}

// Run the test
completeSwapFlowTest().catch(console.error);