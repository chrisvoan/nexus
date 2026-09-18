import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Agents" }

export default function AgentsPage() {
  return (
    <PlaceholderPage
      href="/admin/agents"
      description="Create and configure Claude agents."
      phase="Phase 2"
    />
  )
}
