import "server-only"

import { PipedreamClient, PipedreamError } from "@pipedream/sdk/server"

// Google's tokens live inside Pipedream; Nexus only ever holds an account id.
// These three are secrets — never expose them, and never import this module
// from a client component.
const PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID
const CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID
const CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET

export function isPipedreamConfigured() {
  return Boolean(PROJECT_ID && CLIENT_ID && CLIENT_SECRET)
}

function projectEnvironment() {
  return process.env.PIPEDREAM_ENVIRONMENT === "production"
    ? "production"
    : "development"
}

let client: PipedreamClient | null = null

export function getPipedreamClient() {
  if (!PROJECT_ID || !CLIENT_ID || !CLIENT_SECRET)
    throw new Error(
      "Pipedream is not configured. Set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET."
    )

  client ??= new PipedreamClient({
    projectId: PROJECT_ID,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    projectEnvironment: projectEnvironment(),
  })
  return client
}

export function describePipedreamError(error: unknown) {
  if (error instanceof PipedreamError) {
    if (error.statusCode === 401 || error.statusCode === 403)
      return "Pipedream rejected the request. Check the Connect credentials and that the Drive account is still authorised."
    if (error.statusCode === 404)
      return "Pipedream could not find that connected account. Reconnect Google Drive."
    if (error.statusCode === 429)
      return "Pipedream rate limit reached. Try again shortly."
    return `Pipedream error${error.statusCode ? ` ${error.statusCode}` : ""}: ${error.message}`
  }
  if (error instanceof Error) return error.message
  return "Unknown error talking to Pipedream."
}
