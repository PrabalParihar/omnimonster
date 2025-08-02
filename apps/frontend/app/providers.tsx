"use client"

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Web3AuthProvider } from '@/lib/web3auth-context'
import { WalletProvider } from '@/lib/wallet-context'
import { ThemeProvider } from '@/components/theme-provider'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" storageKey="fusion-ui-theme">
      <QueryClientProvider client={queryClient}>
        <Web3AuthProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </Web3AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}