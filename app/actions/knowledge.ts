"use server"

import { revalidatePath } from "next/cache"

import { getAdmin } from "@/lib/auth"
import { getDriveConnection } from "@/lib/drive/connection"
import { listDriveFiles } from "@/lib/drive/files"
import { listAgentKnowledge } from "@/lib/drive/knowledge"
import { readDriveFile } from "@/lib/drive/read-file"
import {
  SUPPORTED_DRIVE_MIME_TYPES,
  type AgentKnowledgeFile,
  type DriveFilePage,
} from "@/lib/drive/types"
import { describePipedreamError } from "@/lib/pipedream/client"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/utils"

const MAX_KNOWLEDGE_FILES = 20
const MAX_SEARCH_LENGTH = 200

export type DriveFilesResult =
  | ({ ok: true } & DriveFilePage)
  | { error: string; disconnected?: true }

/** One page of Drive files for the agent knowledge picker. Admin only. */
export async function fetchDriveFiles(options: {
  search?: string
  pageToken?: string
}): Promise<DriveFilesResult> {
  if (!(await getAdmin())) return { error: "Only admins can browse Drive." }

  const connection = await getDriveConnection()
  if (!connection)
    return { error: "Google Drive is not connected.", disconnected: true }

  const search = options.search?.slice(0, MAX_SEARCH_LENGTH)

  try {
    const page = await listDriveFiles(connection, {
      search,
      pageToken: options.pageToken,
    })
    return { ok: true, ...page }
  } catch (error) {
    console.error("Drive file listing failed", error)
    return { error: describePipedreamError(error) }
  }
}

export type KnowledgePreview =
  | { ok: true; fileName: string; text: string }
  | { error: string }

/**
 * The extracted text an agent will actually receive for one pinned file.
 * Lets an admin confirm a Doc, Sheet, PDF, DOCX, TXT or CSV really is readable
 * before a mission depends on it.
 */
export async function previewKnowledgeFile(
  agentId: string,
  fileId: string
): Promise<KnowledgePreview> {
  if (!(await getAdmin()))
    return { error: "Only admins can preview knowledge files." }
  if (!isUuid(agentId)) return { error: "Unknown agent." }

  const connection = await getDriveConnection()
  if (!connection) return { error: "Google Drive is not connected." }

  const supabase = await createClient()
  const { data: file } = await supabase
    .from("agent_knowledge")
    .select("file_id, file_name, file_mime_type")
    .eq("agent_id", agentId)
    .eq("file_id", fileId)
    .maybeSingle()
  if (!file) return { error: "That file is not pinned to this agent." }

  // readDriveFile never throws; unreadable files come back as a note.
  const text = await readDriveFile(connection, file)
  return { ok: true, fileName: file.file_name, text }
}

export type KnowledgeResult =
  | { ok: true; files: AgentKnowledgeFile[] }
  | { error: string }

export async function fetchAgentKnowledge(
  agentId: string
): Promise<KnowledgeResult> {
  if (!(await getAdmin()))
    return { error: "Only admins can view agent knowledge." }
  if (!isUuid(agentId)) return { error: "Unknown agent." }

  try {
    return { ok: true, files: await listAgentKnowledge(agentId) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not load files.",
    }
  }
}

/**
 * Pins or unpins one Drive file for an agent. Only the identifiers are stored;
 * contents are read from Drive at run time.
 */
export async function setAgentKnowledgeFile(
  agentId: string,
  file: { fileId: string; fileName: string; mimeType: string },
  pinned: boolean
): Promise<KnowledgeResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can edit agent knowledge." }
  if (!isUuid(agentId)) return { error: "Unknown agent." }

  const supabase = await createClient()

  if (pinned) {
    const fileId = file.fileId.trim()
    const fileName = file.fileName.trim()
    if (!fileId || !fileName) return { error: "That file is missing details." }
    if (!SUPPORTED_DRIVE_MIME_TYPES.includes(file.mimeType))
      return { error: "That file type can't be used as knowledge." }

    // The agent must exist and still be editable — the picker is rendered by
    // the edit page, but an action must not trust the page that called it.
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .is("archived_at", null)
      .maybeSingle()
    if (!agent) return { error: "Agent not found or archived." }

    const { count } = await supabase
      .from("agent_knowledge")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
    if ((count ?? 0) >= MAX_KNOWLEDGE_FILES)
      return {
        error: `An agent can hold up to ${MAX_KNOWLEDGE_FILES} knowledge files.`,
      }

    const { error } = await supabase.from("agent_knowledge").upsert(
      {
        agent_id: agentId,
        file_id: fileId,
        file_name: fileName,
        file_mime_type: file.mimeType,
        added_by: admin.id,
      },
      { onConflict: "agent_id,file_id" }
    )
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("agent_knowledge")
      .delete()
      .eq("agent_id", agentId)
      .eq("file_id", file.fileId)
    if (error) return { error: error.message }
  }

  revalidatePath(`/admin/agents/${agentId}`)

  try {
    return { ok: true, files: await listAgentKnowledge(agentId) }
  } catch {
    return { ok: true, files: [] }
  }
}
