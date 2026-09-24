"use server"

import { revalidatePath } from "next/cache"

import { describeAnthropicError } from "@/lib/anthropic/agents"
import { createMissionEnvironment } from "@/lib/anthropic/environment"
import { getAdmin } from "@/lib/auth"
import { ORG_EXTERNAL_USER_ID } from "@/lib/drive/connection"
import { isMissingSchema } from "@/lib/missions/queries"
import {
  describePipedreamError,
  getPipedreamClient,
  isPipedreamConfigured,
  PIPEDREAM_NOT_CONFIGURED,
} from "@/lib/pipedream/client"
import {
  createConnectToken,
  findNewestDriveAccount,
  type ConnectToken,
} from "@/lib/pipedream/connect"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T = unknown> = ({ ok: true } & T) | { error: string }

export async function createDriveConnectToken(): Promise<
  ActionResult<ConnectToken>
> {
  if (!(await getAdmin()))
    return { error: "Only admins can connect Google Drive." }
  if (!isPipedreamConfigured()) return { error: PIPEDREAM_NOT_CONFIGURED }

  try {
    return { ok: true, ...(await createConnectToken(ORG_EXTERNAL_USER_ID)) }
  } catch (error) {
    console.error("Pipedream connect token failed", error)
    return { error: describePipedreamError(error) }
  }
}

/** Records the connection after the OAuth dialog closes. */
export async function completeDriveConnection(): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can connect Google Drive." }

  let accountId: string
  try {
    const account = await findNewestDriveAccount(ORG_EXTERNAL_USER_ID)
    if (!account)
      return { error: "Pipedream has no connected Google Drive account yet." }
    accountId = account.id
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

/**
 * Creates the shared Managed Agents environment that mission sessions run
 * in. Replaces any existing one: the old environment is left in the Console
 * (sessions that ran in it still reference it) and simply stops being used.
 */
export async function createAgentEnvironment(): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can set up the agent runtime." }

  // Check the column exists before creating anything at Anthropic, so a
  // missing migration can't leave an environment nobody has recorded.
  const supabase = await createClient()
  const { error: schemaError } = await supabase
    .from("company_settings")
    .select("anthropic_environment_id")
    .maybeSingle()
  if (schemaError)
    return {
      error: isMissingSchema(schemaError)
        ? "Apply supabase/migrations/006_missions.sql in the Supabase SQL Editor first."
        : schemaError.message,
    }

  let environmentId: string
  try {
    environmentId = await createMissionEnvironment()
  } catch (error) {
    console.error("Environment creation failed", error)
    return { error: describeAnthropicError(error) }
  }

  // Update, not upsert: an upsert is checked against the insert policy even
  // when the row exists, and that policy only arrives with migration 004.
  const row = { anthropic_environment_id: environmentId, updated_by: admin.id }
  const { data, error } = await supabase
    .from("company_settings")
    .update(row)
    .eq("id", true)
    .select("id")
  if (error) return { error: error.message }

  // The singleton row is seeded by migration 002; recreate it if it went
  // missing (needs migration 004), as the Company page does.
  if (!data?.length) {
    const { error: insertError } = await supabase
      .from("company_settings")
      .insert({ id: true, ...row })
    if (insertError) return { error: insertError.message }
  }

  revalidatePath("/admin/integrations")
  return { ok: true }
}
