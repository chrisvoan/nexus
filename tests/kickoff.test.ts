import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildKickoffMessage } from "../lib/missions/kickoff.ts"

const base = {
  title: "Founder Content Pack",
  brief: "Create 10 LinkedIn posts for the CEO this month.",
  outputType: "doc" as const,
  webSearch: false,
}

describe("buildKickoffMessage", () => {
  it("ends with the mission brief", () => {
    const message = buildKickoffMessage(base)
    assert.ok(
      message.endsWith(
        "# Mission: Founder Content Pack\n\nCreate 10 LinkedIn posts for the CEO this month."
      )
    )
  })

  it("includes company context and the employee's instructions when present", () => {
    const message = buildKickoffMessage({
      ...base,
      companyContext: "## About Orion\n\nWe build community tools.",
      customInstructions: "Write in first person as Greg.",
    })
    assert.match(message, /# Company context\n\n## About Orion/)
    assert.match(
      message,
      /# Instructions from the employee you are working for\n\nWrite in first person as Greg\./
    )
    // Context comes before the task so the agent reads it first.
    assert.ok(message.indexOf("# Company context") < message.indexOf("# Mission:"))
  })

  it("leaves out empty optional sections", () => {
    const message = buildKickoffMessage({
      ...base,
      companyContext: "   ",
      customInstructions: null,
      knowledgeFiles: [],
    })
    assert.doesNotMatch(message, /Company context|Instructions from|Knowledge files/)
  })

  it("lists mounted knowledge files by their resolved paths", () => {
    const message = buildKickoffMessage({
      ...base,
      knowledgeFiles: [
        { path: "/mnt/session/uploads/workspace/knowledge/Brand.txt", name: "Brand.docx" },
      ],
    })
    assert.match(
      message,
      /- `\/mnt\/session\/uploads\/workspace\/knowledge\/Brand\.txt` \(Brand\.docx\)/
    )
  })

  it("states whether web search is available", () => {
    assert.match(buildKickoffMessage(base), /Web search is turned off/)
    assert.match(
      buildKickoffMessage({ ...base, webSearch: true }),
      /Web search is available/
    )
  })

  it("asks for tab-separated values for a Sheet and Markdown for a Doc or PDF", () => {
    assert.match(
      buildKickoffMessage({ ...base, outputType: "sheet" }),
      /becomes a Google Sheet[\s\S]*tab-separated values/
    )
    assert.match(buildKickoffMessage(base), /becomes a Google Doc[\s\S]*Markdown/)
    assert.match(
      buildKickoffMessage({ ...base, outputType: "pdf" }),
      /becomes a PDF[\s\S]*Markdown/
    )
  })

  it("always asks for the deliverable alone as the final message", () => {
    for (const outputType of ["doc", "sheet", "pdf"] as const)
      assert.match(
        buildKickoffMessage({ ...base, outputType }),
        /final message must be the complete deliverable and nothing else/
      )
  })
})
