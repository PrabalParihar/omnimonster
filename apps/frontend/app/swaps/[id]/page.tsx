'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SwapsRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  useEffect(() => {
    // Redirect from /swaps/[id] to /swap/[id]
    if (id) {
      router.replace(`/swap/${id}`)
    }
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to swap status...</p>
      </div>
    </div>
  )
}