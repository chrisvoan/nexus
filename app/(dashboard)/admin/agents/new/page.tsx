import type { Metadata } from "next"

import { AgentForm } from "@/components/agents/agent-form"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  DEFAULT_AGENT_MODEL,
  listModels,
  withModel,
} from "@/lib/anthropic/models"
import { requireAdmin } from "@/lib/auth"
import { hasCompanyProfile } from "@/lib/company-context"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "New agent" }

export default async function NewAgentPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [models, { data: company }] = await Promise.all([
    listModels(),
    supabase
      .from("company_settings")
      .select("company_overview, brand_voice, reusable_instructions")
      .maybeSingle(),
  ])

  return (
    <>
      <PageHeader
        title="New agent"
        description="Configure a Claude agent for your team."
      />
      <div className="p-4 md:p-6">
        <AgentForm
          models={withModel(models, DEFAULT_AGENT_MODEL)}
          defaultModel={DEFAULT_AGENT_MODEL}
          hasCompanyContext={hasCompanyProfile(company)}
        />
      </div>
    </>
  )
}
