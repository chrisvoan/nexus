import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Usage" }

export default function UsagePage() {
  return (
    <PlaceholderPage
      href="/usage"
      description="Token usage and cost across missions."
      phase="Phase 5"
    />
  )
}
