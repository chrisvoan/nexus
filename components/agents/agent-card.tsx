import { agentIconFor } from "@/components/agents/agent-icon"
import { AgentSyncBadge } from "@/components/agents/agent-sync-badge"
import { ModelPill } from "@/components/agents/model-pill"
import { DetailCard } from "@/components/dashboard/detail-card"
import { NavIcon } from "@/components/dashboard/nav-icon"
import type { Agent } from "@/lib/types/database"

export type AgentSummary = Pick<
  Agent,
  | "id"
  | "name"
  | "description"
  | "model"
  | "sync_status"
  | "sync_error"
  | "archived_at"
>

export function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <DetailCard
      href={`/admin/agents/${agent.id}`}
      className={agent.archived_at ? "opacity-60" : undefined}
      icon={
        <NavIcon
          item={agentIconFor(agent.name)}
          className="size-10 rounded-lg [&_svg]:size-5"
        />
      }
      title={agent.name}
      description={agent.description || "No description."}
      badge={<AgentSyncBadge agent={agent} className="h-6 px-2.5" />}
    >
      <ModelPill model={agent.model} />
    </DetailCard>
  )
}
