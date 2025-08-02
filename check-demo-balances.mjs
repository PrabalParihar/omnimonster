import { ethers } from 'ethers';

// Configuration
const DEMO_PRIVATE_KEY = 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
const POOL_MANAGER_PRIVATE_KEY = '0xefb5c329d347fdefd49346ae79700ea4d351b90044a25d8a67a62d56e5cee0dd';

// RPC URLs
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';
const POLYGON_AMOY_RPC = 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';

// Demo token contract addresses (need to find these)
const DEMO_TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)"
];

async function checkBalances() {
    console.log('🔍 Checking Demo Token Balances...\n');

    // Create wallets
    const demoWallet = new ethers.Wallet(DEMO_PRIVATE_KEY);
    const poolWallet = new ethers.Wallet(POOL_MANAGER_PRIVATE_KEY);
    
    console.log('📍 Addresses:');
    console.log('Demo Address:', demoWallet.address);
    console.log('Pool Manager:', poolWallet.address);
    console.log('');

    // Networks to check
    const networks = [
        { name: 'Sepolia', rpc: SEPOLIA_RPC, chainId: 11155111 },
        { name: 'Polygon Amoy', rpc: POLYGON_AMOY_RPC, chainId: 80002 },
        { name: 'Monad', rpc: MONAD_RPC, chainId: 41454 }
    ];

    for (const network of networks) {
        console.log(`🌐 ${network.name} Network:`);
        console.log('='.repeat(50));
        
        try {
            const provider = new ethers.JsonRpcProvider(network.rpc);
            
            // Check ETH balances
            const demoEthBalance = await provider.getBalance(demoWallet.address);
            const poolEthBalance = await provider.getBalance(poolWallet.address);
            
            console.log(`💰 Native Token Balances:`);
            console.log(`Demo Address: ${ethers.formatEther(demoEthBalance)} ETH`);
            console.log(`Pool Manager: ${ethers.formatEther(poolEthBalance)} ETH`);
            
            // Common demo token addresses (we'll need to find the actual ones)
            const commonTokenAddresses = [
                // Add known demo token addresses here
            ];
            
            // Check for demo tokens by scanning recent transactions or known addresses
            console.log(`📊 Demo Token Balances: (searching for demo tokens...)`);
            console.log('Note: Demo token addresses need to be identified\n');
            
        } catch (error) {
            console.log(`❌ Error connecting to ${network.name}:`, error.message);
        }
    }
}

// Function to fund pool with demo tokens
async function fundPool(tokenAddress, amount, networkRpc) {
    console.log('🏊 Funding pool with demo tokens...');
    
    const provider = new ethers.JsonRpcProvider(networkRpc);
    const demoWallet = new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
    const poolWallet = new ethers.Wallet(POOL_MANAGER_PRIVATE_KEY, provider);
    
    // Token contract
    const tokenContract = new ethers.Contract(tokenAddress, [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address owner) view returns (uint256)"
    ], demoWallet);
    
    try {
        const tx = await tokenContract.transfer(poolWallet.address, ethers.parseUnits(amount, 18));
        console.log('Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ Pool funded successfully!');
    } catch (error) {
        console.log('❌ Error funding pool:', error.message);
    }
}

// Run the balance check
checkBalances().catch(console.error);