#!/bin/bash

# CosmWasm HTLC Deployment Script
# Usage: ./cosmos-deploy.sh [chain-id] [rpc-url] [wallet-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_CHAIN_ID="swap-sage-1"
DEFAULT_RPC_URL="http://localhost:26657"
DEFAULT_WALLET="test-wallet"

# Parse arguments
CHAIN_ID=${1:-$DEFAULT_CHAIN_ID}
RPC_URL=${2:-$DEFAULT_RPC_URL}
WALLET_NAME=${3:-$DEFAULT_WALLET}

# Environment variables override
CHAIN_ID=${COSMOS_CHAIN_ID:-$CHAIN_ID}
RPC_URL=${COSMOS_RPC_URL:-$RPC_URL}
WALLET_NAME=${COSMOS_WALLET:-$WALLET_NAME}

echo -e "${BLUE}🚀 CosmWasm HTLC Deployment Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Chain ID: ${YELLOW}$CHAIN_ID${NC}"
echo -e "RPC URL: ${YELLOW}$RPC_URL${NC}"
echo -e "Wallet: ${YELLOW}$WALLET_NAME${NC}"
echo ""

# Check if required tools are installed
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed or not in PATH${NC}"
        echo "Please install $1 to continue"
        exit 1
    fi
}

echo -e "${BLUE}🔍 Checking required tools...${NC}"
check_tool "wasmd"
check_tool "cargo"

# Check if wasm-opt is available (optional but recommended)
if command -v wasm-opt &> /dev/null; then
    OPTIMIZE_WASM=true
    echo -e "${GREEN}✅ wasm-opt found - will optimize contract${NC}"
else
    OPTIMIZE_WASM=false
    echo -e "${YELLOW}⚠️  wasm-opt not found - skipping optimization${NC}"
fi

# Build the contract
echo -e "\n${BLUE}🔨 Building CosmWasm contract...${NC}"
cd "$(dirname "$0")/.."

# Build optimized wasm
echo "Building WASM binary..."
cargo wasm

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build WASM contract${NC}"
    exit 1
fi

WASM_FILE="target/wasm32-unknown-unknown/release/swap_sage_cosmos.wasm"

if [ ! -f "$WASM_FILE" ]; then
    echo -e "${RED}❌ WASM file not found at $WASM_FILE${NC}"
    exit 1
fi

# Optimize if wasm-opt is available
if [ "$OPTIMIZE_WASM" = true ]; then
    echo "Optimizing WASM binary..."
    wasm-opt -Oz --enable-mutable-globals "$WASM_FILE" -o "${WASM_FILE%.wasm}_optimized.wasm"
    WASM_FILE="${WASM_FILE%.wasm}_optimized.wasm"
    echo -e "${GREEN}✅ Contract optimized${NC}"
fi

echo -e "${GREEN}✅ Contract built successfully${NC}"
echo -e "WASM file: ${YELLOW}$WASM_FILE${NC}"

# Check file size
WASM_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null)
echo -e "File size: ${YELLOW}$WASM_SIZE bytes${NC}"

if [ $WASM_SIZE -gt 614400 ]; then # 600KB limit for CosmWasm
    echo -e "${YELLOW}⚠️  Warning: Contract size (${WASM_SIZE} bytes) is large. Consider optimizing.${NC}"
fi

# Check if wasmd is configured and running
echo -e "\n${BLUE}🔗 Checking network connectivity...${NC}"
NODE_STATUS=$(wasmd status --node $RPC_URL 2>/dev/null || echo "error")

if [[ "$NODE_STATUS" == "error" ]]; then
    echo -e "${YELLOW}⚠️  Cannot connect to node at $RPC_URL${NC}"
    echo "You can still store the contract using:"
    echo "wasmd tx wasm store $WASM_FILE --from $WALLET_NAME --chain-id $CHAIN_ID --node $RPC_URL --gas auto --gas-adjustment 1.3 -y"
    
    # Still try to save deployment info
    save_deployment_info "pending" "Contract built but not deployed - no network connection"
    exit 0
fi

echo -e "${GREEN}✅ Connected to network${NC}"

# Check wallet exists and has balance
echo -e "\n${BLUE}👤 Checking wallet...${NC}"
WALLET_INFO=$(wasmd keys show $WALLET_NAME --output json 2>/dev/null || echo "error")

if [[ "$WALLET_INFO" == "error" ]]; then
    echo -e "${RED}❌ Wallet '$WALLET_NAME' not found${NC}"
    echo "Create a wallet first:"
    echo "wasmd keys add $WALLET_NAME"
    exit 1
fi

WALLET_ADDRESS=$(echo $WALLET_INFO | jq -r '.address')
echo -e "Wallet address: ${YELLOW}$WALLET_ADDRESS${NC}"

# Check balance
BALANCE=$(wasmd query bank balances $WALLET_ADDRESS --node $RPC_URL --output json 2>/dev/null | jq -r '.balances[0].amount // "0"')
if [ "$BALANCE" = "0" ]; then
    echo -e "${YELLOW}⚠️  Wallet has no funds. You may need to add tokens.${NC}"
    echo "For testnet, you might be able to use a faucet."
else
    echo -e "${GREEN}✅ Wallet has balance: $BALANCE${NC}"
fi

# Store the contract
echo -e "\n${BLUE}📤 Storing contract on chain...${NC}"
STORE_RESULT=$(wasmd tx wasm store "$WASM_FILE" \
    --from $WALLET_NAME \
    --chain-id $CHAIN_ID \
    --node $RPC_URL \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    -y 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to store contract${NC}"
    echo "$STORE_RESULT"
    exit 1
fi

# Extract transaction hash
STORE_TX_HASH=$(echo $STORE_RESULT | jq -r '.txhash')
echo -e "Store transaction: ${YELLOW}$STORE_TX_HASH${NC}"

# Wait for transaction to be included
echo "Waiting for transaction to be included in block..."
sleep 6

# Get the code ID
CODE_ID=$(wasmd query tx $STORE_TX_HASH --node $RPC_URL --output json | jq -r '.events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')

if [ "$CODE_ID" = "null" ] || [ "$CODE_ID" = "" ]; then
    echo -e "${RED}❌ Failed to get code ID from transaction${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract stored with code ID: $CODE_ID${NC}"

# Instantiate the contract with minimal config
echo -e "\n${BLUE}🏗️  Instantiating contract...${NC}"

# Create instantiate message (this is a basic example)
INSTANTIATE_MSG='{
  "sender": "'$WALLET_ADDRESS'",
  "beneficiary": "'$WALLET_ADDRESS'",
  "hash_lock": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "timelock": '$(date -d "+1 hour" +%s)',
  "amount": "1000000",
  "token": null
}'

INSTANTIATE_RESULT=$(wasmd tx wasm instantiate $CODE_ID "$INSTANTIATE_MSG" \
    --from $WALLET_NAME \
    --chain-id $CHAIN_ID \
    --node $RPC_URL \
    --label "SwapSage HTLC v1.0" \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    -y 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to instantiate contract${NC}"
    echo "$INSTANTIATE_RESULT"
    save_deployment_info "$CODE_ID" "Contract stored but failed to instantiate"
    exit 1
fi

INSTANTIATE_TX_HASH=$(echo $INSTANTIATE_RESULT | jq -r '.txhash')
echo -e "Instantiate transaction: ${YELLOW}$INSTANTIATE_TX_HASH${NC}"

# Wait for transaction
sleep 6

# Get contract address
CONTRACT_ADDRESS=$(wasmd query tx $INSTANTIATE_TX_HASH --node $RPC_URL --output json | jq -r '.events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')

if [ "$CONTRACT_ADDRESS" = "null" ] || [ "$CONTRACT_ADDRESS" = "" ]; then
    echo -e "${RED}❌ Failed to get contract address${NC}"
    save_deployment_info "$CODE_ID" "Contract stored but failed to get address"
    exit 1
fi

echo -e "${GREEN}✅ Contract instantiated at: $CONTRACT_ADDRESS${NC}"

# Save deployment information
save_deployment_info() {
    local code_id=$1
    local address=${2:-$CONTRACT_ADDRESS}
    local status=${3:-"deployed"}
    
    # Create deployments directory
    mkdir -p ../deployments
    
    # Save deployment info
    cat > "../deployments/cosmos-${CHAIN_ID}.json" << EOF
{
  "chainId": "$CHAIN_ID",
  "rpcUrl": "$RPC_URL",
  "codeId": "$code_id",
  "contractAddress": "$address",
  "deployer": "$WALLET_ADDRESS",
  "deploymentTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "storeTransactionHash": "$STORE_TX_HASH",
  "instantiateTransactionHash": "$INSTANTIATE_TX_HASH",
  "status": "$status"
}
EOF

    echo -e "${GREEN}📝 Deployment info saved to ../deployments/cosmos-${CHAIN_ID}.json${NC}"
    
    # Update .env.local
    ROOT_DIR="../../.."
    ENV_FILE="$ROOT_DIR/.env.local"
    
    # Create or update .env.local
    if [ -f "$ENV_FILE" ]; then
        # Update existing file
        if grep -q "COSMOS_HTLC_ADDRESS=" "$ENV_FILE"; then
            sed -i.bak "s/COSMOS_HTLC_ADDRESS=.*/COSMOS_HTLC_ADDRESS=$address/" "$ENV_FILE"
        else
            echo "COSMOS_HTLC_ADDRESS=$address" >> "$ENV_FILE"
        fi
        
        if grep -q "COSMOS_CHAIN_ID=" "$ENV_FILE"; then
            sed -i.bak "s/COSMOS_CHAIN_ID=.*/COSMOS_CHAIN_ID=$CHAIN_ID/" "$ENV_FILE"
        else
            echo "COSMOS_CHAIN_ID=$CHAIN_ID" >> "$ENV_FILE"
        fi
        
        if grep -q "COSMOS_CODE_ID=" "$ENV_FILE"; then
            sed -i.bak "s/COSMOS_CODE_ID=.*/COSMOS_CODE_ID=$code_id/" "$ENV_FILE"
        else
            echo "COSMOS_CODE_ID=$code_id" >> "$ENV_FILE"
        fi
        
        # Clean up backup file
        rm -f "$ENV_FILE.bak"
    else
        # Create new file
        cat > "$ENV_FILE" << EOF
COSMOS_HTLC_ADDRESS=$address
COSMOS_CHAIN_ID=$CHAIN_ID
COSMOS_CODE_ID=$code_id
EOF
    fi
    
    echo -e "${GREEN}📋 Updated .env.local with contract details${NC}"
}

# Save deployment info
save_deployment_info "$CODE_ID" "$CONTRACT_ADDRESS"

echo -e "\n${GREEN}🎉 CosmWasm deployment completed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Code ID: ${YELLOW}$CODE_ID${NC}"
echo -e "Contract Address: ${YELLOW}$CONTRACT_ADDRESS${NC}"
echo -e "Chain ID: ${YELLOW}$CHAIN_ID${NC}"
echo -e "RPC URL: ${YELLOW}$RPC_URL${NC}"

echo -e "\n${BLUE}💡 Next steps:${NC}"
echo "1. Test the contract: wasmd query wasm contract-state smart $CONTRACT_ADDRESS '{\"get_swap\":{}}' --node $RPC_URL"
echo "2. Fund an HTLC: Use the contract's fund message"
echo "3. Run smoke tests: cd ../.. && pnpm test:cosmos"

echo -e "\n${GREEN}✨ Deployment complete!${NC}"