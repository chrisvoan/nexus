import { Badge } from "@/components/ui/badge"
import type { Agent } from "@/lib/types/database"

export function AgentSyncBadge({
  agent,
}: {
  agent: Pick<Agent, "sync_status" | "sync_error" | "archived_at">
}) {
  if (agent.archived_at) return <Badge variant="outline">Archived</Badge>

  switch (agent.sync_status) {
    case "synced":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          Synced
        </Badge>
      )
    case "error":
      return (
        <Badge variant="destructive" title={agent.sync_error ?? undefined}>
          Sync failed
        </Badge>
      )
    default:
      return <Badge variant="secondary">Not synced</Badge>
  }
}
