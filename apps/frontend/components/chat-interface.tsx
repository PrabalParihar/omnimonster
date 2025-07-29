"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { SwapPreviewCard } from "@/components/swap-preview-card"
import { SwapStatusTimeline } from "@/components/swap-status-timeline"
import { Send, Loader2, Bot, User } from "lucide-react"

interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: number
}

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

const exampleQueries = [
  "Swap 0.01 ETH from Sepolia to Polygon to 0x742d35Cc6639C0532C79E5F4aE97E96E3F92C7E8",
  "Transfer 100 USDC from Polygon to Cosmos with 2% slippage",
  "Atomic swap 0.5 ETH to ATOM with 1 hour timelock",
  "Cross-chain transfer 50 MATIC from Polygon to Sepolia"
]

const messageVariants = {
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

export function ChatInterface() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 'welcome',
      content: "Hi! I'm Swap Sage. I can help you with cross-chain atomic swaps. Try asking me to swap tokens between different blockchains!",
      sender: 'bot',
      timestamp: 0
    }
  ])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [parsedIntent, setParsedIntent] = React.useState<ParsedSwapIntent | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const { toast } = useToast()

  // Update timestamp on client side to prevent hydration mismatch
  React.useEffect(() => {
    setMessages(prev => prev.map(msg => 
      msg.id === 'welcome' 
        ? { ...msg, timestamp: Date.now() - 5000 }
        : msg
    ))
  }, [])

  const addMessage = (content: string, sender: 'user' | 'bot') => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue("")
    addMessage(userMessage, 'user')
    setIsLoading(true)

    try {
      // Parse the natural language intent
      const response = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMessage }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse intent')
      }

      const parsedData = await response.json()
      setParsedIntent(parsedData)

      addMessage(
        `I understand you want to swap ${parsedData.amount} from ${parsedData.fromChain} to ${parsedData.toChain}. Please review the details below and confirm to proceed.`,
        'bot'
      )

    } catch (error) {
      console.error('Error parsing intent:', error)
      addMessage(
        "I'm sorry, I couldn't understand your request. Please try rephrasing it or use one of the example queries below.",
        'bot'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleProceedWithSwap = async () => {
    if (!parsedIntent) return

    setIsProcessing(true)
    addMessage("Creating your swap...", 'bot')

    try {
      const response = await fetch('/api/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromChain: parsedIntent.fromChain,
          toChain: parsedIntent.toChain,
          amount: parsedIntent.amount,
          beneficiary: parsedIntent.beneficiary,
          timelock: parsedIntent.timelock || 3600,
          slippage: parsedIntent.slippage || 1,
          dryRun: parsedIntent.dryRun || false,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create swap')
      }

      const swapData = await response.json()
      setParsedIntent(null)

      addMessage(
        `Great! Your swap has been created with ID: ${swapData.id}. Here's the real-time status:`,
        'bot'
      )

      // Add the swap status timeline as a special message
      setMessages(prev => [...prev, {
        id: `swap-${swapData.id}`,
        content: `SWAP_STATUS_TIMELINE:${swapData.id}`,
        sender: 'bot',
        timestamp: Date.now()
      }])

      toast({
        title: "Swap Created!",
        description: `Your swap ${swapData.id} has been initiated successfully.`,
      })

    } catch (error) {
      console.error('Error creating swap:', error)
      addMessage(
        "Sorry, there was an error creating your swap. Please try again.",
        'bot'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelSwap = () => {
    setParsedIntent(null)
    addMessage("No problem! Let me know if you'd like to try a different swap.", 'bot')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 p-6 border-b">
        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Swap Sage Chat</h1>
          <p className="text-sm text-muted-foreground">
            Natural language cross-chain atomic swaps
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                
                <div className={`rounded-lg px-4 py-2 ${
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {message.content.startsWith('SWAP_STATUS_TIMELINE:') ? (
                    <div className="w-full max-w-2xl">
                      <SwapStatusTimeline 
                        swapId={message.content.split(':')[1]} 
                      />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            variants={messageVariants}
            initial="hidden"
            animate="visible"
            className="flex justify-start"
          >
            <div className="flex items-start space-x-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Swap Preview Card */}
      {parsedIntent && (
        <div className="p-6 border-t">
          <SwapPreviewCard
            intent={parsedIntent}
            onProceed={handleProceedWithSwap}
            onCancel={handleCancelSwap}
            loading={isProcessing}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-6 border-t">
        <div className="flex space-x-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Try: Swap 0.01 ETH from Sepolia to Polygon..."
            disabled={isLoading || isProcessing}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || isProcessing}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Example Queries */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((query, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => setInputValue(query)}
                disabled={isLoading || isProcessing}
                className="text-xs"
              >
                {query}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 