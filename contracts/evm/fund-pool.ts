import { ethers } from 'ethers';

// Configuration
const DEMO_PRIVATE_KEY = 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647';
const POOL_MANAGER_PRIVATE_KEY = '0xefb5c329d347fdefd49346ae79700ea4d351b90044a25d8a67a62d56e5cee0dd';

// RPC URLs
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';

// Demo token addresses on Monad
const MONAD_TOKENS = {
  MONSTER: '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B',
  OMNIMONSTER: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24'
};

// Demo token ABI
const DEMO_TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

async function fundPool() {
    console.log('🏊 Funding Pool with Demo Tokens...\n');

    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const demoWallet = new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
    const poolWallet = new ethers.Wallet(POOL_MANAGER_PRIVATE_KEY, provider);
    
    console.log('📍 Addresses:');
    console.log('Demo Address:', demoWallet.address);
    console.log('Pool Manager:', poolWallet.address);
    console.log('');

    // Fund amounts (in tokens)
    const fundAmounts = {
        MONSTER: '100000',     // 100K MONSTER tokens
        OMNIMONSTER: '100000'  // 100K OMNIMONSTER tokens
    };

    for (const [tokenName, tokenAddress] of Object.entries(MONAD_TOKENS)) {
        console.log(`💰 Processing ${tokenName} Token...`);
        console.log('='.repeat(40));
        
        try {
            const tokenContract = new ethers.Contract(tokenAddress, DEMO_TOKEN_ABI, demoWallet);
            
            // Check current balances
            const [symbol, decimals, demoBalance, poolBalance] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
                tokenContract.balanceOf(demoWallet.address),
                tokenContract.balanceOf(poolWallet.address)
            ]);
            
            console.log(`📊 Current Balances:`);
            console.log(`Demo Address: ${ethers.formatUnits(demoBalance, decimals)} ${symbol}`);
            console.log(`Pool Manager: ${ethers.formatUnits(poolBalance, decimals)} ${symbol}`);
            
            // Calculate transfer amount
            const transferAmount = ethers.parseUnits(fundAmounts[tokenName as keyof typeof fundAmounts], decimals);
            
            // Check if demo address has enough balance
            if (demoBalance < transferAmount) {
                console.log(`❌ Insufficient balance. Need ${ethers.formatUnits(transferAmount, decimals)} ${symbol}, have ${ethers.formatUnits(demoBalance, decimals)} ${symbol}`);
                continue;
            }
            
            console.log(`🚀 Transferring ${ethers.formatUnits(transferAmount, decimals)} ${symbol} to pool...`);
            
            // Transfer tokens to pool
            const tx = await tokenContract.transfer(poolWallet.address, transferAmount);
            console.log(`📄 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
            
            // Check new balances
            const [newDemoBalance, newPoolBalance] = await Promise.all([
                tokenContract.balanceOf(demoWallet.address),
                tokenContract.balanceOf(poolWallet.address)
            ]);
            
            console.log(`📊 New Balances:`);
            console.log(`Demo Address: ${ethers.formatUnits(newDemoBalance, decimals)} ${symbol}`);
            console.log(`Pool Manager: ${ethers.formatUnits(newPoolBalance, decimals)} ${symbol}`);
            
        } catch (error) {
            console.log(`❌ Error processing ${tokenName}: ${(error as Error).message}`);
        }
        
        console.log('');
    }
    
    console.log('🎉 Pool funding complete!');
}

// Run the funding
fundPool().catch(console.error);