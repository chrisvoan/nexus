import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AgentIcon } from "@/components/agents/agent-icon"
import { AgentSyncBadge } from "@/components/agents/agent-sync-badge"
import { ModelPill } from "@/components/agents/model-pill"
import { navItem } from "@/components/dashboard/nav"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Agent } from "@/lib/types/database"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Agents" }

type AgentSummary = Pick<
  Agent,
  | "id"
  | "name"
  | "description"
  | "model"
  | "sync_status"
  | "sync_error"
  | "archived_at"
>

export default async function AgentsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, name, description, model, sync_status, sync_error, archived_at"
    )
    .order("name")
  if (error) throw new Error(error.message)

  const agents: AgentSummary[] = data
  const active = agents.filter((agent) => !agent.archived_at)
  const archived = agents.filter((agent) => agent.archived_at)

  return (
    <>
      <PageHeader
        title="Agents"
        description="Create and configure Claude agents."
        actions={
          <Link
            href="/admin/agents/new"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus />
            New agent
          </Link>
        }
      />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        {active.length === 0 ? <EmptyState /> : <AgentGrid agents={active} />}
        {archived.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Archived
            </h2>
            <AgentGrid agents={archived} />
          </section>
        )}
      </div>
    </>
  )
}

function AgentGrid({ agents }: { agents: AgentSummary[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/admin/agents/${agent.id}`}
          className={cn(
            "relative flex h-full flex-col rounded-xl bg-card p-7 text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
            agent.archived_at && "opacity-60"
          )}
        >
          {/* Only agents needing attention get a badge; the design has none. */}
          {(agent.sync_status !== "synced" || agent.archived_at) && (
            <div className="absolute top-5 right-5">
              <AgentSyncBadge agent={agent} />
            </div>
          )}
          <AgentIcon name={agent.name} />
          <h3 className="mt-7 truncate text-xl font-semibold">{agent.name}</h3>
          <p className="mt-2 line-clamp-2 text-muted-foreground">
            {agent.description || "No description."}
          </p>
          {/* Pinned to the bottom so cards in a row line up. */}
          <div className="mt-auto pt-6">
            <Separator />
            <ModelPill model={agent.model} className="mt-5" />
          </div>
        </Link>
      ))}
    </div>
  )
}

function EmptyState() {
  const item = navItem("/admin/agents")
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed px-8 py-12 text-center">
        <NavIcon item={item} className="size-10 rounded-lg [&_svg]:size-5" />
        <h2 className="font-medium">No agents yet</h2>
        <p className="text-sm text-muted-foreground">
          Create an agent, then assign it to employees under Users.
        </p>
        <Link
          href="/admin/agents/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus />
          New agent
        </Link>
      </div>
    </div>
  )
}
