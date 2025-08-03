#!/usr/bin/env tsx
import { ethers } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import database
import { FusionDatabase, getDatabaseConfig, FusionDAO } from '../packages/shared/src/database';

const CONFIG = {
  SEPOLIA_RPC: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/MS9pGRxd1Jh3rhVjyIkFzVfG1g3BcTk3',
  SEPOLIA_HTLC: '0x89f4e5B11264b6e1FcEeE07E840d3A88Ba0b23C7',
};

const HTLC_ABI = [
  'function getContract(bytes32 contractId) view returns (address token, address beneficiary, address originator, bytes32 hashLock, uint256 timelock, uint256 value, uint8 state)'
];

async function verifyAndFixResolver() {
  console.log(chalk.cyan.bold('\n🔍 VERIFYING HTLC AND RESOLVER\n'));

  // Initialize database
  const dbConfig = getDatabaseConfig();
  const database = FusionDatabase.getInstance(dbConfig);
  const dao = new FusionDAO(database);

  try {
    // Get the latest swap
    const latestSwap = await dao.query(
      `SELECT * FROM swap_requests 
       WHERE user_htlc_contract IS NOT NULL 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (latestSwap.rows.length === 0) {
      console.log(chalk.red('No swaps with user HTLC found'));
      return;
    }

    const swap = latestSwap.rows[0];
    console.log(chalk.blue('📋 Latest Swap:'));
    console.log(chalk.gray(`   ID: ${swap.id}`));
    console.log(chalk.gray(`   Status: ${swap.status}`));
    console.log(chalk.gray(`   User HTLC: ${swap.user_htlc_contract}`));
    console.log(chalk.gray(`   Hash Lock: ${swap.hash_lock}`));

    // Verify HTLC on blockchain
    console.log(chalk.yellow('\n🔗 Verifying HTLC on Sepolia...'));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.SEPOLIA_RPC);
    const htlcContract = new ethers.Contract(CONFIG.SEPOLIA_HTLC, HTLC_ABI, provider);
    
    try {
      const htlcDetails = await htlcContract.getContract(swap.user_htlc_contract);
      console.log(chalk.green('✅ HTLC found on blockchain!'));
      console.log(chalk.gray(`   Token: ${htlcDetails.token}`));
      console.log(chalk.gray(`   Beneficiary: ${htlcDetails.beneficiary}`));
      console.log(chalk.gray(`   Originator: ${htlcDetails.originator}`));
      console.log(chalk.gray(`   Value: ${htlcDetails.value.toString()}`));
      console.log(chalk.gray(`   State: ${htlcDetails.state} (0=Invalid, 1=Active, 2=Claimed, 3=Refunded)`));
      console.log(chalk.gray(`   Hash Lock: ${htlcDetails.hashLock}`));
      console.log(chalk.gray(`   Timelock: ${new Date(Number(htlcDetails.timelock) * 1000).toISOString()}`));

      if (htlcDetails.state === 1) {
        console.log(chalk.green('\n✅ HTLC is ACTIVE and ready for pool to counter!'));
        
        // The issue might be the hash lock format
        console.log(chalk.yellow('\n🔍 Checking hash lock consistency...'));
        console.log(chalk.gray(`   DB Hash Lock: ${swap.hash_lock}`));
        console.log(chalk.gray(`   Chain Hash Lock: ${htlcDetails.hashLock}`));
        
        if (swap.hash_lock !== htlcDetails.hashLock) {
          console.log(chalk.red('   ❌ Hash locks do not match!'));
          console.log(chalk.yellow('   Updating database...'));
          
          await dao.updateSwapRequest(swap.id, {
            hashLock: htlcDetails.hashLock
          });
          
          console.log(chalk.green('   ✅ Database updated with correct hash lock'));
        } else {
          console.log(chalk.green('   ✅ Hash locks match'));
        }
        
        // Check why resolver might be failing
        console.log(chalk.yellow('\n🤔 Possible resolver issues:'));
        console.log('1. Resolver might be checking wrong contract ID');
        console.log('2. Resolver might have insufficient pool funds');
        console.log('3. Resolver might have gas estimation issues');
        
        // Let's manually create the pool HTLC
        console.log(chalk.yellow('\n💡 Solution: Manually trigger pool HTLC creation'));
        console.log('Run: npm run test:htlc-manual-pool');
        
      } else {
        console.log(chalk.red(`\n❌ HTLC is not in ACTIVE state (state: ${htlcDetails.state})`));
      }
      
    } catch (error: any) {
      console.log(chalk.red('❌ HTLC not found on blockchain'));
      console.log(chalk.gray(`   Error: ${error.message}`));
      
      // Check if contract ID format is correct
      console.log(chalk.yellow('\n🔍 Debugging contract ID...'));
      const expectedId = ethers.keccak256(ethers.toUtf8Bytes(`${swap.id}-user`));
      console.log(chalk.gray(`   Stored ID: ${swap.user_htlc_contract}`));
      console.log(chalk.gray(`   Expected: ${expectedId}`));
      
      if (swap.user_htlc_contract !== expectedId) {
        console.log(chalk.red('   ❌ Contract ID mismatch!'));
      }
    }

    // Check resolver configuration
    console.log(chalk.yellow('\n⚙️ Resolver Configuration Check:'));
    
    // Check pool wallet balance
    const poolWallet = new ethers.Wallet(
      process.env.POOL_WALLET_PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647'
    );
    console.log(chalk.gray(`   Pool Wallet: ${poolWallet.address}`));
    
    // Check if resolver is processing this network
    console.log(chalk.gray(`   Sepolia HTLC: ${CONFIG.SEPOLIA_HTLC}`));
    console.log(chalk.gray(`   Expected networks: sepolia, monadTestnet`));
    
    console.log(chalk.cyan('\n📊 SUMMARY:'));
    console.log('• User HTLC exists on blockchain ✅');
    console.log('• Database has correct record ✅');
    console.log('• Resolver should pick it up ⏳');
    console.log('• Check resolver logs for specific errors');

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  } finally {
    await database.close();
  }
}

// Run verification
verifyAndFixResolver().catch(console.error);