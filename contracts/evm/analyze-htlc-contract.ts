import { ethers } from 'ethers';

// Configuration
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
const HTLC_ADDRESS = '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3';

// Extended HTLC ABI with more functions to check contract state
const HTLC_ABI = [
  'function getCurrentTime() view returns (uint256)',
  'function fundETH(bytes32 contractId, address payable beneficiary, bytes32 hashLock, uint256 timelock) payable',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function isClaimable(bytes32 contractId) view returns (bool)',
  'function isRefundable(bytes32 contractId) view returns (bool)',
  // Common validation functions that might exist
  'function MIN_TIMELOCK() view returns (uint256)',
  'function MAX_TIMELOCK() view returns (uint256)',
  'function isPaused() view returns (bool)',
  'function owner() view returns (address)',
  // Events
  'event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock)'
];

async function analyzeHTLCContract() {
  console.log('🔍 Analyzing HTLC Contract for Validation Issues...\n');

  try {
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const wallet = new ethers.Wallet('e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647', provider);
    const htlcContract = new ethers.Contract(HTLC_ADDRESS, HTLC_ABI, wallet);

    console.log('📋 Contract Analysis:');
    console.log('Address:', HTLC_ADDRESS);
    console.log('Network: Monad Testnet');

    // Check basic contract state
    const chainTime = await htlcContract.getCurrentTime();
    console.log('Chain Time:', Number(chainTime));

    // Try to call validation functions if they exist
    const possibleChecks = [
      { name: 'MIN_TIMELOCK', func: 'MIN_TIMELOCK' },
      { name: 'MAX_TIMELOCK', func: 'MAX_TIMELOCK' },
      { name: 'isPaused', func: 'isPaused' },
      { name: 'owner', func: 'owner' }
    ];

    console.log('\n🔧 Contract Validation Checks:');
    for (const check of possibleChecks) {
      try {
        const result = await htlcContract[check.func]();
        console.log(`✅ ${check.name}:`, result.toString ? result.toString() : result);
      } catch (error) {
        console.log(`❌ ${check.name}: Not available or failed`);
      }
    }

    // Check our wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log('\n💰 Wallet Balance:', ethers.formatEther(balance), 'ETH');

    // Try a minimal transaction to see what fails
    console.log('\n🧪 Testing Minimal Valid Parameters:');
    
    const testParams = {
      contractId: ethers.hexlify(ethers.randomBytes(32)),
      beneficiary: wallet.address, // Use our own address
      hashLock: ethers.hexlify(ethers.randomBytes(32)),
      timelock: Number(chainTime) + 3600, // 1 hour from now
      amount: ethers.parseEther('0.001')
    };

    console.log('Test Contract ID:', testParams.contractId);
    console.log('Test Beneficiary:', testParams.beneficiary);
    console.log('Test Timelock:', testParams.timelock, '→', new Date(testParams.timelock * 1000).toISOString());
    console.log('Test Amount:', ethers.formatEther(testParams.amount), 'ETH');

    try {
      const gasEstimate = await htlcContract.fundETH.estimateGas(
        testParams.contractId,
        testParams.beneficiary,
        testParams.hashLock,
        testParams.timelock,
        { value: testParams.amount }
      );
      console.log('✅ Minimal test passed! Gas:', gasEstimate.toString());
    } catch (error) {
      console.log('❌ Minimal test failed:', (error as Error).message);
      
      // Try to decode the error
      if ((error as any).data) {
        console.log('Error data:', (error as any).data);
      }
    }

    // Check if contract has any special requirements
    console.log('\n🔍 Checking Contract Requirements:');
    
    // Test different timelock ranges
    const timelockTests = [
      { name: '1 minute', seconds: 60 },
      { name: '1 hour', seconds: 3600 },
      { name: '24 hours', seconds: 24 * 3600 },
      { name: '7 days', seconds: 7 * 24 * 3600 }
    ];

    for (const test of timelockTests) {
      const testTimelock = Number(chainTime) + test.seconds;
      try {
        await htlcContract.fundETH.estimateGas(
          ethers.hexlify(ethers.randomBytes(32)),
          wallet.address,
          ethers.hexlify(ethers.randomBytes(32)),
          testTimelock,
          { value: ethers.parseEther('0.001') }
        );
        console.log(`✅ ${test.name} timelock: VALID`);
      } catch (error) {
        console.log(`❌ ${test.name} timelock: FAILED - ${(error as Error).message.split('(')[0]}`);
      }
    }

    // Check recent events from the contract to see if it's working for others
    console.log('\n📊 Recent Contract Activity:');
    try {
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 1000); // Last 1000 blocks
      
      const filter = htlcContract.filters.HTLCCreated();
      const events = await htlcContract.queryFilter(filter, fromBlock);
      
      console.log(`Found ${events.length} HTLC creations in last 1000 blocks`);
      if (events.length > 0) {
        const recent = events.slice(-3); // Last 3 events
        for (const event of recent) {
          console.log(`  Block ${event.blockNumber}: Contract ${event.args?.contractId} with timelock ${event.args?.timelock}`);
        }
      }
    } catch (error) {
      console.log('❌ Could not fetch recent events:', (error as Error).message);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Check if we can read the contract source or ABI
async function checkContractSource() {
  console.log('\n🔍 Checking Contract Source...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    
    // Get contract bytecode
    const bytecode = await provider.getCode(HTLC_ADDRESS);
    console.log('Bytecode length:', bytecode.length);
    console.log('Contract deployed:', bytecode !== '0x');
    
    // Try to identify if it's a proxy or implementation
    if (bytecode.includes('363d3d373d3d3d363d73')) {
      console.log('🔄 Appears to be a proxy contract');
    } else {
      console.log('📄 Appears to be implementation contract');
    }

  } catch (error) {
    console.error('❌ Source check failed:', error);
  }
}

// Run the analysis
analyzeHTLCContract()
  .then(() => checkContractSource())
  .catch(console.error);