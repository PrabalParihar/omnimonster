"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft, CheckCircle, AlertCircle, Clock, Shield } from "lucide-react"

interface ParsedSwapIntent {
  fromChain: string
  toChain: string
  amount: string
  beneficiary: string
  timelock?: number
  slippage?: number
  dryRun?: boolean
  confidence?: number
  warnings?: string[]
}

interface SwapPreviewCardProps {
  intent: ParsedSwapIntent
  onProceed: () => void
  onCancel: () => void
  loading?: boolean
}

const chains = {
  sepolia: { name: "Ethereum Sepolia", icon: "🔷" },
  polygonAmoy: { name: "Polygon Amoy", icon: "🟣" },
  cosmosTestnet: { name: "Cosmos Testnet", icon: "⚛️" }
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20
    }
  }
}

export function SwapPreviewCard({ intent, onProceed, onCancel, loading = false }: SwapPreviewCardProps) {
  const confidenceColor = intent.confidence && intent.confidence > 0.8 ? 'bg-green-500' : 
                         intent.confidence && intent.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md"
    >
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <span>Swap Preview</span>
            </CardTitle>
            {intent.confidence && (
              <Badge className={`${confidenceColor} text-white text-xs`}>
                {Math.round(intent.confidence * 100)}% confidence
              </Badge>
            )}
          </div>
          <CardDescription>
            Review the parsed swap details before proceeding
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Swap Details */}
          <motion.div 
            className="space-y-3"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Chain Transfer */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{chains[intent.fromChain as keyof typeof chains]?.icon}</span>
                <span className="font-medium">{intent.amount}</span>
              </div>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center space-x-2">
                <span className="text-lg">{chains[intent.toChain as keyof typeof chains]?.icon}</span>
                <span className="font-medium">{chains[intent.toChain as keyof typeof chains]?.name}</span>
              </div>
            </div>

            {/* Beneficiary */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Beneficiary</p>
              <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                {intent.beneficiary}
              </p>
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Timelock</p>
                <p className="text-sm">{intent.timelock || 3600}s</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Slippage</p>
                <p className="text-sm">{intent.slippage || 1}%</p>
              </div>
            </div>

            {/* Mode */}
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Mode: {intent.dryRun ? 'Simulation' : 'Live'}
              </span>
            </div>
          </motion.div>

          {/* Warnings */}
          {intent.warnings && intent.warnings.length > 0 && (
            <motion.div 
              className="space-y-2"
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Warnings</span>
              </div>
              <div className="space-y-1">
                {intent.warnings.map((warning, index) => (
                  <p key={index} className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    {warning}
                  </p>
                ))}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div 
            className="flex space-x-3 pt-4"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={onProceed}
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Proceed
                </>
              )}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
} 