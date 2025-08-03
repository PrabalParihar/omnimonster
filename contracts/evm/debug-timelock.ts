import { ethers } from 'ethers';

// Configuration
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';

// HTLC contract addresses  
const HTLC_ADDRESSES = {
  sepolia: '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D',
  monad: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3'
};

// HTLC ABI
const HTLC_ABI = [
  'function getCurrentTime() view returns (uint256)',
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

async function debugTimelockCalculation() {
  console.log('🔍 Debug: Timelock Calculation Issue\n');

  try {
    // Get current time from different sources
    const jsTime = Math.floor(Date.now() / 1000);
    console.log('📅 JavaScript Time (Date.now()):', jsTime);
    console.log('📅 JavaScript Date:', new Date(jsTime * 1000).toISOString());
    
    // Check network times
    for (const [network, rpc] of Object.entries({sepolia: SEPOLIA_RPC, monad: MONAD_RPC})) {
      console.log(`\n🌐 ${network.toUpperCase()} Network:`);
      console.log('='.repeat(40));
      
      const provider = new ethers.JsonRpcProvider(rpc);
      const htlcContract = new ethers.Contract(
        HTLC_ADDRESSES[network as keyof typeof HTLC_ADDRESSES], 
        HTLC_ABI, 
        provider
      );

      try {
        const chainTime = await htlcContract.getCurrentTime();
        const chainTimeNumber = Number(chainTime);
        
        console.log('⛓️  Chain Time (contract):', chainTimeNumber);
        console.log('📅 Chain Date:', new Date(chainTimeNumber * 1000).toISOString());
        console.log('⏰ Time Difference:', chainTimeNumber - jsTime, 'seconds');
        
        // Test timelock calculations
        const shortTimelock = chainTimeNumber + 60; // 1 minute
        const normalTimelock = chainTimeNumber + (24 * 60 * 60); // 24 hours
        const jsTimelock = jsTime + (24 * 60 * 60); // 24 hours from JS time
        
        console.log('\n🕒 Timelock Calculations:');
        console.log('  Short (1 min):', shortTimelock, '→', new Date(shortTimelock * 1000).toISOString());
        console.log('  Chain + 24h:  ', normalTimelock, '→', new Date(normalTimelock * 1000).toISOString());
        console.log('  JS + 24h:     ', jsTimelock, '→', new Date(jsTimelock * 1000).toISOString());
        
        // Check if timelock would be valid
        const isShortValid = shortTimelock > chainTimeNumber;
        const isNormalValid = normalTimelock > chainTimeNumber;
        
        console.log('\n✅ Validity Check:');
        console.log('  Short timelock valid:', isShortValid);
        console.log('  Normal timelock valid:', isNormalValid);
        
      } catch (error) {
        console.log('❌ Error getting chain time:', (error as Error).message);
      }
    }

    // Check the orchestrator timelock calculation
    console.log(`\n🔧 ORCHESTRATOR CALCULATION:`);
    console.log('='.repeat(50));
    
    // Simulate the current orchestrator logic
    const request = { timelock: undefined }; // Default case
    const orchestratorTimelock = Math.floor(Date.now() / 1000) + (request.timelock || 24 * 60 * 60);
    
    console.log('Math.floor(Date.now() / 1000):', Math.floor(Date.now() / 1000));
    console.log('24 * 60 * 60:', 24 * 60 * 60);
    console.log('Final timelock:', orchestratorTimelock);
    console.log('Timelock date:', new Date(orchestratorTimelock * 1000).toISOString());
    
    // Check for potential issues
    console.log(`\n🚨 POTENTIAL ISSUES:`);
    console.log('='.repeat(50));
    
    // Issue 1: Using wrong time source
    console.log('1. Time Source Mismatch:');
    console.log('   - Using JS time instead of chain time');
    console.log('   - Solution: Use contract.getCurrentTime()');
    
    // Issue 2: Timezone issues  
    console.log('\n2. Timezone Issues:');
    console.log('   - JS Date.now() is UTC');
    console.log('   - Chain time should also be UTC');
    
    // Issue 3: Small timelock buffer
    console.log('\n3. Timelock Buffer:');
    console.log('   - If transaction takes time to mine');
    console.log('   - Block time vs creation time difference');
    console.log('   - Solution: Add buffer (e.g., +300 seconds)');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Test with a real HTLC creation simulation
async function simulateHTLCCreation() {
  console.log('\n🧪 SIMULATE HTLC CREATION:');
  console.log('='.repeat(50));
  
  try {
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const htlcContract = new ethers.Contract(HTLC_ADDRESSES.monad, HTLC_ABI, provider);
    
    // Get chain time
    const chainTime = await htlcContract.getCurrentTime();
    const chainTimeNumber = Number(chainTime);
    
    console.log('⛓️  Current chain time:', chainTimeNumber);
    console.log('📅 Chain date:', new Date(chainTimeNumber * 1000).toISOString());
    
    // Simulate different timelock strategies
    const strategies = {
      'Current (JS time + 24h)': Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      'Fixed (Chain time + 24h)': chainTimeNumber + (24 * 60 * 60),
      'Safe (Chain time + 24h + 5min buffer)': chainTimeNumber + (24 * 60 * 60) + 300,
      'Test (Chain time + 5min)': chainTimeNumber + 300
    };
    
    console.log('\n🔄 Timelock Strategies:');
    for (const [name, timelock] of Object.entries(strategies)) {
      const timeUntilExpiry = timelock - chainTimeNumber;
      const isValid = timeUntilExpiry > 0;
      
      console.log(`\n${name}:`);
      console.log(`  Timelock: ${timelock}`);
      console.log(`  Date: ${new Date(timelock * 1000).toISOString()}`);
      console.log(`  Time until expiry: ${timeUntilExpiry} seconds (${(timeUntilExpiry/60).toFixed(1)} minutes)`);
      console.log(`  Valid: ${isValid ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  }
}

// Run the debug
debugTimelockCalculation()
  .then(() => simulateHTLCCreation())
  .catch(console.error);