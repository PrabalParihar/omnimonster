import { FusionResolver, ResolverConfig } from '../packages/shared/src/resolver';
import { FusionDatabase, getDatabaseConfig } from '../packages/shared/src/database';
import { evmChains } from '../packages/shared/src/chains';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function startResolver() {
  console.log('\n🚀 STARTING FUSION RESOLVER (Direct Test)\n');

  try {
    // Initialize database
    const dbConfig = getDatabaseConfig();
    const database = FusionDatabase.getInstance(dbConfig);
    console.log('✅ Database connected');

    // Test database connection
    const result = await database.query('SELECT NOW() as time');
    console.log('✅ Database test query successful:', result.rows[0].time);

    // Start resolver for Sepolia
    const chainConfig = evmChains.sepolia;
    console.log(`🔗 Starting resolver for ${chainConfig.name}...`);

    const config: ResolverConfig = {
      processingInterval: 5000, // 5 seconds for testing
      maxBatchSize: 5,
      maxRetries: 3,
      gasLimit: 500000,
      maxGasPrice: '20000000000', // 20 gwei
      htlcContractAddress: chainConfig.htlcAddress,
      poolWalletPrivateKey: process.env.POOL_MANAGER_PRIVATE_KEY!,
      rpcUrl: chainConfig.rpcUrl,
      chainId: chainConfig.chainId
    };

    console.log('📋 Resolver config:', {
      network: chainConfig.name,
      chainId: config.chainId,
      htlcAddress: config.htlcContractAddress,
      interval: config.processingInterval + 'ms'
    });

    const resolver = new FusionResolver(config, database);

    // Set up event listeners
    resolver.on('started', () => {
      console.log('✅ Resolver started successfully!');
    });

    resolver.on('swapProcessed', (swapId: string) => {
      console.log(`🔄 Swap processed: ${swapId}`);
    });

    resolver.on('error', (error: Error) => {
      console.error('❌ Resolver error:', error.message);
    });

    resolver.on('poolLiquidityLow', (tokenAddress: string) => {
      console.warn(`⚠️  Low liquidity: ${tokenAddress}`);
    });

    // Start the resolver
    console.log('🚀 Starting resolver...');
    await resolver.start();

    console.log('\n🎉 RESOLVER IS NOW RUNNING!');
    console.log('━'.repeat(50));
    console.log('Monitor status: curl http://localhost:3001/api/fusion/resolver/status');
    console.log('Press Ctrl+C to stop');
    console.log('━'.repeat(50));

    // Keep running
    process.on('SIGINT', async () => {
      console.log('\n📤 Shutting down resolver...');
      await resolver.stop();
      console.log('✅ Resolver stopped');
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {
      console.log(`⏰ Resolver running... (${new Date().toLocaleTimeString()})`);
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to start resolver:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  startResolver();
}