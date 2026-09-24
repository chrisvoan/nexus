// Shared by the server-side Drive readers and the client-side file picker, so
// this module must stay free of `server-only` imports and secrets.

import type { AgentKnowledge } from "@/lib/types/database"

/** A Drive file pinned to an agent, as the picker and mission runs see it. */
export type AgentKnowledgeFile = Pick<
  AgentKnowledge,
  "id" | "file_id" | "file_name" | "file_mime_type"
>

/** Pipedream's app slug for Google Drive, used by both the connect dialog and account lookup. */
export const GOOGLE_DRIVE_APP_SLUG = "google_drive"

/**
 * Which Drive a mission output is saved to: the employee's own, or the
 * company's when they haven't connected one.
 */
export type DriveTarget = "personal" | "company"

export const DRIVE_MIME = {
  googleDoc: "application/vnd.google-apps.document",
  googleSheet: "application/vnd.google-apps.spreadsheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
} as const

// What the picker offers. `.xlsx` is listed even though it cannot be parsed:
// hiding it makes a missing file look like a Drive problem, whereas pinning it
// produces an explicit "convert this to a Google Sheet" note at run time.
export const SUPPORTED_DRIVE_MIME_TYPES: readonly string[] = [
  DRIVE_MIME.googleDoc,
  DRIVE_MIME.googleSheet,
  DRIVE_MIME.docx,
  DRIVE_MIME.xlsx,
  DRIVE_MIME.pdf,
  DRIVE_MIME.txt,
  DRIVE_MIME.csv,
]

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string | null
  webViewLink: string | null
}

export type DriveFilePage = {
  files: DriveFile[]
  nextPageToken: string | null
}

export type DriveFileKind = "doc" | "sheet" | "pdf" | "text"

export function driveFileKind(mimeType: string): DriveFileKind {
  switch (mimeType) {
    case DRIVE_MIME.googleDoc:
    case DRIVE_MIME.docx:
      return "doc"
    case DRIVE_MIME.googleSheet:
    case DRIVE_MIME.xlsx:
    case DRIVE_MIME.csv:
      return "sheet"
    case DRIVE_MIME.pdf:
      return "pdf"
    default:
      return "text"
  }
}

const TYPE_LABELS: Record<string, string> = {
  [DRIVE_MIME.googleDoc]: "Google Doc",
  [DRIVE_MIME.googleSheet]: "Google Sheet",
  [DRIVE_MIME.docx]: "Word",
  [DRIVE_MIME.xlsx]: "Excel",
  [DRIVE_MIME.pdf]: "PDF",
  [DRIVE_MIME.txt]: "Text",
  [DRIVE_MIME.csv]: "CSV",
}

export function driveFileTypeLabel(mimeType: string) {
  return TYPE_LABELS[mimeType] ?? "File"
}

// Excel is the one type the picker offers but cannot read; the editor warns
// about it up front instead of leaving the admin to discover it mid-mission.
export function isUnreadableDriveType(mimeType: string) {
  return mimeType === DRIVE_MIME.xlsx
}
