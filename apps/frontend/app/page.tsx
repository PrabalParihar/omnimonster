import { UpdatedSwapForm } from '../components/updated-swap-form'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Fusion Swap
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              Trade tokens instantly with gasless claiming. Powered by HTLCs and pool liquidity for secure, 
              efficient swaps across multiple chains.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                ⚡ Gasless Claims
              </span>
              <span className="flex items-center gap-1">
                🔒 HTLC Security
              </span>
              <span className="flex items-center gap-1">
                🌐 Multi-Chain
              </span>
              <span className="flex items-center gap-1">
                🏊 Pool Liquidity
              </span>
            </div>
          </div>

          {/* Swap Interface */}
          <div className="flex justify-center">
            <UpdatedSwapForm />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                ⚡
              </div>
              <h3 className="font-semibold mb-2 dark:text-white">Gasless Claims</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Claim your tokens without paying gas fees. Our relayer covers the costs for you.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                🔒
              </div>
              <h3 className="font-semibold mb-2 dark:text-white">HTLC Security</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Hash Time Locked Contracts ensure your funds are always secure during swaps.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                🏊
              </div>
              <h3 className="font-semibold mb-2 dark:text-white">Pool Liquidity</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Instant fulfillment through our dedicated liquidity pools across all supported chains.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 