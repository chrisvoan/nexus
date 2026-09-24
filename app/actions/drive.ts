"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { userExternalUserId } from "@/lib/drive/connection"
import { isMissingSchema } from "@/lib/missions/queries"
import {
  describePipedreamError,
  isPipedreamConfigured,
  PIPEDREAM_NOT_CONFIGURED,
} from "@/lib/pipedream/client"
import {
  createConnectToken,
  deleteDriveAccounts,
  findNewestDriveAccount,
  type ConnectToken,
} from "@/lib/pipedream/connect"
import { createClient } from "@/lib/supabase/server"

// The employee's own Google Drive, where their mission outputs are saved.
// The company Drive (agent knowledge) is managed in app/actions/integrations.

type ActionResult<T = unknown> = ({ ok: true } & T) | { error: string }

const MISSING_TABLE =
  "Personal Drive connections aren't set up yet. Ask an admin to apply supabase/migrations/008_user_drive_connections.sql."

export async function createMyDriveConnectToken(): Promise<
  ActionResult<ConnectToken>
> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  if (!isPipedreamConfigured()) return { error: PIPEDREAM_NOT_CONFIGURED }

  try {
    return {
      ok: true,
      ...(await createConnectToken(userExternalUserId(user.id))),
    }
  } catch (error) {
    console.error("Pipedream connect token failed", error)
    return { error: describePipedreamError(error) }
  }
}

/** Records the employee's connection after the OAuth dialog closes. */
export async function completeMyDriveConnection(): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }

  let account
  try {
    account = await findNewestDriveAccount(userExternalUserId(user.id))
  } catch (error) {
    console.error("Pipedream account lookup failed", error)
    return { error: describePipedreamError(error) }
  }
  if (!account)
    return { error: "Pipedream has no connected Google Drive account yet." }

  const supabase = await createClient()
  const { error } = await supabase.from("user_drive_connections").upsert(
    {
      user_id: user.id,
      pipedream_account_id: account.id,
      account_name: account.name ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error)
    return { error: isMissingSchema(error) ? MISSING_TABLE : error.message }

  // Reconnecting leaves the earlier accounts behind at Pipedream; only the
  // one just saved is ever used.
  try {
    await deleteDriveAccounts(userExternalUserId(user.id), { keep: account.id })
  } catch (cleanupError) {
    console.error("Stale Drive account cleanup failed", cleanupError)
  }

  revalidateMyDrive()
  return { ok: true }
}

/**
 * Clears the employee's connection and revokes it at Pipedream. As with the
 * company Drive, the local record is cleared even if the remote delete fails.
 */
export async function disconnectMyDrive(): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("user_drive_connections")
    .delete()
    .eq("user_id", user.id)
  if (error)
    return { error: isMissingSchema(error) ? MISSING_TABLE : error.message }

  try {
    await deleteDriveAccounts(userExternalUserId(user.id))
  } catch (deleteError) {
    console.error("Pipedream account delete failed", deleteError)
  }

  revalidateMyDrive()
  return { ok: true }
}

function revalidateMyDrive() {
  revalidatePath("/settings")
  // The mission dialog says where outputs will be saved.
  revalidatePath("/missions", "layout")
}
