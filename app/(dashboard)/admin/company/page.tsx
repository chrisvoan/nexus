import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Company" }

export default function CompanyPage() {
  return (
    <PlaceholderPage
      href="/admin/company"
      description="Brand voice and company context for every agent."
      phase="Phase 2"
    />
  )
}
