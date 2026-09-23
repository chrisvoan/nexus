import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { getAnthropicClient } from "@/lib/anthropic/client"
import type { Agent } from "@/lib/types/database"

// Sessions (Phase 4) need the toolset to read mounted knowledge files, run
// bash, and search the web. Always send it so every agent version carries it.
const AGENT_TOOLS = [
  {
    type: "agent_toolset_20260401" as const,
    default_config: { enabled: true },
  },
]

type SyncableAgent = Pick<
  Agent,
  "id" | "name" | "description" | "system_prompt" | "model" | "claude_agent_id"
>

export type ClaudeAgentRef = { id: string; version: number }

// Creates the Claude Managed Agent, or updates it in place. Nexus is the
// source of truth, so updates apply unconditionally (no version check).
export async function upsertClaudeAgent(
  agent: SyncableAgent
): Promise<ClaudeAgentRef> {
  const client = getAnthropicClient()
  const fields = {
    name: agent.name,
    description: agent.description || null,
    system: agent.system_prompt || null,
    model: agent.model,
    tools: AGENT_TOOLS,
  }

  const remote = agent.claude_agent_id
    ? await client.beta.agents.update(agent.claude_agent_id, fields)
    : await client.beta.agents.create({
        ...fields,
        metadata: { nexus_agent_id: agent.id },
      })

  return { id: remote.id, version: remote.version }
}

export async function archiveClaudeAgent(claudeAgentId: string) {
  try {
    await getAnthropicClient().beta.agents.archive(claudeAgentId)
  } catch (error) {
    // Already gone remotely — nothing left to archive.
    if (error instanceof Anthropic.NotFoundError) return
    throw error
  }
}

export function describeAnthropicError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError)
    return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY."
  if (error instanceof Anthropic.PermissionDeniedError)
    return "This Anthropic API key can't use Managed Agents."
  if (error instanceof Anthropic.RateLimitError)
    return "Anthropic rate limit reached. Try again shortly."
  if (error instanceof Anthropic.APIError)
    return `Anthropic API error${error.status ? ` ${error.status}` : ""}: ${error.message}`
  if (error instanceof Error) return error.message
  return "Unknown error talking to Anthropic."
}
