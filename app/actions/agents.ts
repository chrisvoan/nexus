"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  archiveClaudeAgent,
  describeAnthropicError,
  upsertClaudeAgent,
} from "@/lib/anthropic/agents"
import { generateSystemPrompt } from "@/lib/anthropic/generate-prompt"
import { getAdmin } from "@/lib/auth"
import { composeCompanyContext } from "@/lib/company-context"
import { createClient } from "@/lib/supabase/server"

export type AgentFormState =
  { error?: string; message?: string; syncError?: string } | undefined

const LIMITS = { name: 100, description: 500, systemPrompt: 100_000 }

function readAgentForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    systemPrompt: String(formData.get("systemPrompt") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
  }
}

function validateAgent(input: ReturnType<typeof readAgentForm>) {
  if (!input.name) return "Name is required."
  if (input.name.length > LIMITS.name)
    return `Name must be ${LIMITS.name} characters or fewer.`
  if (input.description.length > LIMITS.description)
    return `Description must be ${LIMITS.description} characters or fewer.`
  if (input.systemPrompt.length > LIMITS.systemPrompt)
    return "System prompt is too long."
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(input.model)) return "Choose a model."
  return null
}

// Pushes the saved Nexus record to Claude. The local row is already saved, so
// a failure only marks it out of sync — the admin's edits are never lost.
async function syncAgent(agentId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, description, system_prompt, model, claude_agent_id")
    .eq("id", agentId)
    .single()
  if (error || !agent) return "Agent not found."

  try {
    const remote = await upsertClaudeAgent(agent)
    await supabase
      .from("agents")
      .update({
        claude_agent_id: remote.id,
        claude_agent_version: remote.version,
        sync_status: "synced",
        sync_error: null,
        synced_at: new Date().toISOString(),
      })
      .eq("id", agentId)
    return null
  } catch (syncError) {
    const message = describeAnthropicError(syncError)
    console.error("Claude agent sync failed", agentId, syncError)
    await supabase
      .from("agents")
      .update({ sync_status: "error", sync_error: message })
      .eq("id", agentId)
    return message
  }
}

export async function createAgent(
  _state: AgentFormState,
  formData: FormData
): Promise<AgentFormState> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can create agents." }

  const input = readAgentForm(formData)
  const invalid = validateAgent(input)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      name: input.name,
      description: input.description || null,
      system_prompt: input.systemPrompt,
      model: input.model,
      created_by: admin.id,
    })
    .select("id")
    .single()
  if (error || !agent)
    return { error: error?.message ?? "Could not save agent." }

  // The edit page shows the sync status, including any failure.
  await syncAgent(agent.id)
  revalidatePath("/admin/agents")
  redirect(`/admin/agents/${agent.id}`)
}

export async function updateAgent(
  agentId: string,
  _state: AgentFormState,
  formData: FormData
): Promise<AgentFormState> {
  if (!(await getAdmin())) return { error: "Only admins can edit agents." }

  const input = readAgentForm(formData)
  const invalid = validateAgent(input)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("agents")
    .update({
      name: input.name,
      description: input.description || null,
      system_prompt: input.systemPrompt,
      model: input.model,
      sync_status: "pending",
    })
    .eq("id", agentId)
    .is("archived_at", null)
    .select("id")
  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Agent not found or archived." }

  const syncError = await syncAgent(agentId)
  revalidatePath("/admin/agents")
  revalidatePath(`/admin/agents/${agentId}`)
  return syncError
    ? { message: "Saved in Nexus, but not synced to Claude.", syncError }
    : { message: "Agent saved and synced to Claude." }
}

export async function retryAgentSync(agentId: string) {
  if (!(await getAdmin())) return { error: "Only admins can sync agents." }

  const syncError = await syncAgent(agentId)
  revalidatePath("/admin/agents")
  revalidatePath(`/admin/agents/${agentId}`)
  return syncError ? { error: syncError } : { ok: true as const }
}

export async function archiveAgent(agentId: string) {
  if (!(await getAdmin())) return { error: "Only admins can archive agents." }

  const supabase = await createClient()
  const { data: agent } = await supabase
    .from("agents")
    .select("claude_agent_id, archived_at")
    .eq("id", agentId)
    .single()
  if (!agent) return { error: "Agent not found." }
  if (agent.archived_at) return { ok: true as const }

  if (agent.claude_agent_id) {
    try {
      await archiveClaudeAgent(agent.claude_agent_id)
    } catch (error) {
      return { error: describeAnthropicError(error) }
    }
  }

  const { error } = await supabase
    .from("agents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", agentId)
  if (error) return { error: error.message }

  revalidatePath("/admin/agents")
  revalidatePath(`/admin/agents/${agentId}`)
  revalidatePath("/admin/users", "layout")
  return { ok: true as const }
}

export async function generateAgentPrompt(input: {
  role: string
  tasks: string
  agentName?: string
}): Promise<{ systemPrompt: string } | { error: string }> {
  if (!(await getAdmin())) return { error: "Only admins can generate prompts." }

  const role = input.role.trim()
  const tasks = input.tasks.trim()
  if (!role || !tasks) return { error: "Describe the role and its tasks." }
  if (role.length > 2_000 || tasks.length > 8_000)
    return { error: "Keep the role and tasks shorter." }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from("company_settings")
    .select(
      "company_name, company_overview, brand_voice, reusable_instructions"
    )
    .single()

  try {
    const result = await generateSystemPrompt({
      role,
      tasks,
      agentName: input.agentName?.trim() || undefined,
      companyName: company?.company_name,
      companyContext: composeCompanyContext(company),
    })
    // Phase 5 records result.inputTokens / outputTokens as a usage event.
    return { systemPrompt: result.systemPrompt }
  } catch (error) {
    console.error("System prompt generation failed", error)
    return { error: describeAnthropicError(error) }
  }
}
