import { FusionResolver, ResolverConfig } from '../../../packages/shared/src/resolver';
import { FusionDatabase, getDatabaseConfig } from '../../../packages/shared/src/database';
import { evmChains } from '../../../packages/shared/src/chains';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

class ResolverService {
  private resolver: FusionResolver | null = null;
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

      console.log('\n🎉 ALL RESOLVER SERVICES STARTED!');
      console.log('═'.repeat(60));
      console.log('📊 Monitoring:');
      console.log('  • Swap queue processing every 10 seconds');
      console.log('  • Pool liquidity validation');
      console.log('  • HTLC contract interactions');
      console.log('  • Database operations tracking');
      console.log('═'.repeat(60));

      // Keep the service running
      process.on('SIGINT', () => this.gracefulShutdown());
      process.on('SIGTERM', () => this.gracefulShutdown());

    } catch (error) {
      console.error('❌ Failed to start resolver service:', error);
      process.exit(1);
    }
  }

  private async startResolverForNetwork(networkName: string, database: FusionDatabase) {
    const chainConfig = evmChains[networkName];
    if (!chainConfig) {
      console.log(`⚠️  Skipping ${networkName} - not configured`);
      return;
    }

    console.log(`\n🔗 Starting resolver for ${chainConfig.name}...`);

    const config: ResolverConfig = {
      processingInterval: 10000, // 10 seconds
      maxBatchSize: 10,
      maxRetries: 3,
      gasLimit: 500000,
      maxGasPrice: '20000000000', // 20 gwei
      htlcContractAddress: chainConfig.htlcAddress,
      poolWalletPrivateKey: process.env.POOL_MANAGER_PRIVATE_KEY!,
      rpcUrl: chainConfig.rpcUrl,
      chainId: chainConfig.chainId,
      chainName: networkName
    };

    const resolver = new FusionResolver(config, database);

    // Set up event listeners
    resolver.on('started', () => {
      console.log(`✅ Resolver started for ${chainConfig.name}`);
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
    if (!this.resolver) {
      this.resolver = resolver; // Store first resolver for graceful shutdown
    }
  }

  private async gracefulShutdown() {
    console.log('\n📤 Gracefully shutting down resolver service...');
    
    if (this.resolver) {
      await this.resolver.stop();
    }
    
    console.log('✅ Resolver service stopped');
    process.exit(0);
  }
}

// Start the service
async function main() {
  const service = new ResolverService();
  await service.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ResolverService };