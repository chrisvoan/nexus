import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <PlaceholderPage
      href="/settings"
      description="Your profile and preferences."
      phase="Phase 5"
    />
  )
}
