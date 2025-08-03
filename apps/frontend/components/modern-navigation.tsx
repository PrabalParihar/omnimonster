"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useWeb3Auth } from '../lib/web3auth-context'
import { UserProfile } from '@/components/user-profile'
import { Web3AuthLogin } from '@/components/web3auth-login'
import { 
  Zap, 
  Activity, 
  BarChart3, 
  Shield, 
  MessageCircle, 
  Wallet, 
  Droplets,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Github,
  Twitter,
  Moon,
  Sun
} from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'

const navigation = [
  { name: 'Swap', href: '/', icon: Zap, description: 'Trade tokens instantly', color: 'text-blue-600 dark:text-blue-400' },
  { name: 'Faucet', href: '/faucet', icon: Droplets, description: 'Get test tokens', color: 'text-cyan-600 dark:text-cyan-400' },
  { name: 'Monitor', href: '/dashboard', icon: Activity, description: 'Real-time monitoring', color: 'text-green-600 dark:text-green-400' },
  { name: 'Pool', href: '/pool', icon: BarChart3, description: 'Liquidity management', color: 'text-purple-600 dark:text-purple-400' },
  { name: 'Health', href: '/health', icon: Shield, description: 'System status', color: 'text-orange-600 dark:text-orange-400' },
  { name: 'Claims', href: '/claims', icon: MessageCircle, description: 'Gasless claiming', color: 'text-pink-600 dark:text-pink-400' },
]

export function ModernNavigation() {
  const pathname = usePathname()
  const { isConnected, user, isLoading } = useWeb3Auth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  const actualIsConnected = isConnected
  const walletAddress = user?.email || 'Anonymous'

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (!mounted) return null

  return (
    <>
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled 
            ? "bg-background/80 backdrop-blur-lg border-b shadow-sm" 
            : "bg-transparent"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-4"
            >
              <Link href="/" className="flex items-center space-x-3 group">
                <motion.div 
                  whileHover={{ rotate: 180 }}
                  transition={{ duration: 0.3 }}
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg"
                >
                  <Sparkles className="h-6 w-6 text-white" />
                </motion.div>
                <span className="font-bold text-2xl">
                  <span className="text-gradient">Swap Sage</span>
                </span>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item, index) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative px-3 py-2 rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={cn(
                          "h-4 w-4 transition-colors",
                          isActive ? item.color : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.name}
                        </span>
                      </div>
                      
                      {/* Hover tooltip */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-popover text-popover-foreground px-3 py-1 rounded-md shadow-lg text-xs whitespace-nowrap">
                          {item.description}
                        </div>
                      </div>
                      
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"
                        />
                      )}
                    </Link>
                  </motion.div>
                )
              })}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              {/* Social Links */}
              <div className="hidden sm:flex items-center space-x-2">
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <Github className="h-5 w-5" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                    <Twitter className="h-5 w-5" />
                  </a>
                </Button>
              </div>

              {/* Status Indicator */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Live</span>
              </div>

              {/* Wallet Connection */}
              {actualIsConnected ? (
                <UserProfile compact={true} />
              ) : (
                <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                  <DialogTrigger asChild>
                    <Button
                      className="gradient-primary hidden sm:flex items-center space-x-2"
                      disabled={isLoading}
                    >
                      <Wallet className="h-4 w-4" />
                      <span>{isLoading ? 'Connecting...' : 'Connect'}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <Web3AuthLogin onClose={() => setShowLoginDialog(false)} />
                  </DialogContent>
                </Dialog>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-background border-b shadow-lg"
          >
            <div className="container mx-auto px-4 py-4">
              <div className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg transition-all',
                        isActive
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={cn(
                          "h-5 w-5",
                          isActive ? item.color : "text-muted-foreground"
                        )} />
                        <div>
                          <p className={cn(
                            "font-medium",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  )
                })}
                
                {/* Mobile Wallet Connection */}
                {!actualIsConnected && (
                  <Button
                    className="w-full gradient-primary"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      setShowLoginDialog(true)
                    }}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Wallet
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav */}
      <div className="h-16" />
    </>
  )
}