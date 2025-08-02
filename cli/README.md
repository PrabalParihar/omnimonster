# Fusion CLI - Backend Testing Tool

A comprehensive command-line interface for testing and managing the Fusion Swap backend architecture.

## Overview

This CLI tool provides complete testing coverage for the Fusion Swap ecosystem, including:

- **System Health Checks** - Verify all components are operational
- **End-to-End Swap Testing** - Test complete swap flows from creation to claim
- **Pool Management** - Monitor and manage liquidity pools
- **Contract Interaction** - Deploy, verify, and interact with smart contracts
- **Database Operations** - Manage database schema, queries, and maintenance
- **Real-time Monitoring** - Monitor system components in real-time
- **Load Testing** - Performance testing and benchmarking

## Installation

```bash
cd cli
npm install
```

## Configuration

Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fusion_swap
DB_USER=postgres
DB_PASSWORD=your_password

# Network RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
MONAD_RPC_URL=https://testnet1.monad.xyz

# Contract Addresses
SEPOLIA_HTLC_CONTRACT=0x...
SEPOLIA_FUSION_HTLC_CONTRACT=0x...
SEPOLIA_GAS_RELAYER_CONTRACT=0x...

# Test Wallet
TEST_WALLET_PRIVATE_KEY=0x...
# OR
TEST_WALLET_MNEMONIC=your twelve word mnemonic phrase here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Usage

### Health Checks

Check the health of all system components:

```bash
npm start health --network sepolia --verbose
```

Options:
- `--network <name>` - Target network (sepolia, polygonAmoy, monadTestnet)
- `--verbose` - Detailed output
- `--skip-contracts` - Skip contract health checks
- `--skip-db` - Skip database health checks  
- `--skip-api` - Skip API health checks

### Swap Testing

Run end-to-end swap tests:

```bash
# Interactive swap test
npm start swap test --network sepolia

# Automated swap test
npm start swap test --from USDC --to USDT --amount 10

# Load testing
npm start swap load-test --count 10 --concurrent 3

# Monitor active swaps
npm start swap monitor --refresh 10
```

### Pool Management

Manage liquidity pools:

```bash
# Check pool status
npm start pool status --network sepolia --detailed

# Add liquidity
npm start pool add --token 0x... --amount 1000

# Remove liquidity  
npm start pool remove --token 0x... --amount 500

# Rebalance pool
npm start pool rebalance --auto

# Monitor pool activity
npm start pool monitor --alerts
```

### Contract Operations

Interact with smart contracts:

```bash
# Deploy contracts
npm start contract deploy --contract FusionHTLC --verify

# Get contract info
npm start contract info --contract htlc

# Call contract function
npm start contract call --contract htlc --function getDetails --params '["0x123"]' --read-only

# Monitor contract events
npm start contract events --contract htlc --live
```

### Database Management

Manage the database:

```bash
# Initialize database
npm start db init --seed

# Check database status
npm start db status --detailed

# Execute queries
npm start db query --query "SELECT * FROM swap_requests LIMIT 10"

# Create backup
npm start db backup --output backup.sql --compress

# Clean up old data
npm start db cleanup --older-than 30
```

## Command Reference

### Global Options

- `--network <network>` - Target network (sepolia, polygonAmoy, monadTestnet)
- `--verbose` - Enable verbose logging
- `--help` - Show help for any command

### Health Command

```bash
fusion-test health [options]
```

Checks the health of all Fusion Swap backend systems including:
- Configuration validation
- Database connectivity
- API endpoint availability  
- Smart contract deployment status
- Backend service health

### Swap Command

```bash
fusion-test swap <subcommand> [options]
```

Subcommands:
- `test` - Run end-to-end swap test
- `load-test` - Run multiple concurrent swap tests
- `monitor` - Monitor active swaps in real-time
- `cleanup` - Clean up expired or failed swaps

### Pool Command

```bash
fusion-test pool <subcommand> [options]
```

Subcommands:
- `status` - Check current pool status and liquidity
- `add` - Add liquidity to the pool
- `remove` - Remove liquidity from the pool
- `rebalance` - Rebalance pool liquidity
- `monitor` - Monitor pool activity in real-time

### Contract Command

```bash
fusion-test contract <subcommand> [options]
```

Subcommands:
- `deploy` - Deploy smart contracts
- `verify` - Verify deployed contracts
- `call` - Call contract functions
- `info` - Get contract information
- `events` - Monitor contract events

### Database Command

```bash
fusion-test db <subcommand> [options]
```

Subcommands:
- `init` - Initialize database schema
- `status` - Check database status and statistics
- `query` - Execute SQL queries
- `backup` - Create database backup
- `restore` - Restore database from backup
- `cleanup` - Clean up old data and optimize database
- `monitor` - Monitor database activity in real-time

## Architecture

The CLI is built with:

- **Commander.js** - Command-line interface framework
- **Ethers.js** - Ethereum interaction
- **Axios** - HTTP client for API calls
- **TypeScript** - Type safety and better development experience

### Project Structure

```
cli/
├── commands/           # Command implementations
│   ├── health.ts      # Health check commands
│   ├── swap.ts        # Swap testing commands
│   ├── pool.ts        # Pool management commands  
│   ├── contract.ts    # Contract interaction commands
│   └── database.ts    # Database management commands
├── services/          # Core service implementations
│   ├── health-checker.ts
│   ├── swap-tester.ts
│   ├── pool-manager.ts
│   ├── contract-manager.ts
│   └── database-manager.ts
├── config/            # Configuration management
│   └── config.ts
├── utils/             # Utility functions
│   ├── logger.ts      # Logging utilities
│   └── spinner.ts     # Loading spinners
└── fusion-test.ts     # Main CLI entry point
```

## Contributing

1. Add new commands in the `commands/` directory
2. Implement corresponding services in `services/`
3. Update configuration in `config/config.ts` as needed
4. Add tests for new functionality
5. Update documentation

## Testing

The CLI includes comprehensive testing capabilities:

- **Unit Tests** - Test individual components
- **Integration Tests** - Test component interactions  
- **End-to-End Tests** - Test complete user flows
- **Load Tests** - Test system performance under load

Run tests with:

```bash
npm test
```

## Support

For issues and questions:

1. Check the troubleshooting section in this README
2. Review command help with `--help` flag
3. Check system health with `fusion-test health`
4. Review logs for detailed error information