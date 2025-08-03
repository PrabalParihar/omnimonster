import dynamic from 'next/dynamic'

interface SwapStatusPageProps {
  params: {
    id: string
  }
}

const ModernSwapStatusPage = dynamic(() => import('./modern-page'), { ssr: false })

export default function SwapStatusPage({ params }: SwapStatusPageProps) {
  return <ModernSwapStatusPage params={params} />
}