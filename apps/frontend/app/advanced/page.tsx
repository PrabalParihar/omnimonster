import { SwapForm } from '@/components/swap-form'

export default function AdvancedPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Advanced Swap
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Professional form interface for precise control
          </p>
        </div>
        
        <SwapForm />
      </div>
    </div>
  )
} 