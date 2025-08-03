import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';

async function checkHTLCFunctions() {
  console.log('🔍 Checking HTLC contract functions on Monad...\n');
  
  const provider = new ethers.JsonRpcProvider(evmChains.monadTestnet.rpcUrl);
  const htlcAddress = evmChains.monadTestnet.htlcAddress;
  
  console.log('📄 HTLC address:', htlcAddress);
  
  // Check if contract exists
  const code = await provider.getCode(htlcAddress);
  if (code === '0x') {
    console.log('❌ No contract deployed at this address');
    return;
  }
  
  console.log('✅ Contract is deployed');
  console.log('📏 Contract code size:', (code.length - 2) / 2, 'bytes');
  
  // Try to get the contract bytecode hash to identify it
  const codeHash = ethers.keccak256(code);
  console.log('🔐 Contract code hash:', codeHash);
  
  // Try calling a known function with a test contract ID
  const testContractId = ethers.keccak256(ethers.toUtf8Bytes('test'));
  
  // Try the getDetails function
  const htlcContract = new ethers.Contract(
    htlcAddress,
    ['function getDetails(bytes32) view returns (address,address,address,bytes32,uint256,uint256,uint8)'],
    provider
  );
  
  try {
    const details = await htlcContract.getDetails(testContractId);
    console.log('\n✅ getDetails function works!');
    console.log('Details:', details);
  } catch (error) {
    console.log('\n❌ getDetails failed:', error.message);
  }
  
  // Check Sepolia HTLC for comparison
  console.log('\n\n🔍 Checking Sepolia HTLC for comparison...');
  const sepoliaProvider = new ethers.JsonRpcProvider(evmChains.sepolia.rpcUrl);
  const sepoliaHTLC = evmChains.sepolia.htlcAddress;
  
  const sepoliaCode = await sepoliaProvider.getCode(sepoliaHTLC);
  const sepoliaCodeHash = ethers.keccak256(sepoliaCode);
  
  console.log('📄 Sepolia HTLC:', sepoliaHTLC);
  console.log('📏 Contract code size:', (sepoliaCode.length - 2) / 2, 'bytes');
  console.log('🔐 Contract code hash:', sepoliaCodeHash);
  
  if (codeHash === sepoliaCodeHash) {
    console.log('\n✅ Monad and Sepolia have the SAME contract code!');
  } else {
    console.log('\n⚠️  Monad and Sepolia have DIFFERENT contract code!');
  }
}

checkHTLCFunctions();