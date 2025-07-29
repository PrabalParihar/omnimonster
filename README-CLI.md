# Cross-Chain Swap CLI

A command-line interface for performing atomic swaps between EVM chains (Sepolia, Polygon Amoy) and Cosmos testnets using Hash Time Locked Contracts (HTLCs).

## Features

- ✅ **Cross-chain atomic swaps** between EVM chains (Sepolia, Polygon Amoy) and Cosmos testnets
- ✅ **EVM-to-EVM swaps** between Sepolia and Polygon Amoy testnets
- ✅ **Interactive CLI** with prompts and validation
- ✅ **Real-time transaction monitoring** with detailed feedback
- ✅ **Dry-run mode** for testing without executing transactions
- ✅ **Error handling and validation** for addresses, keys, and amounts
- ✅ **Status checking** for existing HTLCs
- ✅ **Manual claim/refund** operations

## Prerequisites

1. **Node.js** (v18+ recommended)
2. **pnpm** package manager
3. **Private key** for EVM Sepolia transactions
4. **Mnemonic** for Cosmos testnet transactions
5. **Deployed HTLC contracts** on both chains

### Environment Setup

Before using the CLI, ensure you have:

1. **EVM Sepolia Setup**:
   - Set `SEPOLIA_HTLC_ADDRESS` environment variable
   - Have ETH in your Sepolia wallet for gas fees
   - Valid private key (0x followed by 64 hex characters)

2. **Cosmos Testnet Setup**:
   - Have native tokens for gas fees
   - Valid 12 or 24-word mnemonic phrase
   - Access to Cosmos Hub testnet RPC

## Installation

```bash
# Install dependencies
pnpm install

# Make the CLI executable
chmod +x cli-swap.ts
```

## Usage

### Interactive Swap

Start an interactive cross-chain swap:

```bash
pnpm cli:swap swap
```

The CLI will prompt you for:
- Source chain (sepolia or cosmosTestnet)
- Destination chain (sepolia or cosmosTestnet)
- Amount to swap
- Beneficiary address
- Private key (for EVM) or mnemonic (for Cosmos)
- Dry-run option

### Command Line Arguments

You can also provide arguments directly:

```bash
pnpm cli:swap swap \
  --src-chain sepolia \
  --dst-chain cosmosTestnet \
  --amount 0.1 \
  --beneficiary cosmos1abcdef... \
  --private-key 0x1234... \
  --mnemonic "word1 word2 ..." \
  --timelock 3600
```

### Options

- `-s, --src-chain <chain>`: Source chain (sepolia|cosmosTestnet)
- `-d, --dst-chain <chain>`: Destination chain (sepolia|cosmosTestnet)
- `-a, --amount <amount>`: Amount to swap
- `-b, --beneficiary <address>`: Beneficiary address on destination chain
- `-t, --timelock <seconds>`: Timelock duration in seconds (default: 3600)
- `-k, --private-key <key>`: Private key for EVM transactions
- `-m, --mnemonic <words>`: Mnemonic for Cosmos transactions
- `-r, --rpc-url <url>`: Custom RPC URL
- `--dry-run`: Simulate the swap without executing transactions

### Check HTLC Status

Check the status of an existing HTLC:

```bash
pnpm cli:swap status <htlc-id> --chain sepolia
```

### Manual Claim

Claim funds from an HTLC if you have the preimage:

```bash
pnpm cli:swap claim <htlc-id> <preimage> --chain sepolia --private-key 0x...
```

### Manual Refund

Refund expired HTLC funds:

```bash
pnpm cli:swap refund <htlc-id> --chain sepolia --private-key 0x...
```

## Swap Process

The CLI performs a complete atomic swap in the following steps:

1. **Generate Parameters**: Creates preimage, hashlock, timelock, and HTLC IDs
2. **Initialize Clients**: Connects to both blockchain networks
3. **Create Source HTLC**: Locks funds on the source chain
4. **Create Destination HTLC**: Locks funds on the destination chain
5. **Claim Destination**: Claims funds using the preimage
6. **Claim Source**: Claims the original funds, completing the swap

## Example Usage

### Sepolia to Cosmos Testnet

```bash
pnpm cli:swap swap \
  --src-chain sepolia \
  --dst-chain cosmosTestnet \
  --amount 0.1 \
  --beneficiary cosmos1recipient... \
  --private-key 0xYourSepoliaPrivateKey... \
  --mnemonic "your twelve word cosmos mnemonic phrase here..."
```

### Cosmos Testnet to Sepolia

```bash
pnpm cli:swap swap \
  --src-chain cosmosTestnet \
  --dst-chain sepolia \
  --amount 1.0 \
  --beneficiary 0xRecipientEthereumAddress... \
  --mnemonic "your cosmos mnemonic phrase..." \
  --private-key 0xYourSepoliaPrivateKey...
```

### EVM-to-EVM: Sepolia to Polygon Amoy

```bash
pnpm cli:swap swap \
  --src-chain sepolia \
  --dst-chain polygonAmoy \
  --amount 0.01 \
  --beneficiary 0xRecipientPolygonAddress... \
  --private-key 0xYourPrivateKey...
```

### EVM-to-EVM: Polygon Amoy to Sepolia

```bash
pnpm cli:swap swap \
  --src-chain polygonAmoy \
  --dst-chain sepolia \
  --amount 0.1 \
  --beneficiary 0xRecipientSepoliaAddress... \
  --private-key 0xYourPrivateKey...
```

## Error Handling

The CLI includes comprehensive error handling for:

- **Invalid addresses**: Validates EVM and Cosmos address formats
- **Invalid keys/mnemonics**: Checks private key and mnemonic formats
- **Network connectivity**: Handles RPC connection failures
- **Transaction failures**: Provides detailed error messages
- **Contract validation**: Verifies HTLC contract deployment
- **Insufficient funds**: Checks for adequate gas and token balances

## Security Considerations

1. **Private Keys**: Never share or commit private keys to version control
2. **Mnemonics**: Store mnemonic phrases securely and privately
3. **Dry Run**: Always test with `--dry-run` first on mainnet
4. **Timelock**: Choose appropriate timelock durations (recommended: 1+ hours)
5. **Verification**: Always verify addresses and amounts before confirming

## Troubleshooting

### Common Issues

1. **"SEPOLIA_HTLC_ADDRESS environment variable is required"**
   - Deploy the HTLC contract to Sepolia first
   - Set the environment variable: `export SEPOLIA_HTLC_ADDRESS=0x...`

2. **"Invalid private key format"**
   - Ensure private key starts with `0x` and is 66 characters total
   - Example: `0x1234567890abcdef...` (64 hex chars after 0x)

3. **"Invalid mnemonic format"**
   - Use exactly 12 or 24 words separated by spaces
   - Ensure words are from the BIP39 wordlist

4. **"Transaction failed or was reverted"**
   - Check if you have sufficient gas fees
   - Verify the HTLC contract is properly deployed
   - Ensure the timelock hasn't expired

5. **"HTLC is not claimable"**
   - Check if the HTLC has already been claimed or refunded
   - Verify the timelock hasn't expired
   - Ensure you're using the correct preimage

### Network Configuration

If you encounter RPC connection issues, you can specify custom URLs:

```bash
# Custom Sepolia RPC
export SEPOLIA_RPC_URL="https://your-sepolia-rpc-url"

# Custom Cosmos RPC  
export COSMOS_TESTNET_RPC_URL="https://your-cosmos-rpc-url"
```

## Development

### Adding New Chains

To add support for new chains:

1. Update `packages/shared/src/chains.ts` with new chain configuration
2. Implement client support in the respective client files
3. Add validation logic in the CLI script
4. Update the command options and help text

### Testing

Run the existing test suite:

```bash
# Run all tests
pnpm test

# Run HTLC-specific tests
pnpm test:htlc

# Run smoke tests
pnpm smoke:htlc
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the error messages for specific guidance
3. Ensure all prerequisites are met
4. Test with `--dry-run` mode first

## License

This project is part of the Swap Sage cross-chain dApp suite.