import { GaslessClaims } from '../../components/gasless-claims'

export default function ClaimsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <GaslessClaims />
      </div>
    </main>
  )
}

export const metadata = {
  title: 'Claims - Fusion Swap',
  description: 'Claim your tokens gaslessly after pool fulfillment',
}