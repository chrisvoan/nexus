"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { executeMission } from "@/lib/missions/run"
import {
  isOutputType,
  isRunnable,
  MISSION_LIMITS,
  RUN_BUDGET_MS,
} from "@/lib/missions/types"
import { createClient } from "@/lib/supabase/server"
import type { MissionOutputType } from "@/lib/types/database"
import { isUuid } from "@/lib/utils"

export type MissionFormState = { error?: string; ok?: boolean } | undefined

type ActionResult = { ok: true } | { error: string }

type MissionInput = {
  agentId: string
  title: string
  brief: string
  webSearch: boolean
  outputType: MissionOutputType
}

function readMissionForm(
  formData: FormData
): MissionInput | { error: string } {
  const agentId = String(formData.get("agentId") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const brief = String(formData.get("brief") ?? "").trim()
  const outputType = String(formData.get("outputType") ?? "")

  if (!isUuid(agentId)) return { error: "Choose an agent from your squad." }
  if (!title) return { error: "Give the mission a title." }
  if (title.length > MISSION_LIMITS.title)
    return { error: `Title must be ${MISSION_LIMITS.title} characters or fewer.` }
  if (!brief) return { error: "Write a brief for the agent." }
  if (brief.length > MISSION_LIMITS.brief)
    return { error: `Brief must be ${MISSION_LIMITS.brief.toLocaleString()} characters or fewer.` }
  if (!isOutputType(outputType)) return { error: "Choose an output format." }

  return {
    agentId,
    title,
    brief,
    outputType,
    webSearch: formData.get("webSearch") === "on",
  }
}

// RLS limits users to agents they can see, but the check is repeated here so
// the error is readable and archived agents are refused.
async function isInSquad(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  agentId: string
) {
  const { data } = await supabase
    .from("user_agents")
    .select("agents(id, archived_at)")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .maybeSingle()
  return Boolean(data?.agents && !data.agents.archived_at)
}

export async function createMission(
  _state: MissionFormState,
  formData: FormData
): Promise<MissionFormState> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }

  const input = readMissionForm(formData)
  if ("error" in input) return input

  const supabase = await createClient()
  if (!(await isInSquad(supabase, user.id, input.agentId)))
    return { error: "That agent isn't in your squad." }

  const { error } = await supabase.from("missions").insert({
    user_id: user.id,
    agent_id: input.agentId,
    title: input.title,
    brief: input.brief,
    web_search: input.webSearch,
    output_type: input.outputType,
  })
  if (error) return { error: error.message }

  revalidatePath("/missions")
  return { ok: true }
}

export async function updateMission(
  missionId: string,
  _state: MissionFormState,
  formData: FormData
): Promise<MissionFormState> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  if (!isUuid(missionId)) return { error: "Mission not found." }

  const input = readMissionForm(formData)
  if ("error" in input) return input

  const supabase = await createClient()
  if (!(await isInSquad(supabase, user.id, input.agentId)))
    return { error: "That agent isn't in your squad." }

  // Editing a failed mission puts it back in the queue with a clean slate;
  // the failed session stays in the Console if anyone needs it.
  const { data, error } = await supabase
    .from("missions")
    .update({
      agent_id: input.agentId,
      title: input.title,
      brief: input.brief,
      web_search: input.webSearch,
      output_type: input.outputType,
      status: "queued",
      error: null,
    })
    .eq("id", missionId)
    .eq("user_id", user.id)
    .in("status", ["queued", "failed"])
    .select("id")
  if (error) return { error: error.message }
  if (!data?.length)
    return { error: "Only missions that haven't run yet can be edited." }

  revalidatePath("/missions")
  revalidatePath(`/missions/${missionId}`)
  return { ok: true }
}

export async function deleteMission(missionId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  if (!isUuid(missionId)) return { error: "Mission not found." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("missions")
    .delete()
    .eq("id", missionId)
    .eq("user_id", user.id)
    .neq("status", "in_progress")
    .select("id")
  if (error) return { error: error.message }
  if (!data?.length)
    return { error: "Mission not found, or it is running right now." }

  revalidatePath("/missions")
  return { ok: true }
}

/**
 * Starts a queued (or failed) mission. Everything that can be checked up
 * front is, so the employee gets an immediate, specific error; the Claude
 * session itself runs after the response, and the board polls for the result.
 */
export async function runMission(missionId: string): Promise<ActionResult> {
  const startedAt = Date.now()
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  if (!isUuid(missionId)) return { error: "Mission not found." }

  const supabase = await createClient()
  const { data: mission } = await supabase
    .from("missions")
    .select("id, user_id, agent_id, title, brief, web_search, output_type, status")
    .eq("id", missionId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!mission) return { error: "Mission not found." }
  if (mission.status === "in_progress")
    return { error: "This mission is already running." }
  if (!isRunnable(mission.status))
    return { error: "This mission has already completed." }

  const [{ data: agent }, { data: company }] = await Promise.all([
    supabase
      .from("agents")
      .select("id, claude_agent_id, archived_at")
      .eq("id", mission.agent_id)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("anthropic_environment_id")
      .maybeSingle(),
  ])
  if (!agent || agent.archived_at)
    return {
      error: "This agent is no longer in your squad. Edit the mission to pick another.",
    }
  const claudeAgentId = agent.claude_agent_id
  if (!claudeAgentId)
    return {
      error: "This agent hasn't been synced to Claude yet. Ask an admin to open it and retry the sync.",
    }
  const environmentId = company?.anthropic_environment_id
  if (!environmentId)
    return {
      error: "The agent runtime isn't set up yet. Ask an admin to create it under Integrations.",
    }

  // The status filter makes this the lock: of two concurrent Run clicks, only
  // one update matches a queued/failed row.
  const { data: claimed, error } = await supabase
    .from("missions")
    .update({
      status: "in_progress",
      started_at: new Date(startedAt).toISOString(),
      completed_at: null,
      session_id: null,
      output_url: null,
      output_file_id: null,
      output_text: null,
      output_error: null,
      error: null,
    })
    .eq("id", mission.id)
    .eq("user_id", user.id)
    .in("status", ["queued", "failed"])
    .select("id")
  if (error) return { error: error.message }
  if (!claimed?.length) return { error: "This mission is already running." }

  after(() =>
    executeMission(
      supabase,
      {
        mission: {
          id: mission.id,
          userId: user.id,
          title: mission.title,
          brief: mission.brief,
          webSearch: mission.web_search,
          outputType: mission.output_type,
        },
        agent: { id: agent.id, claudeAgentId },
        environmentId,
      },
      startedAt + RUN_BUDGET_MS
    )
  )

  revalidatePath("/missions")
  revalidatePath(`/missions/${mission.id}`)
  return { ok: true }
}
