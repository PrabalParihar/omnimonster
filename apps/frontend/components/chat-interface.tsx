"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, Zap, ArrowRightLeft, Clock } from "lucide-react"

const exampleQueries = [
  "Swap 0.1 ETH from Sepolia to 100 MATIC on Polygon",
  "Exchange 50 USDC from Polygon to ETH on Ethereum",
  "Convert 0.05 BTC to ETH with 2 hour timelock",
  "Trade my Cosmos tokens for Ethereum"
]

export function ChatInterface() {
  const [message, setMessage] = React.useState("")
  const [messages, setMessages] = React.useState([
    {
      id: 1,
      type: "assistant" as const,
      content: "Hello! I'm Swap Sage. Describe the cross-chain swap you'd like to make, and I'll help you execute it securely using atomic swaps.",
      timestamp: Date.now() - 5000
    }
  ])

  const handleSendMessage = () => {
    if (!message.trim()) return
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      type: "user" as const,
      content: message,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, userMessage])
    setMessage("")
    
    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage = {
        id: Date.now() + 1,
        type: "assistant" as const,
        content: "I understand you want to make a cross-chain swap. Let me analyze your request and prepare the atomic swap parameters...",
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMessage])
    }, 1000)
  }

  return (
    <div className="flex h-[600px] flex-col space-y-4">
      {/* Chat Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.type === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <span className="text-xs opacity-70">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Describe your swap: 'Exchange 0.1 ETH for MATIC'"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={handleSendMessage} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exampleQueries.map((query, index) => (
          <Card key={index} className="cursor-pointer transition-colors hover:bg-accent" onClick={() => setMessage(query)}>
            <CardContent className="flex items-center space-x-3 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {index === 0 && <ArrowRightLeft className="h-4 w-4 text-primary" />}
                {index === 1 && <Zap className="h-4 w-4 text-primary" />}
                {index === 2 && <Clock className="h-4 w-4 text-primary" />}
                {index === 3 && <MessageCircle className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{query}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Ready to process atomic swaps</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 