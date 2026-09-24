"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const POLL_MS = 4_000

/**
 * Re-fetches the page's server data while a mission is running, so the card
 * moves to Completed (or back to Queued as failed) without a manual reload.
 * Renders nothing; mount it only while something is in progress.
 */
export function RunPoller() {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [router])

  return null
}
