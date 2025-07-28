import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { Navigation } from '@/components/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Swap Sage - Cross-Chain Atomic Swaps',
  description: 'Trustless cross-chain atomic swaps powered by HTLCs',
  keywords: ['DeFi', 'Cross-chain', 'Atomic Swaps', 'HTLC', 'Blockchain'],
  authors: [{ name: 'Swap Sage Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className={cn(
          inter.className,
          "min-h-screen bg-background font-sans antialiased"
        )}
        suppressHydrationWarning
      >
        <div className="relative flex min-h-screen flex-col">
          <Navigation />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
} 