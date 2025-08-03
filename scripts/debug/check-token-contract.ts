import { ethers } from 'ethers';

async function checkToken() {
  // Check if MONSTER token exists on Sepolia
  const sepoliaProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3');
  const monsterAddress = '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E';

  console.log('Checking MONSTER token on Sepolia...');
  console.log('Token address:', monsterAddress);

  try {
    const code = await sepoliaProvider.getCode(monsterAddress);
    const hasCode = code !== '0x';
    console.log('Contract exists:', hasCode);
    console.log('Contract code length:', code.length);
    
    if (hasCode) {
      // Try to call balanceOf for the wallet address
      const tokenContract = new ethers.Contract(
        monsterAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        sepoliaProvider
      );
      
      const balance = await tokenContract.balanceOf('0x2BCc053BB6915F28aC2041855D2292dDca406903');
      const decimals = await tokenContract.decimals();
      console.log('Balance check successful:', ethers.formatUnits(balance, decimals), 'MONSTER');
      console.log('Token decimals:', decimals);
    } else {
      console.log('❌ No contract found at this address!');
      console.log('This explains the "could not decode result data" error');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkToken();