import { ethers } from 'ethers';
import { evmChains } from './packages/shared/src/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function verifyNewHTLC() {
  const contractId = '0xd5ab9465b929751189932a764d443fb7823bbf0b42717af2aada825b1d9f2df6';
  
  console.log('🔍 Verifying new HTLC on Sepolia...\n');
  console.log('Contract ID:', contractId);
  
  const sepoliaConfig = evmChains.sepolia;
  const provider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrl);
  
  try {
    // Check HTLC contract
    const htlcAddress = sepoliaConfig.htlcAddress;
    console.log('HTLC Contract:', htlcAddress);
    
    const htlcABI = [
      'function getDetails(bytes32) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
    ];
    
    const htlcContract = new ethers.Contract(htlcAddress, htlcABI, provider);
    
    console.log('\n📊 Fetching HTLC details...');
    
    try {
      const details = await htlcContract.getDetails(contractId);
      console.log('\nHTLC Details:');
      console.log('- Token:', details.token);
      console.log('- Beneficiary:', details.beneficiary);
      console.log('- Originator:', details.originator);
      console.log('- Hash Lock:', details.hashLock);
      console.log('- Timelock:', details.timelock.toString());
      console.log('- Value:', details.value.toString());
      console.log('- State:', details.state, '(0=INVALID, 1=PENDING, 2=CLAIMED, 3=REFUNDED)');
      
      if (details.state === 0) {
        console.log('\n❌ HTLC does not exist on-chain!');
        console.log('This means either:');
        console.log('1. The transaction is still pending');
        console.log('2. The transaction failed');
        console.log('3. The contract ID is incorrect');
      } else {
        console.log('\n✅ HTLC exists on-chain!');
      }
    } catch (error) {
      console.log('\n❌ Error fetching HTLC details:', error.message);
    }
    
    // Try to find recent HTLC creation events
    console.log('\n📜 Searching for recent HTLC creation events...');
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 1000; // Look back 1000 blocks
    
    const eventABI = [
      'event HTLCFunded(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
    ];
    
    const eventContract = new ethers.Contract(htlcAddress, eventABI, provider);
    const filter = eventContract.filters.HTLCFunded();
    
    try {
      const events = await eventContract.queryFilter(filter, fromBlock, currentBlock);
      console.log(`Found ${events.length} HTLCFunded events in the last 1000 blocks`);
      
      // Look for our contract ID
      const ourEvent = events.find(event => event.args && event.args.contractId === contractId);
      if (ourEvent) {
        console.log('\n✅ Found HTLCFunded event for our contract ID!');
        console.log('Block:', ourEvent.blockNumber);
        console.log('Transaction:', ourEvent.transactionHash);
      } else {
        console.log('\n❌ No HTLCFunded event found for contract ID:', contractId);
      }
    } catch (error) {
      console.log('Error searching events:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyNewHTLC();