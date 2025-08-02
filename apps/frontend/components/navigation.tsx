"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useWeb3Auth } from '../lib/web3auth-context'
import { UserProfile } from '@/components/user-profile'
import { Web3AuthLogin } from '@/components/web3auth-login'
import { MessageCircle, Settings, History, Wallet, ChevronDown, Zap, BarChart3, Users, Activity, Shield } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import * as React from 'react'

const navigation = [
  { name: 'Swap', href: '/', icon: Zap, description: 'Trade tokens instantly' },
  { name: 'Monitor', href: '/dashboard', icon: Activity, description: 'Real-time swap monitoring' },
  { name: 'Pool', href: '/pool', icon: BarChart3, description: 'Pool liquidity management' },
  { name: 'Health', href: '/health', icon: Shield, description: 'System health checks' },
  { name: 'Claims', href: '/claims', icon: MessageCircle, description: 'Gasless token claiming' },
]

export function Navigation() {
  const pathname = usePathname()
  const { isConnected, user, isLoading } = useWeb3Auth()
  
  // Use the custom context directly
  const actualIsConnected = isConnected
  const walletAddress = user?.email || 'Anonymous'
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Debug navigation state
  React.useEffect(() => {
    console.log('Navigation Component State:', {
      user,
      isConnected,
      actualIsConnected,
      walletAddress,
      isLoading,
      userType: typeof user,
      timestamp: new Date().toISOString()
    });
  }, [user, isConnected, walletAddress, isLoading])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getConnectionStatus = () => {
    if (isConnected && walletAddress) {
      return { 
        text: formatAddress(walletAddress), 
        color: 'bg-green-500',
        fullText: walletAddress
      }
    }
    return { text: 'Connect Wallet', color: 'bg-gray-500', fullText: '' }
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
                <span className="text-lg font-bold text-primary-foreground">🔄</span>
              </div>
              <span className="font-bold text-xl">Fusion Swap</span>
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

          {/* User Connection */}
          <div className="flex items-center space-x-4">
            {/* API Status */}
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">API Ready</span>
            </div>

            {/* User Authentication */}
            {actualIsConnected ? (
              <UserProfile compact={true} />
            ) : (
              <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    className="flex items-center space-x-2"
                    disabled={isLoading}
                  >
                    <Wallet className="h-4 w-4" />
                    <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <Web3AuthLogin onClose={() => setShowLoginDialog(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 