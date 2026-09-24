import "server-only"

import { getAnthropicClient } from "@/lib/anthropic/client"

const ENVIRONMENT_NAME = "nexus-missions"

/**
 * Creates the one cloud Environment every mission Session runs in. Called
 * once per workspace from Integrations; the id is stored on company_settings.
 *
 * Networking is unrestricted so agents can install packages in their
 * container. Web search and web fetch run on Anthropic's side and are
 * governed per mission by the session's tool override, not by this setting.
 */
export async function createMissionEnvironment() {
  const environment = await getAnthropicClient().beta.environments.create({
    name: ENVIRONMENT_NAME,
    description: "Shared runtime for Nexus mission sessions.",
    config: { type: "cloud", networking: { type: "unrestricted" } },
    metadata: { app: "nexus" },
  })
  return environment.id
}
