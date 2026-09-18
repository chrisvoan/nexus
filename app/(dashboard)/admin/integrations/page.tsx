import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Integrations" }

export default function IntegrationsPage() {
  return (
    <PlaceholderPage
      href="/admin/integrations"
      description="Connect the company Google Drive."
      phase="Phase 3"
    />
  )
}
