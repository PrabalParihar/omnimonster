"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRightLeft, MessageCircle, Settings, History, Zap } from "lucide-react"

const navigation = [
  {
    name: "Chat Mode",
    href: "/swap",
    icon: MessageCircle,
    description: "Natural language swaps"
  },
  {
    name: "Advanced",
    href: "/advanced", 
    icon: Settings,
    description: "Pro form interface"
  },
  {
    name: "History",
    href: "/history",
    icon: History,
    description: "Past transactions"
  }
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Link 
            href="/swap" 
            className="flex items-center space-x-2 transition-colors hover:text-primary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Swap Sage
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex items-center space-x-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href === "/swap" && pathname === "/")
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                    isActive && "bg-accent text-accent-foreground shadow-sm"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline-block">{item.name}</span>
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="hidden sm:inline-block">API Ready</span>
          </div>
        </div>
      </div>
    </header>
  )
} 