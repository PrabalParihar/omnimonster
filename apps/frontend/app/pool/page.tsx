import { PoolMonitor } from '../../components/pool-monitor';

export default function PoolPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <PoolMonitor />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Pool Monitor - Fusion Swap',
  description: 'Monitor pool liquidity, performance, and system health',
};