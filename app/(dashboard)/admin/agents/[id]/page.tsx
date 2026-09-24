import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentActions } from "@/components/agents/agent-actions"
import { AgentForm } from "@/components/agents/agent-form"
import { AgentKnowledgeEditor } from "@/components/agents/agent-knowledge-editor"
import { AgentSyncBadge } from "@/components/agents/agent-sync-badge"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  DEFAULT_AGENT_MODEL,
  listModels,
  withModel,
} from "@/lib/anthropic/models"
import { requireAdmin } from "@/lib/auth"
import { hasCompanyProfile } from "@/lib/company-context"
import { getDriveConnection } from "@/lib/drive/connection"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/utils"

export const metadata: Metadata = { title: "Edit agent" }

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  await requireAdmin()
  const supabase = await createClient()
  const [{ data: agent }, models, { data: company }, driveConnection] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", id).maybeSingle(),
      listModels(),
      supabase
        .from("company_settings")
        .select("company_overview, brand_voice, reusable_instructions")
        .maybeSingle(),
      getDriveConnection(),
    ])
  if (!agent) notFound()

  const archived = Boolean(agent.archived_at)

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.claude_agent_id ?? "Not yet created in Claude"}
        actions={
          <div className="flex items-center gap-2">
            <AgentSyncBadge agent={agent} />
            {!archived && (
              <AgentActions
                agentId={agent.id}
                agentName={agent.name}
                needsSync={agent.sync_status !== "synced"}
              />
            )}
          </div>
        }
      />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {agent.sync_status === "error" && !archived && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Saved in Nexus but not synced to Claude: {agent.sync_error}
          </p>
        )}
        {archived && (
          <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            This agent is archived and read-only.
          </p>
        )}
        <AgentForm
          agent={agent}
          models={withModel(models, agent.model)}
          defaultModel={DEFAULT_AGENT_MODEL}
          hasCompanyContext={hasCompanyProfile(company)}
          readOnly={archived}
          knowledge={
            <AgentKnowledgeEditor
              agentId={agent.id}
              driveConnected={Boolean(driveConnection)}
              readOnly={archived}
            />
          }
        />
      </div>
    </>
  )
}
