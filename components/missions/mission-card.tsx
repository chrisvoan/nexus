"use client"

import Link from "next/link"
import { AlertTriangle, Loader2, Pencil } from "lucide-react"

import { agentIconFor } from "@/components/agents/agent-icon"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { OutputIcon } from "@/components/missions/output-icon"
import { RunMissionButton } from "@/components/missions/run-mission-button"
import { Button } from "@/components/ui/button"
import {
  formatMissionDate,
  isRunnable,
  outputTypeLabel,
  type MissionSummary,
} from "@/lib/missions/types"

function elapsedSince(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  )
  return minutes < 1 ? "just now" : `${minutes} min ago`
}

export function MissionCard({
  mission,
  onEdit,
}: {
  mission: MissionSummary
  onEdit: (mission: MissionSummary) => void
}) {
  const runnable = isRunnable(mission.status)
  const failed = mission.status === "failed"
  const completed = mission.status === "completed"
  const agentName = mission.agent?.name ?? "Unavailable agent"

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
      <header className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 leading-snug font-semibold">
          <Link
            href={`/missions/${mission.id}`}
            className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {mission.title}
          </Link>
        </h3>
        {runnable && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="-my-0.5 text-muted-foreground"
            onClick={() => onEdit(mission)}
            aria-label={`Edit ${mission.title}`}
          >
            <Pencil />
          </Button>
        )}
        {completed && mission.output_url ? (
          <a
            href={mission.output_url}
            target="_blank"
            rel="noreferrer"
            title={`Open ${outputTypeLabel(mission.output_type)}`}
            className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <OutputIcon type={mission.output_type} />
          </a>
        ) : (
          <OutputIcon type={mission.output_type} />
        )}
      </header>

      <p className="line-clamp-2 text-sm text-muted-foreground">
        {mission.brief}
      </p>

      {failed && mission.error && (
        <p className="flex gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span className="line-clamp-3">{mission.error}</span>
        </p>
      )}
      {completed && mission.output_error && (
        <p className="flex gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            Not saved to Drive.{" "}
            <Link href={`/missions/${mission.id}`} className="underline">
              View output
            </Link>
          </span>
        </p>
      )}

      <footer className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <NavIcon
          item={agentIconFor(agentName)}
          className="size-5 rounded [&_svg]:size-3"
        />
        <span className="min-w-0 flex-1 truncate">{agentName}</span>
        {completed && mission.completed_at && (
          <span className="shrink-0" suppressHydrationWarning>
            {formatMissionDate(mission.completed_at)}
          </span>
        )}
        {mission.status === "in_progress" && mission.started_at && (
          <span className="flex shrink-0 items-center gap-1.5 text-sky-700 dark:text-sky-400">
            <Loader2 className="size-3 animate-spin" />
            <span suppressHydrationWarning>
              Started {elapsedSince(mission.started_at)}
            </span>
          </span>
        )}
      </footer>

      {runnable && <RunMissionButton missionId={mission.id} retry={failed} />}
    </article>
  )
}
