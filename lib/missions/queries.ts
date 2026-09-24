import "server-only"

import { cache } from "react"

import type { MissionSummary, SquadAgent } from "@/lib/missions/types"
import { createClient } from "@/lib/supabase/server"

const SUMMARY_COLUMNS =
  "id, title, brief, status, output_type, output_url, web_search, error, output_error, started_at, completed_at, created_at, agents(id, name)"

/**
 * The employee's squad: assigned agents that aren't archived, by name.
 * Deduplicated per request so the sidebar and the Missions page share it.
 */
export const getSquad = cache(async (userId: string): Promise<SquadAgent[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_agents")
    .select("agents(id, name, archived_at)")
    .eq("user_id", userId)
  return (data ?? [])
    .flatMap((row) => (row.agents && !row.agents.archived_at ? [row.agents] : []))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/**
 * True when a query failed because a Phase 4 table or column is missing,
 * i.e. migration 006 hasn't been applied.
 */
export function isMissingSchema(error: { code?: string }) {
  // PGRST205: table not in PostgREST's schema cache. 42P01 / 42703:
  // Postgres undefined table / column.
  return ["PGRST205", "42P01", "42703"].includes(error.code ?? "")
}

/** This user's missions, most recently active first. */
export async function listMissions(userId: string): Promise<MissionSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("missions")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error)
    throw new Error(
      isMissingSchema(error)
        ? "The missions table doesn't exist yet. Apply supabase/migrations/006_missions.sql in the Supabase SQL Editor."
        : error.message
    )

  return data
    .map(({ agents, ...mission }) => ({ ...mission, agent: agents }))
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.created_at).getTime() -
        new Date(a.completed_at ?? a.created_at).getTime()
    )
}
