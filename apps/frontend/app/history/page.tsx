import { SwapHistory } from '@/components/swap-history'

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Swap History
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            View and track your cross-chain atomic swaps
          </p>
        </div>
        
        <SwapHistory />
      </div>
    </div>
  )
} 