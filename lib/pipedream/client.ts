import "server-only"

import { PipedreamClient, PipedreamError } from "@pipedream/sdk/server"

// Google's tokens live inside Pipedream; Nexus only ever holds an account id.
// These three are secrets — never expose them, and never import this module
// from a client component.
const PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID
const CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID
const CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET

export const PIPEDREAM_NOT_CONFIGURED =
  "Pipedream is not configured. Set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET, then restart the dev server."

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

const PROXY_TIMEOUT_MS = 60_000

/**
 * POSTs a raw (non-JSON) body through the Connect proxy and returns the
 * upstream's JSON response. The SDK's `proxy.post` only sends JSON, which
 * rules out Drive's multipart uploads; this calls the same endpoint with the
 * same credentials.
 */
export async function proxyPostRaw(request: {
  url: string
  externalUserId: string
  accountId: string
  body: Buffer
  contentType: string
}): Promise<unknown> {
  const client = getPipedreamClient()
  const target = Buffer.from(request.url).toString("base64")
  const endpoint = new URL(
    `https://api.pipedream.com/v1/connect/${encodeURIComponent(PROJECT_ID!)}/proxy/${encodeURIComponent(target)}`
  )
  endpoint.searchParams.set("external_user_id", request.externalUserId)
  endpoint.searchParams.set("account_id", request.accountId)

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await client.rawAccessToken}`,
      "x-pd-environment": projectEnvironment(),
      "Content-Type": request.contentType,
    },
    body: new Uint8Array(request.body),
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  })

  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // Not JSON; keep the text for the error message.
  }
  if (!response.ok)
    throw new PipedreamError({
      message: `Status code: ${response.status} Body: ${text.slice(0, 500)}`,
      statusCode: response.status,
      body,
    })
  return body
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
