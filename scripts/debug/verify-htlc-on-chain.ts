import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function verifyHTLCOnChain() {
  // Transaction from your logs
  const txHash = '0xe107a931998d950cb40222fd6522ccedc0ca5377ec588ee3243ba260daab96cd';
  const contractId = '0x0e95f9320dacd40ca1fe008c804bf2239e4a23d1d54ab2b8c4c6fe0e0ef3f355';
  
  console.log('🔍 Verifying HTLC on Sepolia...\n');
  console.log('Transaction:', txHash);
  console.log('Contract ID:', contractId);
  
  const sepoliaConfig = evmChains.sepolia;
  const provider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrl);
  
  try {
    // Get transaction receipt
    console.log('\n📋 Getting transaction receipt...');
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log('❌ Transaction not found!');
      return;
    }
    
    console.log('✅ Transaction confirmed');
    console.log('- Block:', receipt.blockNumber);
    console.log('- Status:', receipt.status === 1 ? 'Success' : 'Failed');
    console.log('- Gas used:', receipt.gasUsed.toString());
    console.log('- To:', receipt.to);
    
    // Check HTLC contract
    const htlcAddress = sepoliaConfig.htlcAddress;
    console.log('\n🔗 HTLC Contract:', htlcAddress);
    
    // SimpleHTLC ABI
    const htlcABI = [
      'function getDetails(bytes32) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
      'event HTLCFunded(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
    ];
    
    const htlcContract = new ethers.Contract(htlcAddress, htlcABI, provider);
    
    // Try to get HTLC details
    console.log('\n📊 Fetching HTLC details for contract ID:', contractId);
    
    try {
      const details = await htlcContract.getDetails(contractId);
      console.log('\n✅ HTLC Details:');
      console.log('- Token:', details.token);
      console.log('- Beneficiary:', details.beneficiary);
      console.log('- Originator:', details.originator);
      console.log('- Hash Lock:', details.hashLock);
      console.log('- Timelock:', new Date(Number(details.timelock) * 1000).toISOString());
      console.log('- Value:', ethers.formatUnits(details.value, 18), 'tokens');
      console.log('- State:', details.state, '(0=INVALID, 1=PENDING, 2=CLAIMED, 3=REFUNDED)');
    } catch (error) {
      console.log('\n❌ Error fetching HTLC details:', error.message);
      console.log('\nThis could mean:');
      console.log('1. The contract ID doesn\'t exist');
      console.log('2. Wrong HTLC contract address');
      console.log('3. Network issues');
    }
    
    // Check transaction logs
    console.log('\n📜 Checking transaction logs...');
    const logs = receipt.logs;
    console.log(`Found ${logs.length} logs`);
    
    // Parse HTLCFunded events
    for (const log of logs) {
      try {
        const parsed = htlcContract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsed && parsed.name === 'HTLCFunded') {
          console.log('\n🎉 HTLCFunded Event Found!');
          console.log('- Contract ID:', parsed.args.contractId);
          console.log('- Originator:', parsed.args.originator);
          console.log('- Beneficiary:', parsed.args.beneficiary);
          console.log('- Token:', parsed.args.token);
          console.log('- Value:', ethers.formatUnits(parsed.args.value, 18), 'tokens');
          console.log('- Hash Lock:', parsed.args.hashLock);
          console.log('- Timelock:', new Date(Number(parsed.args.timelock) * 1000).toISOString());
          
          // Check if this matches our expected contract ID
          if (parsed.args.contractId === contractId) {
            console.log('\n✅ Contract ID matches!');
          } else {
            console.log('\n⚠️  Contract ID mismatch!');
            console.log('Expected:', contractId);
            console.log('Got:', parsed.args.contractId);
          }
        }
      } catch (e) {
        // Not an HTLC event, skip
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyHTLCOnChain();