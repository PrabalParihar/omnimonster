import { ethers } from 'ethers';

// Configuration
const DEMO_PRIVATE_KEY = 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
const POOL_MANAGER_PRIVATE_KEY = '0xefb5c329d347fdefd49346ae79700ea4d351b90044a25d8a67a62d56e5cee0dd';

// RPC URLs
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';
const POLYGON_AMOY_RPC = 'https://polygon-amoy.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';

// Known demo token addresses (actual deployed tokens)
const DEMO_TOKEN_ADDRESSES = {
  sepolia: [
    '0x779877A7B0D9E8603169DdbD7836e478b4624789', // LINK
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'  // UNI
  ],
  polygon_amoy: [
    '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'  // LINK
  ],
  monad: [
    '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B', // MONSTER Token (deployed)
    '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24'  // OMNIMONSTER Token (deployed)
  ]
};

// Demo token ABI - minimal for balance checking
const DEMO_TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

async function checkBalances() {
    console.log('🔍 Checking Demo Token Balances...\n');

    // Create wallets
    const demoWallet = new ethers.Wallet(DEMO_PRIVATE_KEY);
    const poolWallet = new ethers.Wallet(POOL_MANAGER_PRIVATE_KEY);
    
    console.log('📍 Addresses:');
    console.log('Demo Address (from private key):', demoWallet.address);
    console.log('Expected Demo Address: 0x2BCc053BB6915F28aC2041855D2292dDca406903');
    console.log('Pool Manager:', poolWallet.address);
    console.log('');

    // Networks to check
    const networks = [
        { 
            name: 'Sepolia', 
            rpc: SEPOLIA_RPC, 
            chainId: 11155111,
            tokens: DEMO_TOKEN_ADDRESSES.sepolia
        },
        { 
            name: 'Polygon Amoy', 
            rpc: POLYGON_AMOY_RPC, 
            chainId: 80002,
            tokens: DEMO_TOKEN_ADDRESSES.polygon_amoy
        },
        { 
            name: 'Monad', 
            rpc: MONAD_RPC, 
            chainId: 41454,
            tokens: DEMO_TOKEN_ADDRESSES.monad
        }
    ];

    for (const network of networks) {
        console.log(`🌐 ${network.name} Network:`);
        console.log('='.repeat(50));
        
        try {
            const provider = new ethers.JsonRpcProvider(network.rpc);
            
            // Check ETH/native token balances
            const demoEthBalance = await provider.getBalance(demoWallet.address);
            const poolEthBalance = await provider.getBalance(poolWallet.address);
            
            console.log(`💰 Native Token Balances:`);
            console.log(`Demo Address: ${ethers.formatEther(demoEthBalance)} ETH`);
            console.log(`Pool Manager: ${ethers.formatEther(poolEthBalance)} ETH`);
            console.log('');
            
            // Check demo token balances
            console.log(`🪙 Demo Token Balances:`);
            
            if (network.tokens.length === 0) {
                console.log('No known demo tokens configured for this network');
            }
            
            for (const tokenAddress of network.tokens) {
                try {
                    const tokenContract = new ethers.Contract(tokenAddress, DEMO_TOKEN_ABI, provider);
                    
                    const [symbol, name, decimals, demoBalance, poolBalance] = await Promise.all([
                        tokenContract.symbol(),
                        tokenContract.name(),
                        tokenContract.decimals(),
                        tokenContract.balanceOf(demoWallet.address),
                        tokenContract.balanceOf(poolWallet.address)
                    ]);
                    
                    console.log(`\n📋 Token: ${name} (${symbol})`);
                    console.log(`📍 Address: ${tokenAddress}`);
                    console.log(`💎 Demo Address Balance: ${ethers.formatUnits(demoBalance, decimals)} ${symbol}`);
                    console.log(`🏊 Pool Manager Balance: ${ethers.formatUnits(poolBalance, decimals)} ${symbol}`);
                    
                } catch (tokenError) {
                    console.log(`❌ Error checking token ${tokenAddress}: ${tokenError.message}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error connecting to ${network.name}: ${error.message}`);
        }
        
        console.log('\n');
    }
}

// Function to fund pool with demo tokens
async function fundPool(networkName: string, tokenAddress: string, amount: string) {
    console.log(`🏊 Funding pool with ${amount} tokens on ${networkName}...`);
    
    const networkConfig = {
        sepolia: SEPOLIA_RPC,
        polygon_amoy: POLYGON_AMOY_RPC,
        monad: MONAD_RPC
    };
    
    const rpc = networkConfig[networkName as keyof typeof networkConfig];
    if (!rpc) {
        console.log('❌ Unknown network');
        return;
    }
    
    const provider = new ethers.JsonRpcProvider(rpc);
    const demoWallet = new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
    const poolWallet = new ethers.Wallet(POOL_MANAGER_PRIVATE_KEY, provider);
    
    // Token contract
    const tokenContract = new ethers.Contract(tokenAddress, DEMO_TOKEN_ABI, demoWallet);
    
    try {
        const decimals = await tokenContract.decimals();
        const transferAmount = ethers.parseUnits(amount, decimals);
        
        const tx = await tokenContract.transfer(poolWallet.address, transferAmount);
        console.log('Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ Pool funded successfully!');
    } catch (error) {
        console.log('❌ Error funding pool:', (error as Error).message);
    }
}

// Run the balance check
checkBalances().catch(console.error);

// Export for use in other scripts
export { fundPool, checkBalances };