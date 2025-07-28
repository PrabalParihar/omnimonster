#!/bin/bash

# Quick Test Setup for Real Atomic Swap
# =====================================

echo "🧪 Real Atomic Swap Test Setup"
echo "=============================="

# Test wallets (use these for testing)
PARTY_A_KEY="e736d47829f72409da6cd0eb8e7127cdd8195c455c4e5c39b532de58a59f2647"
PARTY_A_ADDRESS="0x2BCc053BB6915F28aC2041855D2292dDca406903"

# Generate a test private key for Party B (simple method)
PARTY_B_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
PARTY_B_ADDRESS="0x8ba1f109551bD432803012645Hac341c9c44F0E8"  # Example address

echo "👤 Party A (Initiator):"
echo "   Address: $PARTY_A_ADDRESS"
echo "   Private Key: $PARTY_A_KEY"
echo ""

echo "👤 Party B (Counterparty) - TEST WALLET:"
echo "   Address: $PARTY_B_ADDRESS" 
echo "   Private Key: $PARTY_B_KEY"
echo ""

echo "💰 Fund both wallets with testnet tokens:"
echo "   🔗 Sepolia ETH: https://sepoliafaucet.com/"
echo "   🔗 Polygon Amoy MATIC: https://faucet.polygon.technology/"
echo ""

echo "🚀 Test Commands:"
echo "==================="
echo ""

echo "1️⃣ Party A initiates swap:"
echo "npx tsx real-atomic-swap.ts initiate \\"
echo "  --source-chain sepolia \\"
echo "  --dest-chain polygonAmoy \\"
echo "  --send-amount 0.01 \\"
echo "  --receive-amount 1 \\"
echo "  --counterparty $PARTY_B_ADDRESS \\"
echo "  --private-key $PARTY_A_KEY"
echo ""

echo "2️⃣ Copy the Swap ID from step 1, then Party B joins:"
echo "npx tsx real-atomic-swap.ts join <SWAP_ID> \\"
echo "  --private-key $PARTY_B_KEY"
echo ""

echo "3️⃣ Party A completes the swap:"
echo "npx tsx real-atomic-swap.ts complete <SWAP_ID>"
echo ""

echo "4️⃣ Party B claims their funds:"
echo "npx tsx real-atomic-swap.ts claim <SWAP_ID>"
echo ""

echo "🔍 Check status anytime:"
echo "npx tsx real-atomic-swap.ts status <SWAP_ID>"
echo ""

echo "📋 List all swaps:"
echo "npx tsx real-atomic-swap.ts list"
echo ""

echo "⚠️  IMPORTANT: This is for testing only!"
echo "   In production, never share private keys and use separate machines/wallets."

# Ask if user wants to run the first step
echo ""
read -p "🚀 Do you want to initiate a test swap now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Starting Party A initiation..."
    npx tsx real-atomic-swap.ts initiate \
      --source-chain sepolia \
      --dest-chain polygonAmoy \
      --send-amount 0.01 \
      --receive-amount 1 \
      --counterparty $PARTY_B_ADDRESS \
      --private-key $PARTY_A_KEY
fi