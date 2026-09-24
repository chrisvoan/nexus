// Shared by the mission server code and the Kanban/dialog client components,
// so this module must stay free of runtime imports and secrets.

import type {
  Mission,
  MissionOutputType,
  MissionStatus,
} from "@/lib/types/database"

export const MISSION_LIMITS = { title: 200, brief: 20_000 } as const

/** Matches the check constraint in migration 007. */
export const CUSTOM_INSTRUCTIONS_LIMIT = 5_000

export const OUTPUT_TYPES: {
  value: MissionOutputType
  label: string
  description: string
}[] = [
  {
    value: "doc",
    label: "Google Doc",
    description: "Formatted document in Drive",
  },
  {
    value: "sheet",
    label: "Google Sheet",
    description: "Rows and columns in Drive",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "PDF file saved in Drive",
  },
]

export function outputTypeLabel(type: MissionOutputType) {
  return OUTPUT_TYPES.find((option) => option.value === type)?.label ?? type
}

export function isOutputType(value: string): value is MissionOutputType {
  return OUTPUT_TYPES.some((option) => option.value === value)
}

/** "16 Jun 2026", as on the Kanban cards. */
export function formatMissionDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Missions that have not produced output yet can still be edited and run. */
export function isRunnable(status: MissionStatus) {
  return status === "queued" || status === "failed"
}

/**
 * The longest a run may take before it is treated as abandoned. Runs execute
 * after the Run action responds (`after()`), bounded by the Missions page's
 * `maxDuration`; if the server is killed first, nothing marks the mission
 * failed, so the board does it once this much time has passed.
 */
export const STALE_RUN_MS = 10 * 60 * 1000

/**
 * How long a run may use before it is stopped. Pages that can start a run
 * export `maxDuration = 300`; this leaves time to save the result after the
 * agent is interrupted.
 */
export const RUN_BUDGET_MS = 270 * 1000

/** What the Kanban and the detail page need from a mission row. */
export type MissionSummary = Pick<
  Mission,
  | "id"
  | "title"
  | "brief"
  | "status"
  | "output_type"
  | "output_url"
  | "web_search"
  | "error"
  | "output_error"
  | "started_at"
  | "completed_at"
  | "created_at"
> & {
  agent: { id: string; name: string } | null
}

export type SquadAgent = { id: string; name: string }
