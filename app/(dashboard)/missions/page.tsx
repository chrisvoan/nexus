import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Missions" }

export default function MissionsPage() {
  return (
    <PlaceholderPage
      href="/missions"
      description="Brief your agents and track their work."
      phase="Phase 4"
    />
  )
}
