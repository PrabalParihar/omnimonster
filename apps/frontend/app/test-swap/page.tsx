"use client"

import React, { useEffect, useState } from 'react'

export default function TestSwapPage() {
  const [swapData, setSwapData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const testSwapId = 'e5a0500e-be55-48e3-b6fb-7553c5850d63'
  
  useEffect(() => {
    fetch(`/api/swaps/${testSwapId}`)
      .then(res => res.json())
      .then(data => {
        console.log('Swap data:', data)
        setSwapData(data)
      })
      .catch(err => {
        console.error('Error:', err)
        setError(err.message)
      })
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Swap API</h1>
      {error && <div className="text-red-500">Error: {error}</div>}
      {swapData && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(swapData, null, 2)}
        </pre>
      )}
    </div>
  )
}