import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AgentCard, type AgentSummary } from "@/components/agents/agent-card"
import { navItem } from "@/components/dashboard/nav"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Agents" }

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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
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
