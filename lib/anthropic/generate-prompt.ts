import "server-only"

import { getAnthropicClient } from "@/lib/anthropic/client"

const GENERATOR_MODEL = "claude-opus-5"

const GENERATOR_SYSTEM = `You write system prompts for AI agents that employees of one company run to produce work documents (Google Docs, Sheets, PDFs).

Write the system prompt in second person ("You are…"), in Markdown, with short sections covering: the agent's role and purpose, the tasks it handles and how to approach them, how to use the company context, output quality standards, and when to ask for clarification versus making a reasonable assumption.

If company context is provided, the agent receives it verbatim with every task, under the same headings you see it here ("About the company", "Brand voice", "Standing instructions"). Reference those sections rather than restating or paraphrasing them, but use them to make the role specific to this company.

Return only the system prompt itself, with no preamble or commentary.`

export type GeneratePromptInput = {
  role: string
  tasks: string
  agentName?: string
  companyName?: string | null
  // Markdown from composeCompanyContext(); passed through verbatim.
  companyContext?: string | null
}

export type GeneratePromptResult = {
  systemPrompt: string
  model: string
  inputTokens: number
  outputTokens: number
}

export async function generateSystemPrompt(
  input: GeneratePromptInput
): Promise<GeneratePromptResult> {
  const parts = [
    input.agentName && `## Agent name\n\n${input.agentName}`,
    `## Role\n\n${input.role}`,
    `## Tasks\n\n${input.tasks}`,
    input.companyName && `## Company\n\n${input.companyName}`,
    input.companyContext && `# Company context\n\n${input.companyContext}`,
  ].filter(Boolean)

  const response = await getAnthropicClient().beta.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // Re-run declined requests on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: GENERATOR_SYSTEM,
    messages: [{ role: "user", content: parts.join("\n\n") }],
  })

  if (response.stop_reason === "refusal")
    throw new Error(
      "Claude declined to generate this prompt. Try rephrasing the role or tasks."
    )

  const systemPrompt = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim()
  if (!systemPrompt)
    throw new Error("Claude returned an empty prompt. Try again.")

  return {
    systemPrompt,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
