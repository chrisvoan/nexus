"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { getAdmin } from "@/lib/auth"
import { ORG_EXTERNAL_USER_ID } from "@/lib/drive/connection"
import { GOOGLE_DRIVE_APP_SLUG } from "@/lib/drive/types"
import {
  describePipedreamError,
  getPipedreamClient,
  isPipedreamConfigured,
} from "@/lib/pipedream/client"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T = unknown> = ({ ok: true } & T) | { error: string }

// There should only ever be one, but the listing is paginated; stop early
// rather than walking a long history.
const MAX_ACCOUNTS_SCANNED = 20

/**
 * A short-lived Connect token the browser SDK uses to open the Google OAuth
 * dialog. Client credentials stay on the server; the token only ever
 * authorises this one external user.
 */
export async function createDriveConnectToken(): Promise<
  ActionResult<{ token: string; expiresAt: string; externalUserId: string }>
> {
  if (!(await getAdmin()))
    return { error: "Only admins can connect Google Drive." }
  if (!isPipedreamConfigured())
    return {
      error:
        "Pipedream is not configured. Set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET, then restart the dev server.",
    }

  try {
    const origin = await requestOrigin()
    const response = await getPipedreamClient().tokens.create({
      externalUserId: ORG_EXTERNAL_USER_ID,
      ...(origin ? { allowedOrigins: [origin] } : {}),
    })
    return {
      ok: true,
      token: response.token,
      expiresAt: new Date(response.expiresAt).toISOString(),
      externalUserId: ORG_EXTERNAL_USER_ID,
    }
  } catch (error) {
    console.error("Pipedream connect token failed", error)
    return { error: describePipedreamError(error) }
  }
}

// Locks the token to the origin the admin is actually on, which beats
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

/**
 * Records the connection after the OAuth dialog closes. The account id from
 * the browser is not trusted: it is re-read from Pipedream so a tampered
 * client cannot point the company at someone else's Drive.
 */
export async function completeDriveConnection(): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can connect Google Drive." }

  let accountId: string
  try {
    // Pipedream does not hand back an account id when the dialog closes, so
    // the newest live Google Drive account for this external user wins.
    const page = await getPipedreamClient().accounts.list({
      externalUserId: ORG_EXTERNAL_USER_ID,
      app: GOOGLE_DRIVE_APP_SLUG,
    })
    const accounts = []
    for await (const account of page) {
      if (!account.dead) accounts.push(account)
      if (accounts.length >= MAX_ACCOUNTS_SCANNED) break
    }

    const newest = accounts.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    )[0]
    if (!newest)
      return { error: "Pipedream has no connected Google Drive account yet." }
    accountId = newest.id
  } catch (error) {
    console.error("Pipedream account lookup failed", error)
    return { error: describePipedreamError(error) }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("company_settings")
    .update({
      pipedream_account_id: accountId,
      pipedream_external_user_id: ORG_EXTERNAL_USER_ID,
      pipedream_connected_by: admin.id,
      pipedream_connected_at: new Date().toISOString(),
    })
    .eq("id", true)
  if (error) return { error: error.message }

  revalidateIntegrations()
  return { ok: true }
}

/**
 * Clears the connection and revokes it at Pipedream. The local record is
 * cleared even if the remote delete fails, so an admin is never stuck with a
 * connection the app believes in but Pipedream has dropped.
 */
export async function disconnectDrive(): Promise<ActionResult> {
  if (!(await getAdmin()))
    return { error: "Only admins can disconnect Google Drive." }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from("company_settings")
    .select("pipedream_account_id")
    .maybeSingle()

  const { error } = await supabase
    .from("company_settings")
    .update({
      pipedream_account_id: null,
      pipedream_external_user_id: null,
      pipedream_connected_by: null,
      pipedream_connected_at: null,
    })
    .eq("id", true)
  if (error) return { error: error.message }

  if (company?.pipedream_account_id) {
    try {
      await getPipedreamClient().accounts.delete(company.pipedream_account_id)
    } catch (deleteError) {
      // Already gone remotely, or Pipedream is unreachable: the app-side
      // connection is cleared either way.
      console.error("Pipedream account delete failed", deleteError)
    }
  }

  revalidateIntegrations()
  return { ok: true }
}

function revalidateIntegrations() {
  revalidatePath("/admin/integrations")
  // The agent editor's knowledge picker shows a disconnected state.
  revalidatePath("/admin/agents", "layout")
}
