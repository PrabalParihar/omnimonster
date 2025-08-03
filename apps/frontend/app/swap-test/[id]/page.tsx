"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function TestSwapStatusPage() {
  const params = useParams()
  const swapId = params.id
  const [swapData, setSwapData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/swaps/${swapId}`)
      .then(res => res.json())
      .then(data => {
        console.log('Swap data received:', data)
        setSwapData(data)
      })
      .catch(err => {
        console.error('Error fetching swap:', err)
        setError(err.message)
      })
  }, [swapId])

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test Swap Status: {swapId}</h1>
      
      {error && (
        <div className="bg-red-100 p-4 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      {swapData && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Swap Data:</h2>
          <pre className="overflow-auto">
            {JSON.stringify(swapData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}