/**
 * Formats a timestamp consistently across server and client
 * Uses ISO format to avoid timezone/locale issues during hydration
 */
export function formatTimestamp(timestamp: number | string): string {
  const date = new Date(timestamp)
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}