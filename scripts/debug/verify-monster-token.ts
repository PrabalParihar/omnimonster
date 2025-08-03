import { ethers } from 'ethers';

async function verifyMonsterToken() {
  const sepoliaProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
  const monsterAddress = '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E';
  const walletAddress = '0x2BCc053BB6915F28aC2041855D2292dDca406903';

  console.log('🔍 Verifying Monster token on Sepolia...');
  console.log('Token address:', monsterAddress);
  console.log('Wallet address:', walletAddress);

  try {
    // Check if contract exists
    const code = await sepoliaProvider.getCode(monsterAddress);
    const hasCode = code !== '0x' && code !== '0x0';
    console.log('\n📄 Contract exists:', hasCode);
    console.log('Contract code length:', code.length);
    
    if (!hasCode) {
      console.log('❌ No contract found at this address!');
      console.log('This explains the "could not decode result data" error');
      return;
    }

    // Try to interact with it as an ERC20 token
    const ERC20_ABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address owner) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)'
    ];

    const tokenContract = new ethers.Contract(monsterAddress, ERC20_ABI, sepoliaProvider);
    
    console.log('\n🪙 Checking ERC20 functions...');
    
    try {
      const name = await tokenContract.name();
      console.log('✅ Token name:', name);
    } catch (e) {
      console.log('❌ Failed to get token name:', e.message);
    }

    try {
      const symbol = await tokenContract.symbol();
      console.log('✅ Token symbol:', symbol);
    } catch (e) {
      console.log('❌ Failed to get token symbol:', e.message);
    }

    try {
      const decimals = await tokenContract.decimals();
      console.log('✅ Token decimals:', decimals);
    } catch (e) {
      console.log('❌ Failed to get token decimals:', e.message);
    }

    try {
      const balance = await tokenContract.balanceOf(walletAddress);
      console.log('✅ Wallet balance:', ethers.formatEther(balance), 'tokens');
    } catch (e) {
      console.log('❌ Failed to get balance:', e.message);
    }

    try {
      const totalSupply = await tokenContract.totalSupply();
      console.log('✅ Total supply:', ethers.formatEther(totalSupply), 'tokens');
    } catch (e) {
      console.log('❌ Failed to get total supply:', e.message);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }

  // Also check the old Monster token address
  console.log('\n\n🔍 Checking OLD Monster token address...');
  const oldMonsterAddress = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
  console.log('Old token address:', oldMonsterAddress);
  
  try {
    const oldCode = await sepoliaProvider.getCode(oldMonsterAddress);
    const oldHasCode = oldCode !== '0x' && oldCode !== '0x0';
    console.log('Old contract exists:', oldHasCode);
    
    if (oldHasCode) {
      const oldTokenContract = new ethers.Contract(oldMonsterAddress, ERC20_ABI, sepoliaProvider);
      try {
        const oldSymbol = await oldTokenContract.symbol();
        const oldBalance = await oldTokenContract.balanceOf(walletAddress);
        console.log('✅ Old token symbol:', oldSymbol);
        console.log('✅ Old token balance:', ethers.formatEther(oldBalance), 'tokens');
      } catch (e) {
        console.log('❌ Failed to interact with old token:', e.message);
      }
    }
  } catch (error: any) {
    console.error('Error checking old token:', error.message);
  }
}

verifyMonsterToken();