import "server-only"

import { getDriveConnection } from "@/lib/drive/connection"
import { readDriveFile } from "@/lib/drive/read-file"
import type { AgentKnowledgeFile } from "@/lib/drive/types"
import { createClient } from "@/lib/supabase/server"

/** The Drive files an admin pinned to this agent, oldest first. */
export async function listAgentKnowledge(
  agentId: string
): Promise<AgentKnowledgeFile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agent_knowledge")
    .select("id, file_id, file_name, file_mime_type")
    .eq("agent_id", agentId)
    .order("created_at")
  if (error) throw new Error(error.message)
  return data
}

export type ExtractedKnowledgeFile = AgentKnowledgeFile & {
  /** Plain text, or a parenthesised note explaining why it is unavailable. */
  text: string
}

/**
 * Pinned files extracted to plain text, ready for Phase 4 to upload and mount
 * into a Claude session. Contents are fetched fresh from Drive on every call —
 * nothing is cached in Supabase, so an edited Doc is current on the next run.
 *
 * Returns an empty array when Drive is not connected or nothing is pinned.
 * Individual files that fail to read come back with the failure in `text`
 * rather than throwing.
 */
export async function extractAgentKnowledge(
  agentId: string
): Promise<ExtractedKnowledgeFile[]> {
  const files = await listAgentKnowledge(agentId)
  if (!files.length) return []

  const connection = await getDriveConnection()
  if (!connection)
    return files.map((file) => ({
      ...file,
      text: "(Google Drive is not connected — this file could not be read)",
    }))

  // Sequential on purpose: Pipedream's proxy is rate limited, and a squad's
  // worth of parallel Drive reads is the first thing to trip it.
  const extracted: ExtractedKnowledgeFile[] = []
  for (const file of files) {
    extracted.push({ ...file, text: await readDriveFile(connection, file) })
  }
  return extracted
}
