import { Badge } from "@/components/ui/badge"
import type { Agent } from "@/lib/types/database"
import { cn } from "@/lib/utils"

export function AgentSyncBadge({
  agent,
  className,
}: {
  agent: Pick<Agent, "sync_status" | "sync_error" | "archived_at">
  className?: string
}) {
  if (agent.archived_at)
    return (
      <Badge variant="outline" className={className}>
        Archived
      </Badge>
    )

  switch (agent.sync_status) {
    case "synced":
      return (
        <Badge
          className={cn(
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            className
          )}
        >
          Synced
        </Badge>
      )
    case "error":
      return (
        <Badge
          variant="destructive"
          title={agent.sync_error ?? undefined}
          className={className}
        >
          Sync failed
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className={className}>
          Not synced
        </Badge>
      )
  }
}
