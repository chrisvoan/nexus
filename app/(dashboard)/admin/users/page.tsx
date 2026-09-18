import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/dashboard/placeholder-page"

export const metadata: Metadata = { title: "Users" }

export default function UsersPage() {
  return (
    <PlaceholderPage
      href="/admin/users"
      description="Manage employees and assign their squad."
      phase="Phase 2"
    />
  )
}
