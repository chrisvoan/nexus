import "server-only"

import type { Account } from "@pipedream/sdk/server"
import { headers } from "next/headers"

import { GOOGLE_DRIVE_APP_SLUG } from "@/lib/drive/types"
import { getPipedreamClient } from "@/lib/pipedream/client"

// There should only ever be one per external user, but the listing is
// paginated; stop early rather than walking a long history.
const MAX_ACCOUNTS_SCANNED = 20

export type ConnectToken = {
  token: string
  expiresAt: string
  externalUserId: string
}

/**
 * A short-lived Connect token the browser SDK uses to open the Google OAuth
 * dialog. Client credentials stay on the server; the token only ever
 * authorises this one external user.
 */
export async function createConnectToken(
  externalUserId: string
): Promise<ConnectToken> {
  const origin = await requestOrigin()
  const response = await getPipedreamClient().tokens.create({
    externalUserId,
    ...(origin ? { allowedOrigins: [origin] } : {}),
  })
  return {
    token: response.token,
    expiresAt: new Date(response.expiresAt).toISOString(),
    externalUserId,
  }
}

// Locks the token to the origin the user is actually on, which beats
// NEXT_PUBLIC_APP_URL: dev servers move ports, and preview deploys get their
// own hostname. Next.js already validates this header against the host.
async function requestOrigin() {
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")
  if (origin) return origin

  const host = requestHeaders.get("host")
  if (!host) return null
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

async function listDriveAccounts(externalUserId: string) {
  const page = await getPipedreamClient().accounts.list({
    externalUserId,
    app: GOOGLE_DRIVE_APP_SLUG,
  })
  const accounts: Account[] = []
  for await (const account of page) {
    accounts.push(account)
    if (accounts.length >= MAX_ACCOUNTS_SCANNED) break
  }
  return accounts
}

/**
 * The account the OAuth dialog just created. Pipedream does not hand back an
 * account id when the dialog closes, so the newest live Google Drive account
 * for this external user wins. Read from Pipedream rather than trusted from
 * the browser, so a tampered client cannot substitute someone else's Drive.
 */
export async function findNewestDriveAccount(
  externalUserId: string
): Promise<Account | null> {
  const accounts = await listDriveAccounts(externalUserId)
  return (
    accounts
      .filter((account) => !account.dead)
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      )[0] ?? null
  )
}

/**
 * Revokes the Google Drive accounts under this external user, except `keep`
 * when given, which clears out stale ones from earlier connections. Looked
 * up by external user rather than by a stored account id, so it can only ever
 * touch that user's accounts.
 */
export async function deleteDriveAccounts(
  externalUserId: string,
  options: { keep?: string } = {}
) {
  const accounts = await listDriveAccounts(externalUserId)
  await Promise.all(
    accounts
      .filter((account) => account.id !== options.keep)
      .map((account) => getPipedreamClient().accounts.delete(account.id))
  )
}
