import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ChevronLeft, ExternalLink, Loader2 } from "lucide-react"

import { MarkdownPreview } from "@/components/agents/markdown-preview"
import { agentIconFor } from "@/components/agents/agent-icon"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"
import { CopyButton, EditMissionButton } from "@/components/missions/mission-actions"
import { OutputIcon } from "@/components/missions/output-icon"
import { RunMissionButton } from "@/components/missions/run-mission-button"
import { RunPoller } from "@/components/missions/run-poller"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireUser } from "@/lib/auth"
import { getOutputDrive } from "@/lib/drive/connection"
import { parseSheetRows } from "@/lib/drive/sheet-rows"
import { getSquad } from "@/lib/missions/queries"
import { failStaleMissions } from "@/lib/missions/run"
import {
  formatMissionDate,
  isRunnable,
  outputTypeLabel,
} from "@/lib/missions/types"
import { createClient } from "@/lib/supabase/server"
import type { MissionStatus } from "@/lib/types/database"
import { cn, isUuid } from "@/lib/utils"

export const metadata: Metadata = { title: "Mission" }

// Run is available here too; see the Missions page.
export const maxDuration = 300

const STATUS: Record<MissionStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  in_progress: { label: "In progress", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const user = await requireUser()
  const supabase = await createClient()
  await failStaleMissions(supabase, user.id)

  // Admins can open anyone's mission (RLS allows it) to inspect a run.
  const { data } = await supabase
    .from("missions")
    .select("*, agents(id, name), profiles(display_name, email)")
    .eq("id", id)
    .maybeSingle()
  if (!data) notFound()

  const { agents: agent, profiles: owner, ...mission } = data
  const isOwner = mission.user_id === user.id
  const isAdmin = user.profile.role === "admin"
  const [squad, drive] = await Promise.all([
    isOwner ? getSquad(user.id) : Promise.resolve([]),
    isOwner ? getOutputDrive(user.id) : Promise.resolve(null),
  ])

  const summary = { ...mission, agent }
  const status = STATUS[mission.status]
  const agentName = agent?.name ?? "Unavailable agent"

  return (
    <>
      <PageHeader
        title={mission.title}
        description={
          isOwner
            ? agentName
            : `${agentName} · ${owner?.display_name || owner?.email || "Another user"}`
        }
        actions={
          <Link
            href="/missions"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ChevronLeft />
            Missions
          </Link>
        }
      />
      <div className="grid max-w-5xl gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {mission.status === "failed" && mission.error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">The last run failed</p>
                <p className="text-muted-foreground">{mission.error}</p>
              </div>
            </div>
          )}

          <OutputCard
            mission={mission}
            isOwner={isOwner}
          />

          <Card>
            <CardHeader>
              <CardTitle>Brief</CardTitle>
              {isOwner && isRunnable(mission.status) && (
                <CardAction>
                  <EditMissionButton
                    mission={summary}
                    squad={squad}
                    driveTarget={drive?.target ?? null}
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{mission.brief}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardAction>
              <Badge className={status.className}>{status.label}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
              <dt className="text-muted-foreground">Agent</dt>
              <dd className="flex items-center gap-2">
                <NavIcon
                  item={agentIconFor(agentName)}
                  className="size-5 rounded [&_svg]:size-3"
                />
                <span className="truncate">{agentName}</span>
              </dd>
              <dt className="text-muted-foreground">Output</dt>
              <dd className="flex items-center gap-2">
                <OutputIcon type={mission.output_type} className="size-4" />
                {outputTypeLabel(mission.output_type)}
              </dd>
              <dt className="text-muted-foreground">Web search</dt>
              <dd>{mission.web_search ? "On" : "Off"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd suppressHydrationWarning>{formatMissionDate(mission.created_at)}</dd>
              {mission.completed_at && (
                <>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd suppressHydrationWarning>
                    {formatMissionDate(mission.completed_at)}
                  </dd>
                </>
              )}
              {mission.session_id && (
                <>
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="flex flex-col gap-1">
                    <code className="truncate font-mono text-xs" title={mission.session_id}>
                      {mission.session_id}
                    </code>
                    {isAdmin && (
                      <a
                        href={`https://platform.claude.com/workspaces/default/sessions/${mission.session_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                      >
                        Inspect in Claude Console
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </dd>
                </>
              )}
            </dl>

            {mission.status === "in_progress" && (
              <p className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-blue-800 dark:text-blue-300">
                <Loader2 className="size-4 animate-spin" />
                The agent is working. This page updates when it finishes.
              </p>
            )}
            {isOwner && isRunnable(mission.status) && (
              <RunMissionButton
                missionId={mission.id}
                retry={mission.status === "failed"}
              />
            )}
          </CardContent>
        </Card>
      </div>
      {mission.status === "in_progress" && <RunPoller />}
    </>
  )
}

function OutputCard({
  mission,
  isOwner,
}: {
  mission: {
    output_type: "doc" | "sheet" | "pdf"
    output_url: string | null
    output_text: string | null
    output_error: string | null
    status: MissionStatus
  }
  isOwner: boolean
}) {
  if (mission.status !== "completed" || !mission.output_text) return null
  const label = outputTypeLabel(mission.output_type)
  const rows =
    mission.output_type === "sheet" ? parseSheetRows(mission.output_text) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Output</CardTitle>
        <CardDescription>
          {mission.output_url
            ? `Saved to Google Drive as a ${label}.`
            : "Saved in Nexus."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <CopyButton text={mission.output_text} />
          {mission.output_url && (
            <a
              href={mission.output_url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <OutputIcon type={mission.output_type} className="size-4" />
              Open {label}
            </a>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mission.output_error && (
          <p className="flex gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {mission.output_error}
            {isOwner && !mission.output_url && " Copy it from below."}
          </p>
        )}
        {mission.output_type === "sheet" && rows.length > 0 ? (
          <div className="max-h-[32rem] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {rows[0].map((cell, index) => (
                    <TableHead key={index}>{cell}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(1).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, index) => (
                      <TableCell key={index} className="whitespace-normal">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="max-h-[40rem] overflow-auto rounded-lg border px-4 py-3">
            <MarkdownPreview content={mission.output_text} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
