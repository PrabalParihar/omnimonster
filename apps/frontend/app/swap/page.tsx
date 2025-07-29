import { ChatInterface } from '@/components/chat-interface'

export default function SwapPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Chat with Swap Sage
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Describe your cross-chain swap in natural language
          </p>
        </div>
        
        <ChatInterface />
      </div>
    </div>
  )
} 