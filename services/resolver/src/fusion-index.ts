import { FusionResolver, ResolverConfig } from '../../../packages/shared/src/resolver/fusion-resolver';
import { FusionDatabase, getDatabaseConfig } from '../../../packages/shared/src/database';
import { evmChains } from '../../../packages/shared/src/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

class FusionResolverService {
  private resolvers: FusionResolver[] = [];
  private networks: string[] = ['sepolia', 'monadTestnet'];

  async start() {
    console.log('\n🚀 FUSION RESOLVER SERVICE STARTING...\n');
    console.log('═'.repeat(60));
    
    try {
      // Initialize database
      const dbConfig = getDatabaseConfig();
      const database = FusionDatabase.getInstance(dbConfig);
      console.log('✅ Database connected');

      // Start resolver for each network
      for (const networkName of this.networks) {
        await this.startResolverForNetwork(networkName, database);
      }

      console.log('\n🎉 ALL FUSION RESOLVER SERVICES STARTED!');
      console.log('═'.repeat(60));
      console.log('📊 Monitoring:');
      console.log('  • Swap queue processing every 10 seconds');
      console.log('  • Pool liquidity validation');
      console.log('  • HTLC contract interactions (FusionHTLC & SimpleHTLC)');
      console.log('  • Database operations tracking');
      console.log('═'.repeat(60));

      // Keep the service running
      process.on('SIGINT', () => this.gracefulShutdown());
      process.on('SIGTERM', () => this.gracefulShutdown());

    } catch (error) {
      console.error('❌ Failed to start fusion resolver service:', error);
      process.exit(1);
    }
  }

  private async startResolverForNetwork(networkName: string, database: FusionDatabase) {
    const chainConfig = evmChains[networkName];
    if (!chainConfig) {
      console.log(`⚠️  Skipping ${networkName} - not configured`);
      return;
    }

    console.log(`\n🔗 Starting fusion resolver for ${chainConfig.name}...`);

    const config: ResolverConfig = {
      processingInterval: 10000, // 10 seconds
      maxBatchSize: 10,
      maxRetries: 3,
      gasLimit: 300000,
      maxGasPrice: networkName === 'monadTestnet' ? '100000000000' : '20000000000',
      htlcContractAddress: chainConfig.htlcAddress,
      poolWalletPrivateKey: process.env.POOL_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || 'e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647',
      rpcUrl: chainConfig.rpcUrl,
      chainId: chainConfig.chainId,
      chainName: networkName
    };

    const resolver = new FusionResolver(config, database);

    // Set up event listeners
    resolver.on('started', () => {
      console.log(`✅ Fusion resolver started for ${chainConfig.name}`);
    });

    resolver.on('swapProcessed', (swapId: string) => {
      console.log(`✅ Swap processed: ${swapId} on ${chainConfig.name}`);
    });

    resolver.on('error', (error: Error) => {
      console.error(`❌ Resolver error on ${chainConfig.name}:`, error.message);
    });

    resolver.on('poolLiquidityLow', (tokenAddress: string) => {
      console.warn(`⚠️  Low liquidity warning for ${tokenAddress} on ${chainConfig.name}`);
    });

    // Start the resolver
    await resolver.start();
    
    // Store reference for shutdown
    this.resolvers.push(resolver);
  }

  private async gracefulShutdown() {
    console.log('\n📤 Gracefully shutting down fusion resolver service...');
    
    // Stop all resolvers
    await Promise.all(this.resolvers.map(resolver => resolver.stop()));
    
    console.log('✅ Fusion resolver service stopped');
    process.exit(0);
  }
}

// Start the service
async function main() {
  const service = new FusionResolverService();
  await service.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { FusionResolverService };