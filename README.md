# Swap Sage

A full-stack cross-chain swap dApp built with Turborepo.

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `apps/web`: Next.js 14 app with App Router, Tailwind CSS, and shadcn/ui
- `packages/orchestrator`: TypeScript service for cross-chain swap orchestration
- `contracts/evm`: Ethereum/EVM smart contracts using Hardhat
- `contracts/cosmos`: CosmWasm smart contracts for Cosmos ecosystem

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/) (except Cosmos contracts which use Rust).

### Utilities

- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Turborepo](https://turbo.build/repo) for monorepo management

## Build

To build all apps and packages, run the following command:

```bash
pnpm build
```

## Develop

To develop all apps and packages, run the following command:

```bash
pnpm dev
```

## Quick Deploy & Testing

### Prerequisites

Before deploying, ensure you have:

- **For EVM contracts**: Node.js 18+, pnpm, and optionally Anvil for local testing
- **For CosmWasm contracts**: Rust, cargo, wasmd CLI, and optionally wasm-opt for optimization

### Environment Setup

1. **Copy the environment template:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Configure your environment variables:**
   - Add your private key for EVM deployments
   - Set RPC URLs for your target networks
   - Configure wallet details for Cosmos deployments

### EVM Deployment

#### Local Development (Hardhat Network)
```bash
# Compile contracts
pnpm compile:evm

# Deploy to local Hardhat network
pnpm deploy:evm
```

#### Testnet Deployment
```bash
# Deploy to Sepolia (requires SEPOLIA_RPC_URL and PRIVATE_KEY)
cd contracts/evm && pnpm deploy:sepolia

# Deploy to Goerli (requires GOERLI_RPC_URL and PRIVATE_KEY)
cd contracts/evm && pnpm deploy:goerli
```

### CosmWasm Deployment

#### Local Deployment (requires wasmd)
```bash
# Compile contract
pnpm compile:cosmos

# Deploy to local wasmd (default chain-id: swap-sage-1)
pnpm deploy:cosmos
```

#### Testnet Deployment
```bash
# Deploy to Osmosis testnet
COSMOS_CHAIN_ID=osmo-test-5 COSMOS_RPC_URL=https://rpc.osmotest5.osmosis.zone pnpm deploy:cosmos
```

### Testing

#### Run All Tests
```bash
# Run complete test suite
pnpm test:htlc
```

#### Individual Test Suites
```bash
# Test EVM contracts only
pnpm test:evm

# Test CosmWasm contracts only
pnpm test:cosmos
```

### Faucets for Testnet Tokens

#### Ethereum Testnets
- **Sepolia**: [https://sepoliafaucet.com](https://sepoliafaucet.com)
- **Goerli**: [https://goerlifaucet.com](https://goerlifaucet.com)

#### Cosmos Testnets
- **Osmosis Testnet**: [https://faucet.osmotest5.osmosis.zone](https://faucet.osmotest5.osmosis.zone)
- **Cosmos Hub Testnet**: Contact in Discord for testnet tokens

### Verification

After deployment, verify your contracts are working:

1. **Check deployment files:**
   ```bash
   # EVM deployments
   ls contracts/evm/deployments/

   # CosmWasm deployments  
   ls contracts/cosmos/deployments/
   ```

2. **Verify environment variables:**
   ```bash
   # Should show deployed contract addresses
   cat .env.local | grep HTLC_ADDRESS
   ```

3. **Run smoke tests:**
   ```bash
   pnpm test:htlc
   ```

### Common Issues

#### EVM Deployment Issues
- **"insufficient funds"**: Add ETH to your wallet via faucets
- **"nonce too high"**: Clear your transaction history or use `--reset` flag
- **"network connection"**: Verify RPC URL is correct and accessible

#### CosmWasm Deployment Issues  
- **"wasmd not found"**: Install wasmd CLI: `go install github.com/CosmWasm/wasmd/cmd/wasmd@latest`
- **"wallet not found"**: Create wallet: `wasmd keys add test-wallet`
- **"insufficient gas"**: Increase gas limit in deployment script

#### Test Failures
- **"contract not deployed"**: Run deployment scripts first
- **"timeout"**: Increase test timeout or check network connectivity
- **"address mismatch"**: Verify contract addresses in .env.local match deployments

## Remote Caching

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup), then enter the following commands:

```bash
pnpx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```bash
pnpx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
- [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)