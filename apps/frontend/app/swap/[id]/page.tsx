"use client"

import { SwapStatusTimeline } from '@/components/swap-status-timeline'

interface SwapStatusPageProps {
  params: {
    id: string
  }
}

export default function SwapStatusPage({ params }: SwapStatusPageProps) {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Swap Status
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Tracking swap ID: {params.id}
          </p>
        </div>
        
        <SwapStatusTimeline swapId={params.id} />
      </div>
    </div>
  )
}