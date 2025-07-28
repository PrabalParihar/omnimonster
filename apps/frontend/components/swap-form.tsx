"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, Settings, Clock, Shield, Zap } from "lucide-react"

export function SwapForm() {
  const [formData, setFormData] = React.useState({
    fromChain: "sepolia",
    toChain: "polygonAmoy", 
    amount: "",
    beneficiary: "",
    timelock: "3600",
    dryRun: true
  })

  const chains = [
    { value: "sepolia", label: "Ethereum Sepolia", icon: "🔷" },
    { value: "polygonAmoy", label: "Polygon Amoy", icon: "🟣" },
    { value: "cosmosTestnet", label: "Cosmos Testnet", icon: "⚛️" }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Submitting swap:", formData)
    // TODO: Connect to API
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Swap Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your cross-chain atomic swap with precise parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Chain Selection */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Chain</label>
                <select
                  value={formData.fromChain}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromChain: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {chains.map(chain => (
                    <option key={chain.value} value={chain.value}>
                      {chain.icon} {chain.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Chain</label>
                <select
                  value={formData.toChain}
                  onChange={(e) => setFormData(prev => ({ ...prev, toChain: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {chains.filter(chain => chain.value !== formData.fromChain).map(chain => (
                    <option key={chain.value} value={chain.value}>
                      {chain.icon} {chain.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <input
                type="number"
                step="0.000001"
                placeholder="0.001"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Amount to swap from the source chain
              </p>
            </div>

            {/* Beneficiary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Beneficiary Address</label>
              <input
                type="text"
                placeholder="0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8"
                value={formData.beneficiary}
                onChange={(e) => setFormData(prev => ({ ...prev, beneficiary: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Address to receive funds on the destination chain
              </p>
            </div>

            {/* Advanced Options */}
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="flex items-center space-x-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                <span>Advanced Options</span>
              </h3>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timelock (seconds)</label>
                  <select
                    value={formData.timelock}
                    onChange={(e) => setFormData(prev => ({ ...prev, timelock: e.target.value }))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="3600">1 hour (3600s)</option>
                    <option value="7200">2 hours (7200s)</option>
                    <option value="14400">4 hours (14400s)</option>
                    <option value="86400">24 hours (86400s)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="dryRun"
                    checked={formData.dryRun}
                    onChange={(e) => setFormData(prev => ({ ...prev, dryRun: e.target.checked }))}
                    className="h-4 w-4 rounded border"
                  />
                  <label htmlFor="dryRun" className="text-sm">
                    Dry Run (Simulation)
                  </label>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={!formData.amount || !formData.beneficiary}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              {formData.dryRun ? "Simulate Swap" : "Execute Swap"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Shield className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium">Atomic Security</p>
              <p className="text-xs text-muted-foreground">Either both parties get funds or both get refunds</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Time Locked</p>
              <p className="text-xs text-muted-foreground">Automatic refund if swap expires</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center space-x-3 p-4">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">No Fees</p>
              <p className="text-xs text-muted-foreground">Only blockchain gas costs</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 