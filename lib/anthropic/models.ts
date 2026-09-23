import "server-only"

import { cache } from "react"

import { getAnthropicClient } from "@/lib/anthropic/client"

export type ModelOption = { id: string; label: string }

export const DEFAULT_AGENT_MODEL = "claude-opus-5"

// Used when the Models API is unreachable so the form still works.
const FALLBACK_MODELS: ModelOption[] = [
  { id: "claude-opus-5", label: "Claude Opus 5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
]

// Managed Agents needs a current-generation model; hide Claude 3.x.
function isAgentCapable(id: string) {
  return !id.startsWith("claude-3")
}

export const listModels = cache(async (): Promise<ModelOption[]> => {
  try {
    const models: ModelOption[] = []
    for await (const model of getAnthropicClient().models.list({
      limit: 100,
    })) {
      if (isAgentCapable(model.id))
        models.push({ id: model.id, label: model.display_name })
    }
    return models.length ? models : FALLBACK_MODELS
  } catch (error) {
    console.error("Failed to list Anthropic models", error)
    return FALLBACK_MODELS
  }
})

// Keep an agent's saved model selectable even if the account no longer lists it.
export function withModel(models: ModelOption[], id: string) {
  return models.some((model) => model.id === id)
    ? models
    : [{ id, label: id }, ...models]
}
