'use client';

import { CrossChainSwap } from '@/components/cross-chain-swap';

export default function CrossChainPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold">Cross-Chain Swaps</h1>
          <p className="text-lg text-muted-foreground">
            Swap tokens between Ethereum Sepolia and Monad Testnet with atomic security
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>Ethereum Sepolia</span>
            </div>
            <div className="text-muted-foreground">↔</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full" />
              <span>Monad Testnet</span>
            </div>
          </div>
        </div>

        <CrossChainSwap />

        <div className="mt-12 space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold">Lock Tokens</h3>
                <p className="text-sm text-muted-foreground">
                  Lock your tokens in a secure HTLC contract on the source chain
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-green-600">2</span>
                </div>
                <h3 className="font-semibold">Auto Resolution</h3>
                <p className="text-sm text-muted-foreground">
                  Our resolver automatically matches your swap with pool liquidity
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold">Gasless Claim</h3>
                <p className="text-sm text-muted-foreground">
                  Claim your tokens on the destination chain without needing gas
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg">
            <h3 className="font-semibold mb-3">Supported Token Pairs</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-background rounded border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    🦄
                  </div>
                  <div>
                    <div className="font-medium">MONSTER (Sepolia)</div>
                    <div className="text-sm text-muted-foreground">Ethereum Sepolia Testnet</div>
                  </div>
                </div>
                <div className="text-muted-foreground">↔</div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    🌟
                  </div>
                  <div>
                    <div className="font-medium">OMNI (Monad)</div>
                    <div className="text-sm text-muted-foreground">Monad Testnet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">🔒 Security Features</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Atomic execution - both sides complete or both fail</li>
              <li>• Hash Time Lock Contracts (HTLCs) for security</li>
              <li>• Pool-based liquidity for instant settlements</li>
              <li>• No custodial risk - you control your private keys</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}