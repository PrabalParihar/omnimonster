#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';

const contractId = '0x992e3c490e8e0a425049c61b6239670afe8f6c0711ccb37c9cfec2789f3f000c';
const htlcAddress = '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7';
const rpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3';

async function verifyExactHtlc() {
  console.log(chalk.cyan.bold('\n🔍 VERIFYING EXACT HTLC\n'));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ['function contracts(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'];
  const contract = new ethers.Contract(htlcAddress, abi, provider);

  try {
    console.log(chalk.yellow('Contract Details:'));
    console.log(chalk.gray(`   Contract ID: ${contractId}`));
    console.log(chalk.gray(`   HTLC Address: ${htlcAddress}`));
    console.log(chalk.gray(`   RPC URL: ${rpcUrl}`));

    const result = await contract.contracts(contractId);
    
    console.log(chalk.green('\n✅ HTLC Found!'));
    console.log(chalk.gray(`   Token: ${result.token}`));
    console.log(chalk.gray(`   Beneficiary: ${result.beneficiary}`));
    console.log(chalk.gray(`   Originator: ${result.originator}`));
    console.log(chalk.gray(`   Value: ${result.value.toString()}`));
    console.log(chalk.gray(`   State: ${result.state}`));
    console.log(chalk.gray(`   Hash Lock: ${result.hashLock}`));
    console.log(chalk.gray(`   Timelock: ${new Date(Number(result.timelock) * 1000).toISOString()}`));

    if (result.state === 1) {
      console.log(chalk.green('\n✅ HTLC is ACTIVE and ready!'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

verifyExactHtlc().catch(console.error);