// Builds the first user message of a mission session. The agent's own system
// prompt already lives on the Claude agent; everything that varies per run —
// company context, the employee's instructions, mounted files, the output
// format, and the brief — goes here.
//
// Pure and import-free (type imports are erased) so it can be unit-tested
// with Node's built-in runner.

import type { MissionOutputType } from "@/lib/types/database"

export type KickoffInput = {
  title: string
  brief: string
  outputType: MissionOutputType
  webSearch: boolean
  /** Markdown from composeCompanyContext(); omitted when empty. */
  companyContext?: string | null
  /** The employee's personal instructions for this agent. */
  customInstructions?: string | null
  /** Resolved container paths of the mounted knowledge files. */
  knowledgeFiles?: { path: string; name: string }[]
}

const DELIVERABLE_RULE =
  "When you have finished, your final message must be the complete deliverable and nothing else: no preamble, no summary of what you did, no offer of further help. Anything you write before that final message is discarded."

function outputInstruction(type: MissionOutputType, title: string) {
  switch (type) {
    case "sheet":
      return [
        `Your final message becomes a Google Sheet titled "${title}".`,
        "Write it as tab-separated values: the first line is the header row, then one row per line, with a tab character between cells.",
        "Do not use Markdown, code fences, or blank lines, and keep every row on a single line.",
      ].join(" ")
    case "pdf":
      return [
        `Your final message becomes a PDF titled "${title}".`,
        "Write it in Markdown: # headings, - bullet lists, 1. numbered lists, **bold** and *italic*. Keep tables simple, one row per line.",
      ].join(" ")
    case "doc":
      return [
        `Your final message becomes a Google Doc titled "${title}".`,
        "Write it in Markdown: # headings, - bullet lists, 1. numbered lists, **bold** and *italic*. Keep tables simple, one row per line.",
      ].join(" ")
  }
}

export function buildKickoffMessage(input: KickoffInput) {
  const sections: string[] = []

  const companyContext = input.companyContext?.trim()
  if (companyContext) sections.push(`# Company context\n\n${companyContext}`)

  const customInstructions = input.customInstructions?.trim()
  if (customInstructions)
    sections.push(
      `# Instructions from the employee you are working for\n\n${customInstructions}`
    )

  if (input.knowledgeFiles?.length) {
    const list = input.knowledgeFiles
      .map((file) => `- \`${file.path}\` (${file.name})`)
      .join("\n")
    sections.push(
      `# Knowledge files\n\nThese reference files are mounted in your workspace. Read the ones relevant to the task before you start:\n\n${list}`
    )
  }

  sections.push(
    `# Tools\n\n${
      input.webSearch
        ? "Web search is available. Use it when current or external information would improve the result, and prefer primary sources."
        : "Web search is turned off for this mission. Work from the company context, the knowledge files, and what you already know."
    }`
  )

  sections.push(
    `# Output format\n\n${outputInstruction(input.outputType, input.title)}\n\n${DELIVERABLE_RULE}`
  )

  sections.push(`# Mission: ${input.title}\n\n${input.brief.trim()}`)

  return sections.join("\n\n")
}
