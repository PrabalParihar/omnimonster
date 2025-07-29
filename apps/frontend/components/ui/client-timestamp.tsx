"use client"

import * as React from "react"

interface ClientTimestampProps {
  timestamp: number
  format?: "time" | "datetime" | "date"
  className?: string
}

export function ClientTimestamp({ timestamp, format = "datetime", className }: ClientTimestampProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span className={className}>--:--</span>
  }

  const date = new Date(timestamp)
  
  let formattedTime: string
  switch (format) {
    case "time":
      formattedTime = date.toLocaleTimeString()
      break
    case "date":
      formattedTime = date.toLocaleDateString()
      break
    case "datetime":
    default:
      formattedTime = date.toLocaleString()
      break
  }

  return <span className={className} suppressHydrationWarning>{formattedTime}</span>
} 