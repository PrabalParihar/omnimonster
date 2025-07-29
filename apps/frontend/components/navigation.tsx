"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WalletDrawer } from '@/components/wallet-drawer'
import { useWallet } from '@/lib/wallet-context'
import { MessageCircle, Settings, History, Wallet, ChevronDown } from 'lucide-react'

const navigation = [
  { name: 'Chat Mode', href: '/swap', icon: MessageCircle },
  { name: 'Advanced', href: '/advanced', icon: Settings },
  { name: 'History', href: '/history', icon: History },
]

export function Navigation() {
  const pathname = usePathname()
  const wallet = useWallet()

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getConnectionStatus = () => {
    if (wallet.evmConnected && wallet.cosmosConnected) {
      return { text: 'All Connected', color: 'bg-green-500' }
    } else if (wallet.evmConnected) {
      return { text: `EVM: ${formatAddress(wallet.evmAddress!)}`, color: 'bg-blue-500' }
    } else if (wallet.cosmosConnected) {
      return { text: `Cosmos: ${formatAddress(wallet.cosmosAddress!)}`, color: 'bg-purple-500' }
    }
    return { text: 'Connect Wallet', color: 'bg-gray-500' }
  }

  const connectionStatus = getConnectionStatus()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">⚡</span>
              </div>
              <span className="font-bold text-xl">Swap Sage</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary',
                    isActive
                      ? 'text-primary border-b-2 border-primary pb-1'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            {/* API Status */}
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">API Ready</span>
            </div>

            {/* Wallet Button */}
            <WalletDrawer>
              <Button
                variant={wallet.evmConnected || wallet.cosmosConnected ? "outline" : "default"}
                className="flex items-center space-x-2"
              >
                <Wallet className="h-4 w-4" />
                <span>{connectionStatus.text}</span>
                {(wallet.evmConnected || wallet.cosmosConnected) && (
                  <>
                    <div className={cn("h-2 w-2 rounded-full", connectionStatus.color)} />
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Button>
            </WalletDrawer>
          </div>
        </div>
      </div>
    </nav>
  )
} 