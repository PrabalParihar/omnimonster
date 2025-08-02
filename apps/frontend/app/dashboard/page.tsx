import { SwapMonitor } from '../../components/swap-monitor'

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SwapMonitor />
    </main>
  )
}

export const metadata = {
  title: 'Swap Monitor - Fusion Swap',
  description: 'Real-time monitoring of swap activities and system performance',
}