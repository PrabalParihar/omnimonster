import { ethers } from 'ethers';

// Configuration
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
const HTLC_ADDRESS = '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3';

// HTLC ABI
const HTLC_ABI = [
  'function getCurrentTime() view returns (uint256)',
  'function fundETH(bytes32 contractId, address payable beneficiary, bytes32 hashLock, uint256 timelock) payable',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function isClaimable(bytes32 contractId) view returns (bool)',
  'function isRefundable(bytes32 contractId) view returns (bool)',
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
];

async function traceSwapCreation() {
  console.log('🔍 Tracing Swap Creation Process...\n');

  try {
    // Connect to Monad
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const wallet = new ethers.Wallet('e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647', provider);
    const htlcContract = new ethers.Contract(HTLC_ADDRESS, HTLC_ABI, wallet);

    // Get current time from contract
    const chainTime = await htlcContract.getCurrentTime();
    const chainTimeNumber = Number(chainTime);
    
    console.log('⛓️  Current chain time:', chainTimeNumber);
    console.log('📅 Chain date:', new Date(chainTimeNumber * 1000).toISOString());

    // Simulate swap creation parameters
    const swapParams = {
      contractId: ethers.hexlify(ethers.randomBytes(32)),
      beneficiary: '0x5417D2a6026fB21509FDc9C7fE6e4Cf6794767E0',
      hashLock: ethers.hexlify(ethers.randomBytes(32)),
      amount: ethers.parseEther('0.001')
    };

    console.log('\n📋 Swap Parameters:');
    console.log('Contract ID:', swapParams.contractId);
    console.log('Beneficiary:', swapParams.beneficiary);
    console.log('Hash Lock:', swapParams.hashLock);
    console.log('Amount:', ethers.formatEther(swapParams.amount), 'ETH');

    // Test different timelock values
    const timelockStrategies = [
      { name: 'Immediate Expiry (now)', timelock: chainTimeNumber },
      { name: 'Past Time (expired)', timelock: chainTimeNumber - 60 },
      { name: 'Short (30 seconds)', timelock: chainTimeNumber + 30 },
      { name: 'Medium (5 minutes)', timelock: chainTimeNumber + 300 },
      { name: 'Normal (24 hours)', timelock: chainTimeNumber + (24 * 60 * 60) }
    ];

    for (const strategy of timelockStrategies) {
      console.log(`\n🧪 Testing: ${strategy.name}`);
      console.log('='.repeat(50));
      
      const contractId = ethers.hexlify(ethers.randomBytes(32));
      
      console.log('Timelock:', strategy.timelock);
      console.log('Timelock Date:', new Date(strategy.timelock * 1000).toISOString());
      console.log('Time until expiry:', strategy.timelock - chainTimeNumber, 'seconds');
      
      try {
        // Estimate gas to see if the transaction would succeed
        const gasEstimate = await htlcContract.fundETH.estimateGas(
          contractId,
          swapParams.beneficiary,
          swapParams.hashLock,
          strategy.timelock,
          { value: swapParams.amount }
        );
        
        console.log('✅ Gas Estimate:', gasEstimate.toString(), '(transaction would succeed)');
        
        // For safe strategies, actually create the HTLC
        if (strategy.name.includes('5 minutes') || strategy.name.includes('24 hours')) {
          console.log('🚀 Creating actual HTLC...');
          
          const tx = await htlcContract.fundETH(
            contractId,
            swapParams.beneficiary,
            swapParams.hashLock,
            strategy.timelock,
            { value: swapParams.amount }
          );
          
          console.log('📄 Transaction Hash:', tx.hash);
          
          const receipt = await tx.wait();
          console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);
          
          // Check HTLC details immediately after creation
          const details = await htlcContract.getDetails(contractId);
          const [isClaimable, isRefundable] = await Promise.all([
            htlcContract.isClaimable(contractId),
            htlcContract.isRefundable(contractId)
          ]);
          
          console.log('📊 HTLC Details:');
          console.log('  Timelock:', Number(details.timelock));
          console.log('  State:', Number(details.state));
          console.log('  Is Claimable:', isClaimable);
          console.log('  Is Refundable:', isRefundable);
          
          // Check if it's immediately expired
          const currentTimeAfterCreation = await htlcContract.getCurrentTime();
          const timeRemaining = Number(details.timelock) - Number(currentTimeAfterCreation);
          
          console.log('⏱️  Time Remaining:', timeRemaining, 'seconds');
          console.log(timeRemaining <= 0 ? '❌ IMMEDIATELY EXPIRED!' : '✅ Still valid');
        }
        
      } catch (error) {
        console.log('❌ Gas Estimation Failed:', (error as Error).message);
        
        // Check if it's a timelock validation error
        if ((error as Error).message.includes('timelock') || (error as Error).message.includes('expired')) {
          console.log('🚨 LIKELY CAUSE: Timelock validation in contract');
        }
      }
    }

  } catch (error) {
    console.error('❌ Tracing failed:', error);
  }
}

// Check for contract-level timelock validation
async function checkContractValidation() {
  console.log('\n🔧 Checking Contract Timelock Validation...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const htlcContract = new ethers.Contract(HTLC_ADDRESS, HTLC_ABI, provider);
    
    // Get contract bytecode to analyze
    const bytecode = await provider.getCode(HTLC_ADDRESS);
    console.log('📄 Contract exists:', bytecode !== '0x');
    
    // Check current time multiple times to see if there's drift
    console.log('⏰ Time Consistency Check:');
    for (let i = 0; i < 5; i++) {
      const time = await htlcContract.getCurrentTime();
      const jsTime = Math.floor(Date.now() / 1000);
      console.log(`  Check ${i + 1}: Contract=${Number(time)}, JS=${jsTime}, Diff=${Number(time) - jsTime}s`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
  } catch (error) {
    console.error('❌ Contract validation check failed:', error);
  }
}

// Run the trace
traceSwapCreation()
  .then(() => checkContractValidation())
  .catch(console.error);