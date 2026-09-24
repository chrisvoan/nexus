import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { GoogleDriveCard } from "@/components/integrations/google-drive-card"
import { requireAdmin } from "@/lib/auth"
import { getDriveConnectionStatus } from "@/lib/drive/connection"
import { isPipedreamConfigured } from "@/lib/pipedream/client"

export const metadata: Metadata = { title: "Integrations" }

export default async function IntegrationsPage() {
  await requireAdmin()
  const { connection, connectedAt, connectedByName } =
    await getDriveConnectionStatus()

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Services the whole company shares."
      />
      <div className="max-w-3xl p-4 md:p-6">
        <GoogleDriveCard
          connected={Boolean(connection)}
          configured={isPipedreamConfigured()}
          connectedAt={connectedAt}
          connectedByName={connectedByName}
        />
      </div>
    </>
  )
}
