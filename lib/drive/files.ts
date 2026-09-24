import "server-only"

import type { DriveConnection } from "@/lib/drive/connection"
import {
  SUPPORTED_DRIVE_MIME_TYPES,
  type DriveFile,
  type DriveFilePage,
} from "@/lib/drive/types"
import { getPipedreamClient } from "@/lib/pipedream/client"

const PAGE_SIZE = 50

const FIELDS = "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)"

const MIME_FILTER = `(${SUPPORTED_DRIVE_MIME_TYPES.map(
  (mimeType) => `mimeType='${mimeType}'`
).join(" or ")}) and trashed = false`

// Drive query literals are single-quoted; a stray quote or backslash in the
// search term would otherwise change the meaning of the query.
function escapeQueryLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

type DriveListResponse = {
  files?: unknown[]
  nextPageToken?: string
}

function toDriveFile(raw: unknown): DriveFile | null {
  if (!raw || typeof raw !== "object") return null
  const file = raw as Record<string, unknown>
  if (typeof file.id !== "string" || typeof file.name !== "string") return null
  return {
    id: file.id,
    name: file.name,
    mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
    modifiedTime:
      typeof file.modifiedTime === "string" ? file.modifiedTime : null,
    webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : null,
  }
}

/**
 * One page of Drive files the agent knowledge picker can offer, newest first.
 * `search` is matched by Drive itself so it also finds files past this page.
 */
export async function listDriveFiles(
  connection: DriveConnection,
  options: { search?: string; pageToken?: string } = {}
): Promise<DriveFilePage> {
  const search = options.search?.trim()
  const query = search
    ? `${MIME_FILTER} and name contains '${escapeQueryLiteral(search)}'`
    : MIME_FILTER

  const response = await getPipedreamClient().proxy.get({
    url: "https://www.googleapis.com/drive/v3/files",
    externalUserId: connection.externalUserId,
    accountId: connection.accountId,
    params: {
      q: query,
      fields: FIELDS,
      orderBy: "modifiedTime desc",
      pageSize: String(PAGE_SIZE),
      // Shared drives are opt-in on every Drive v3 call.
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
      ...(options.pageToken ? { pageToken: options.pageToken } : {}),
    },
  })

  const body = (response ?? {}) as DriveListResponse
  const files = Array.isArray(body.files)
    ? body.files.flatMap((raw) => toDriveFile(raw) ?? [])
    : []

  return { files, nextPageToken: body.nextPageToken ?? null }
}
