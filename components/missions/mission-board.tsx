"use client"

import { useState } from "react"

import { MissionCard } from "@/components/missions/mission-card"
import { MissionDialog } from "@/components/missions/mission-dialog"
import { RunPoller } from "@/components/missions/run-poller"
import type { DriveTarget } from "@/lib/drive/types"
import type { MissionSummary, SquadAgent } from "@/lib/missions/types"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { key: "queued", label: "Queued", dot: "bg-amber-500" },
  { key: "in_progress", label: "In progress", dot: "bg-blue-500" },
  { key: "completed", label: "Completed", dot: "bg-emerald-500" },
] as const

type ColumnKey = (typeof COLUMNS)[number]["key"]

// Failed runs wait in Queued with their error until they're edited or retried.
function columnFor(mission: MissionSummary): ColumnKey {
  return mission.status === "failed" ? "queued" : mission.status
}

export function MissionBoard({
  missions,
  squad,
  driveTarget,
}: {
  missions: MissionSummary[]
  squad: SquadAgent[]
  driveTarget: DriveTarget | null
}) {
  const [editing, setEditing] = useState<MissionSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const running = missions.some((mission) => mission.status === "in_progress")

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const items = missions.filter(
            (mission) => columnFor(mission) === column.key
          )
          return (
            <section
              key={column.key}
              aria-label={column.label}
              className="flex flex-col gap-3"
            >
              <h2 className="flex items-center gap-2.5 px-1 text-xs font-semibold tracking-wide text-foreground/80 uppercase">
                <span className={cn("size-2 rounded-full", column.dot)} />
                {column.label}
                <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-2.5">
                {items.length ? (
                  items.map((mission) => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onEdit={(target) => {
                        setEditing(target)
                        setEditOpen(true)
                      }}
                    />
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-foreground/15 py-8 text-center text-sm text-muted-foreground">
                    No missions
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editing && (
        <MissionDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          squad={squad}
          driveTarget={driveTarget}
          mission={editing}
        />
      )}
      {running && <RunPoller />}
    </>
  )
}
