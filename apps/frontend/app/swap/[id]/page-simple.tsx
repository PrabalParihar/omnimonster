"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SwapStatusPageSimple() {
  const params = useParams()
  const swapId = params.id as string
  
  const [swapStatus, setSwapStatus] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/swaps/${swapId}`)
      .then(res => res.json())
      .then(data => {
        console.log('Received swap data:', data)
        setSwapStatus(data)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Error:', err)
        setError(err.message)
        setIsLoading(false)
      })
  }, [swapId])

  if (isLoading) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Swap Status</CardTitle>
          <CardDescription>ID: {swapId}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(swapStatus, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}