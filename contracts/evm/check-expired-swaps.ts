import { ethers } from 'ethers';

// RPC URLs
const NETWORKS = {
  sepolia: 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  polygon_amoy: 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  monad: 'https://testnet-rpc.monad.xyz'
};

// HTLC contract addresses
const HTLC_ADDRESSES = {
  sepolia: '0x5d981ca300DDAAb10D2bD98E3115264C1A2c168D',
  polygon_amoy: '0x04139d1fCC2E6f8b964C257eFceEA99a783Df422',
  monad: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3'
};

// HTLC ABI
const HTLC_ABI = [
  'function getDetails(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)',
  'function isRefundable(bytes32 contractId) view returns (bool)',
  'function isClaimable(bytes32 contractId) view returns (bool)',
  'function getCurrentTime() view returns (uint256)'
];

interface HTLCDetails {
  token: string;
  beneficiary: string;
  originator: string;
  hashLock: string;
  timelock: number;
  value: bigint;
  state: number;
}

// HTLC States
enum HTLCState {
  INVALID = 0,
  PENDING = 1,
  CLAIMED = 2,
  REFUNDED = 3
}

async function checkHTLCStatus(contractId: string, network: keyof typeof NETWORKS): Promise<any> {
  const provider = new ethers.JsonRpcProvider(NETWORKS[network]);
  const htlcContract = new ethers.Contract(HTLC_ADDRESSES[network], HTLC_ABI, provider);

  try {
    console.log(`🔍 Checking HTLC ${contractId} on ${network}...`);
    
    const [details, isRefundable, isClaimable, currentTime] = await Promise.all([
      htlcContract.getDetails(contractId),
      htlcContract.isRefundable(contractId),
      htlcContract.isClaimable(contractId),
      htlcContract.getCurrentTime()
    ]);

    const timelock = Number(details.timelock);
    const currentTimestamp = Number(currentTime);
    const timeUntilExpiry = timelock - currentTimestamp;
    const isExpired = timeUntilExpiry <= 0;

    const status = {
      contractId,
      network,
      state: HTLCState[details.state],
      timelock: new Date(timelock * 1000).toISOString(),
      currentTime: new Date(currentTimestamp * 1000).toISOString(),
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      isExpired,
      isRefundable,
      isClaimable,
      beneficiary: details.beneficiary,
      originator: details.originator,
      value: ethers.formatEther(details.value)
    };

    console.log(`📊 HTLC Status:`, status);
    return status;

  } catch (error) {
    console.log(`❌ Error checking HTLC: ${(error as Error).message}`);
    return {
      contractId,
      network,
      error: (error as Error).message,
      isExpired: true // Assume expired if we can't check
    };
  }
}

async function checkCommonExpiredHTLCs(): Promise<void> {
  console.log('🔍 Checking Common HTLC Contract IDs for Expiration...\n');

  // Common test contract IDs that might be expired
  const testContractIds = [
    '0x14fa431bf404cf11eca287bfcd2893ae61028f183d718c255787ee29494e5c7e', // Known test contract
    '0xcbbcaaf911a8c26fac235f6d957b8282897e20201dc78d29b10410294d1e2a1a'  // Another test contract
  ];

  for (const contractId of testContractIds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Checking Contract ID: ${contractId}`);
    console.log(`${'='.repeat(60)}`);

    for (const network of Object.keys(NETWORKS) as Array<keyof typeof NETWORKS>) {
      try {
        await checkHTLCStatus(contractId, network);
      } catch (error) {
        console.log(`❌ Failed to check ${network}: ${(error as Error).message}`);
      }
    }
  }
}

// Function to check if a specific swap ID is expired
export async function checkSwapExpiration(swapId: string): Promise<boolean> {
  try {
    // For demo purposes, check if it's one of the known test swaps
    if (swapId === 'swap_1753822682274_fdp8r1p8q') {
      const contractId = '0x14fa431bf404cf11eca287bfcd2893ae61028f183d718c255787ee29494e5c7e';
      const status = await checkHTLCStatus(contractId, 'sepolia');
      return status.isExpired;
    }

    // For other swaps, you would need to:
    // 1. Get swap details from database
    // 2. Extract contract ID and network
    // 3. Check HTLC status on the appropriate network

    console.log(`⚠️  Unknown swap ID: ${swapId}. Cannot check expiration.`);
    return false;

  } catch (error) {
    console.error(`❌ Error checking swap expiration:`, error);
    return true; // Assume expired if error
  }
}

// Auto-fix expired swap statuses
async function updateExpiredSwapStatuses(): Promise<void> {
  console.log('\n🔄 Updating expired swap statuses in database...');
  
  try {
    // This would typically fetch all pending swaps from the database
    // and check their HTLC status, then update to 'expired' if needed
    
    console.log('ℹ️  Database update functionality would be implemented here');
    console.log('    - Fetch all PENDING swaps from database');
    console.log('    - Check each HTLC contract for expiration');
    console.log('    - Update status to EXPIRED for expired HTLCs');
    
  } catch (error) {
    console.error('❌ Error updating swap statuses:', error);
  }
}

// Run the expiration check
if (require.main === module) {
  checkCommonExpiredHTLCs()
    .then(() => updateExpiredSwapStatuses())
    .catch(console.error);
}

export { checkHTLCStatus, checkCommonExpiredHTLCs };