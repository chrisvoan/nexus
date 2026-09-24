import "server-only"

import {
  AgentSessionError,
  describeSessionError,
  runAgentSession,
} from "@/lib/anthropic/sessions"
import { composeCompanyContext } from "@/lib/company-context"
import { getOutputDrive } from "@/lib/drive/connection"
import { createDriveOutput } from "@/lib/drive/create-file"
import { extractAgentKnowledge } from "@/lib/drive/knowledge"
import { describePipedreamError } from "@/lib/pipedream/client"
import { buildKickoffMessage } from "@/lib/missions/kickoff"
import { isMissingSchema } from "@/lib/missions/queries"
import { STALE_RUN_MS } from "@/lib/missions/types"
import type { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type Supabase = Awaited<ReturnType<typeof createClient>>
type MissionUpdate = Database["public"]["Tables"]["missions"]["Update"]

/** Everything a run needs, checked by the Run action before it starts. */
export type MissionRunContext = {
  mission: {
    id: string
    userId: string
    title: string
    brief: string
    webSearch: boolean
    outputType: Database["public"]["Enums"]["mission_output_type"]
  }
  agent: { id: string; claudeAgentId: string }
  environmentId: string
}

async function saveMission(
  supabase: Supabase,
  missionId: string,
  update: MissionUpdate
) {
  const { error } = await supabase
    .from("missions")
    .update(update)
    .eq("id", missionId)
  if (error)
    console.error(
      `Could not save mission run result for ${missionId}: ${error.message} (${error.code})`
    )
}

/**
 * Runs a mission that the Run action has already marked in progress, then
 * records the result. Never throws: every failure lands on the mission as
 * `status = failed` with a readable `error`, leaving the brief untouched.
 */
export async function executeMission(
  supabase: Supabase,
  context: MissionRunContext,
  deadline: number
) {
  const { mission, agent } = context

  try {
    const [{ data: company }, { data: assignment }, knowledge] =
      await Promise.all([
        supabase
          .from("company_settings")
          .select(
            "company_name, company_overview, brand_voice, reusable_instructions"
          )
          .maybeSingle(),
        supabase
          .from("user_agents")
          .select("custom_instructions")
          .eq("user_id", mission.userId)
          .eq("agent_id", agent.id)
          .maybeSingle(),
        extractAgentKnowledge(agent.id),
      ])

    const result = await runAgentSession({
      claudeAgentId: agent.claudeAgentId,
      environmentId: context.environmentId,
      title: mission.title,
      webSearch: mission.webSearch,
      metadata: {
        nexus_mission_id: mission.id,
        nexus_user_id: mission.userId,
        nexus_agent_id: agent.id,
      },
      knowledge: knowledge.map((file) => ({
        name: file.file_name,
        text: file.text,
      })),
      buildKickoff: (files) =>
        buildKickoffMessage({
          title: mission.title,
          brief: mission.brief,
          outputType: mission.outputType,
          webSearch: mission.webSearch,
          companyContext: composeCompanyContext(company),
          customInstructions: assignment?.custom_instructions,
          knowledgeFiles: files,
        }),
      onSessionCreated: (sessionId) =>
        saveMission(supabase, mission.id, { session_id: sessionId }),
      deadline,
    })

    // Phase 5 records result.usage as a usage event.

    const saved = await saveOutput(mission, result.output)
    await saveMission(supabase, mission.id, {
      status: "completed",
      session_id: result.sessionId,
      output_text: result.output,
      output_url: saved.url,
      output_file_id: saved.fileId,
      output_error: saved.error,
      error: null,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Mission run failed", mission.id, error)
    await saveMission(supabase, mission.id, {
      status: "failed",
      error: describeSessionError(error),
      ...(error instanceof AgentSessionError
        ? { session_id: error.sessionId }
        : {}),
    })
  }
}

// The text output is always kept on the mission; a Drive failure only costs
// the link, never the work. The file goes to the employee's own Drive when
// they have connected one, otherwise to the company Drive.
async function saveOutput(
  mission: MissionRunContext["mission"],
  content: string
): Promise<{ url: string | null; fileId: string | null; error: string | null }> {
  const drive = await getOutputDrive(mission.userId)
  if (!drive)
    return {
      url: null,
      fileId: null,
      error:
        "Google Drive isn't connected, so the output was saved in Nexus only. Connect your Drive in Settings to save future outputs there.",
    }

  try {
    const file = await createDriveOutput(drive.connection, {
      type: mission.outputType,
      title: mission.title,
      content,
    })
    return { url: file.url, fileId: file.fileId, error: file.warning ?? null }
  } catch (error) {
    console.error("Drive output failed", mission.id, drive.target, error)
    const hint =
      drive.target === "personal"
        ? " If this keeps happening, reconnect your Drive in Settings."
        : ""
    return {
      url: null,
      fileId: null,
      error: `The Drive file couldn't be created (${describePipedreamError(error)}). The output is saved in Nexus.${hint}`,
    }
  }
}

/**
 * Marks this user's runs that outlived the server as failed, so a crashed or
 * timed-out run doesn't sit in "In progress" forever.
 */
export async function failStaleMissions(supabase: Supabase, userId: string) {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString()
  const { error } = await supabase
    .from("missions")
    .update({
      status: "failed",
      error:
        "The run stopped responding before it finished. Run it again to retry.",
    })
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .lt("started_at", cutoff)
  // listMissions() reports a missing table with setup instructions.
  if (error && !isMissingSchema(error))
    console.error(`Could not clear stale missions: ${error.message} (${error.code})`)
}
