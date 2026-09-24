import "server-only"

import Anthropic, { toFile } from "@anthropic-ai/sdk"

import { agentTools } from "@/lib/anthropic/agents"
import { getAnthropicClient } from "@/lib/anthropic/client"

const KNOWLEDGE_DIR = "/workspace/knowledge"

export type KnowledgeText = { name: string; text: string }

export type MountedFile = { path: string; name: string }

export type AgentSessionInput = {
  claudeAgentId: string
  environmentId: string
  title: string
  webSearch: boolean
  metadata: Record<string, string>
  knowledge: KnowledgeText[]
  /** Built after the session exists, because mount paths are only known then. */
  buildKickoff: (files: MountedFile[]) => string
  /** Persist the session id as soon as it exists, so failures stay inspectable. */
  onSessionCreated: (sessionId: string) => Promise<void>
  /** Absolute time (ms since epoch) after which the run is abandoned. */
  deadline: number
}

export type AgentSessionUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export type AgentSessionResult = {
  sessionId: string
  output: string
  usage: AgentSessionUsage
}

/** A run that failed after its session was created. */
export class AgentSessionError extends Error {
  constructor(
    message: string,
    readonly sessionId: string
  ) {
    super(message)
    this.name = "AgentSessionError"
  }
}

// Knowledge is mounted as `<name>.txt`. Names come from Drive, so strip
// anything a path can't hold and de-duplicate so two files called "Notes"
// don't collide.
function knowledgeFilenames(files: KnowledgeText[]) {
  const used = new Set<string>()
  return files.map((file) => {
    const base =
      file.name
        .replace(/\.[a-z0-9]{1,5}$/i, "")
        .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "file"
    let name = `${base}.txt`
    for (let suffix = 2; used.has(name.toLowerCase()); suffix++)
      name = `${base} (${suffix}).txt`
    used.add(name.toLowerCase())
    return name
  })
}

async function uploadKnowledge(files: KnowledgeText[]) {
  const client = getAnthropicClient()
  const filenames = knowledgeFilenames(files)
  const uploaded: { fileId: string; filename: string; name: string }[] = []
  try {
    for (const [index, file] of files.entries()) {
      const filename = filenames[index]
      const result = await client.files.upload({
        file: await toFile(Buffer.from(file.text, "utf-8"), filename, {
          type: "text/plain",
        }),
      })
      uploaded.push({ fileId: result.id, filename, name: file.name })
    }
    return uploaded
  } catch (error) {
    await deleteFiles(uploaded.map((file) => file.fileId))
    throw error
  }
}

// Sessions mount their own copy of each file, so the uploaded originals are
// only needed until the session exists.
async function deleteFiles(fileIds: string[]) {
  const client = getAnthropicClient()
  await Promise.all(
    fileIds.map((fileId) =>
      client.files.delete(fileId).catch((error) => {
        console.error("Could not delete uploaded knowledge file", fileId, error)
      })
    )
  )
}

/**
 * Runs one mission as a Managed Agents session: mounts the knowledge files,
 * sends the kickoff, and drains the event stream until the agent finishes.
 *
 * The session is never archived, so it stays inspectable in the Console.
 */
export async function runAgentSession(
  input: AgentSessionInput
): Promise<AgentSessionResult> {
  const client = getAnthropicClient()
  const uploaded = await uploadKnowledge(input.knowledge)

  let session: Anthropic.Beta.Sessions.BetaManagedAgentsSession
  try {
    session = await client.beta.sessions.create({
      // A mission with web search off gets a session-only tool override, so
      // the agent genuinely cannot search rather than merely being asked not to.
      agent: input.webSearch
        ? input.claudeAgentId
        : {
            type: "agent_with_overrides",
            id: input.claudeAgentId,
            tools: agentTools({ web: false }),
          },
      environment_id: input.environmentId,
      title: input.title.slice(0, 200),
      metadata: input.metadata,
      resources: uploaded.map((file) => ({
        type: "file" as const,
        file_id: file.fileId,
        mount_path: `${KNOWLEDGE_DIR}/${file.filename}`,
      })),
    })
  } finally {
    await deleteFiles(uploaded.map((file) => file.fileId))
  }

  await input.onSessionCreated(session.id)

  try {
    return await drainSession(session, uploaded, input)
  } catch (error) {
    if (error instanceof AgentSessionError) throw error
    throw new AgentSessionError(describeSessionError(error), session.id)
  }
}

// The API may re-root the requested mount path, so the agent is told the
// paths the session actually reports rather than the ones we asked for.
function mountedFiles(
  session: Anthropic.Beta.Sessions.BetaManagedAgentsSession,
  uploaded: { filename: string; name: string }[]
): MountedFile[] {
  const mounts = session.resources.flatMap((resource) =>
    resource.type === "file" ? [resource.mount_path] : []
  )
  return uploaded.map((file, index) => ({
    name: file.name,
    path:
      mounts.find((path) => path.endsWith(`/${file.filename}`)) ??
      mounts[index] ??
      `${KNOWLEDGE_DIR}/${file.filename}`,
  }))
}

type SessionEvent =
  | Anthropic.Beta.Sessions.BetaManagedAgentsSessionEvent
  | Anthropic.Beta.Sessions.BetaManagedAgentsStreamSessionEvents

// A dropped event stream is reopened this many times. Each reconnect replays
// the session's history first, so no event is lost in the gap.
const MAX_RECONNECTS = 3

async function drainSession(
  session: Anthropic.Beta.Sessions.BetaManagedAgentsSession,
  uploaded: { filename: string; name: string }[],
  input: AgentSessionInput
): Promise<AgentSessionResult> {
  const client = getAnthropicClient()
  const kickoff = input.buildKickoff(mountedFiles(session, uploaded))

  const usage: AgentSessionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  }
  // Agent text is grouped into segments split by tool calls. The kickoff asks
  // for the deliverable as the final message, so the last segment is the
  // output and earlier ones are working notes.
  const segments: string[][] = [[]]
  const seen = new Set<string>()
  let lastError: string | null = null
  // Idle only means "finished" once the agent has picked up the kickoff; a
  // replayed history can include the idle from before it was sent.
  let started = false

  const fail = (message: string) => new AgentSessionError(message, session.id)

  async function apply(event: SessionEvent) {
    switch (event.type) {
      case "user.message":
        if (event.processed_at) started = true
        break

      case "agent.message":
        started = true
        for (const block of event.content)
          if (block.type === "text") segments[segments.length - 1].push(block.text)
        break

      case "agent.tool_use":
      case "agent.mcp_tool_use":
        started = true
        if (segments[segments.length - 1].length) segments.push([])
        // Nexus agents are company-configured and run unattended; approve
        // anything the permission policy leaves to the caller. A replayed,
        // already-answered request is rejected harmlessly.
        if (event.evaluated_permission === "ask")
          await client.beta.sessions.events
            .send(session.id, {
              events: [
                { type: "user.tool_confirmation", tool_use_id: event.id, result: "allow" },
              ],
            })
            .catch((error) => console.error("Tool confirmation failed", error))
        break

      case "agent.custom_tool_use":
        throw fail(`The agent called a custom tool ("${event.name}") that Nexus can't run.`)

      case "span.model_request_end":
        started = true
        usage.inputTokens += event.model_usage.input_tokens
        usage.outputTokens += event.model_usage.output_tokens
        usage.cacheReadInputTokens += event.model_usage.cache_read_input_tokens
        usage.cacheCreationInputTokens += event.model_usage.cache_creation_input_tokens
        break

      case "session.error":
        lastError = event.error.message
        break
    }
  }

  /** Applies an event once, and reports whether the run is over. */
  async function handle(event: SessionEvent) {
    // Streaming previews and deltas carry no id; the finished event follows.
    if (!("id" in event)) return false
    if (!seen.has(event.id)) {
      seen.add(event.id)
      await apply(event)
    }

    if (event.type === "session.status_terminated")
      throw fail(lastError ?? "The session was terminated before the agent finished.")
    if (event.type !== "session.status_idle" || !started) return false

    switch (event.stop_reason.type) {
      case "requires_action":
        return false
      case "retries_exhausted":
        throw fail(lastError ?? "The agent stopped after repeated errors.")
      case "budget_reached":
        throw fail("The session reached its spending limit before finishing.")
      default:
        return true
    }
  }

  let timedOut = false
  const controller = new AbortController()
  const timer = setTimeout(
    () => {
      timedOut = true
      controller.abort()
    },
    Math.max(input.deadline - Date.now(), 1_000)
  )
  const options = { signal: controller.signal }

  try {
    for (let attempt = 0; ; attempt++) {
      // Stream first, then send (or replay), so nothing slips through the gap.
      const stream = await client.beta.sessions.events.stream(session.id, {}, options)

      let finished = false
      if (attempt === 0) {
        await client.beta.sessions.events.send(
          session.id,
          { events: [{ type: "user.message", content: [{ type: "text", text: kickoff }] }] },
          options
        )
      } else {
        for await (const event of client.beta.sessions.events.list(
          session.id,
          { order: "asc" },
          options
        ))
          if ((finished = await handle(event))) break
      }

      if (!finished)
        for await (const event of stream)
          if ((finished = await handle(event))) break

      if (finished) break
      if (attempt >= MAX_RECONNECTS)
        throw fail("Lost the connection to the agent before it finished.")
      console.warn("Session stream ended early; reconnecting", session.id)
    }
  } catch (error) {
    if (timedOut) {
      // Stop the agent so it doesn't keep spending on a run nobody will see.
      await client.beta.sessions.events
        .send(session.id, { events: [{ type: "user.interrupt" }] })
        .catch(() => {})
      throw fail(
        "The agent took too long and was stopped. Try a narrower brief, or turn off web search."
      )
    }
    throw error
  } finally {
    clearTimeout(timer)
    controller.abort()
  }

  const output = pickOutput(segments)
  if (!output)
    throw fail(lastError ?? "The agent finished without producing any output.")

  return { sessionId: session.id, output, usage }
}

function pickOutput(segments: string[][]) {
  const texts = segments
    .map((segment) => segment.join("").trim())
    .filter(Boolean)
  return texts[texts.length - 1] ?? ""
}

export function describeSessionError(error: unknown) {
  if (error instanceof AgentSessionError) return error.message
  if (error instanceof Anthropic.NotFoundError)
    return "Claude couldn't find the agent or runtime environment. Ask an admin to re-save the agent and check Integrations."
  if (error instanceof Anthropic.AuthenticationError)
    return "Anthropic rejected the API key. Ask an admin to check ANTHROPIC_API_KEY."
  if (error instanceof Anthropic.PermissionDeniedError)
    return "This Anthropic API key can't use Managed Agents."
  if (error instanceof Anthropic.RateLimitError)
    return "Anthropic rate limit reached. Try again shortly."
  if (error instanceof Anthropic.APIError)
    return `Anthropic API error${error.status ? ` ${error.status}` : ""}: ${error.message}`
  if (error instanceof Error) return error.message
  return "Unknown error while running the agent."
}
