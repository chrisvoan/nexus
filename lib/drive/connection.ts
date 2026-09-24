import "server-only"

import type { DriveTarget } from "@/lib/drive/types"
import { createClient } from "@/lib/supabase/server"

// The Drive connection belongs to the company, not to the admin who created
// it, so every Pipedream call for this workspace uses one external user id.
// Whoever connected it can leave without taking the connection with them.
export const ORG_EXTERNAL_USER_ID = "nexus-org"

export type DriveConnection = {
  accountId: string
  externalUserId: string
}

export type DriveConnectionStatus = {
  connection: DriveConnection | null
  connectedAt: string | null
  connectedByName: string | null
}

const CONNECTION_COLUMNS =
  "pipedream_account_id, pipedream_external_user_id, pipedream_connected_by, pipedream_connected_at"

/**
 * The org Drive connection, or null when Drive has not been connected yet.
 * Readable by any signed-in user because mission runs mount agent knowledge
 * on behalf of the employee running them.
 */
export async function getDriveConnection(): Promise<DriveConnection | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("company_settings")
    .select(CONNECTION_COLUMNS)
    .maybeSingle()

  if (!data?.pipedream_account_id) return null
  return {
    accountId: data.pipedream_account_id,
    // Older rows predate the column; they were connected under the constant.
    externalUserId: data.pipedream_external_user_id ?? ORG_EXTERNAL_USER_ID,
  }
}

/**
 * Each employee's own Drive lives under an external user id derived from
 * their user id. It is never read back from the database, so a tampered row
 * can't borrow an account connected under someone else's id.
 */
export function userExternalUserId(userId: string) {
  return `nexus-user-${userId}`
}

export type UserDriveStatus = {
  connection: DriveConnection | null
  accountName: string | null
  connectedAt: string | null
}

/** The employee's own Drive, plus what the Settings page displays. */
export async function getUserDriveStatus(
  userId: string
): Promise<UserDriveStatus> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_drive_connections")
    .select("pipedream_account_id, account_name, connected_at")
    .eq("user_id", userId)
    .maybeSingle()

  // A missing table (migration 008 not applied) reads as "not connected".
  if (!data) return { connection: null, accountName: null, connectedAt: null }
  return {
    connection: {
      accountId: data.pipedream_account_id,
      externalUserId: userExternalUserId(userId),
    },
    accountName: data.account_name,
    connectedAt: data.connected_at,
  }
}

export type OutputDrive = {
  connection: DriveConnection
  target: DriveTarget
}

/**
 * Where this employee's mission outputs are saved: their own Drive when they
 * have connected one, otherwise the company Drive, otherwise nowhere (the
 * output stays in Nexus).
 */
export async function getOutputDrive(
  userId: string
): Promise<OutputDrive | null> {
  const [personal, company] = await Promise.all([
    getUserDriveStatus(userId),
    getDriveConnection(),
  ])
  if (personal.connection)
    return { connection: personal.connection, target: "personal" }
  if (company) return { connection: company, target: "company" }
  return null
}

/** Connection plus the "who and when" the Integrations page displays. */
export async function getDriveConnectionStatus(): Promise<DriveConnectionStatus> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("company_settings")
    .select(CONNECTION_COLUMNS)
    .maybeSingle()

  if (!data?.pipedream_account_id)
    return { connection: null, connectedAt: null, connectedByName: null }

  // Fetched separately: company_settings has no declared relationship to
  // profiles in the hand-written Database type, so an embedded select would
  // not type-check.
  const { data: connectedBy } = data.pipedream_connected_by
    ? await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", data.pipedream_connected_by)
        .maybeSingle()
    : { data: null }

  return {
    connection: {
      accountId: data.pipedream_account_id,
      externalUserId: data.pipedream_external_user_id ?? ORG_EXTERNAL_USER_ID,
    },
    connectedAt: data.pipedream_connected_at,
    connectedByName: connectedBy?.display_name || connectedBy?.email || null,
  }
}
