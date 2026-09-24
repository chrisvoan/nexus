import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { AgentRuntimeCard } from "@/components/integrations/agent-runtime-card"
import { GoogleDriveCard } from "@/components/integrations/google-drive-card"
import { requireAdmin } from "@/lib/auth"
import { getDriveConnectionStatus } from "@/lib/drive/connection"
import { isPipedreamConfigured } from "@/lib/pipedream/client"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Integrations" }

export default async function IntegrationsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ connection, connectedAt, connectedByName }, { data: company }] =
    await Promise.all([
      getDriveConnectionStatus(),
      supabase
        .from("company_settings")
        .select("anthropic_environment_id")
        .maybeSingle(),
    ])

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect org-level services. These credentials are shared across all agents and missions."
      />
      <div className="grid max-w-5xl gap-4 p-4 md:p-6 lg:grid-cols-2">
        <GoogleDriveCard
          scope="company"
          connected={Boolean(connection)}
          configured={isPipedreamConfigured()}
          connectedAt={connectedAt}
          connectedLabel={
            connectedByName ? `Connected by ${connectedByName}` : null
          }
        />
        <AgentRuntimeCard
          environmentId={company?.anthropic_environment_id ?? null}
        />
      </div>
    </>
  )
}
