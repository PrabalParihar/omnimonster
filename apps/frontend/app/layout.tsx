import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { cn } from '@/lib/utils'
import { ModernNavigation } from '@/components/modern-navigation'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fusion Swap - Pool-Based Token Swaps with Gasless Claims',
  description: 'Trade tokens instantly with gasless claiming. Powered by HTLCs and pool liquidity for secure, efficient swaps across multiple chains.',
  keywords: ['DeFi', 'Token Swap', 'Gasless', 'HTLC', 'Pool Liquidity', 'Web3Auth', 'Multi-Chain'],
  authors: [{ name: 'Fusion Swap Team' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-background font-sans antialiased"
        )}
        suppressHydrationWarning
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <ModernNavigation />
            <main className="flex-1">
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
} 