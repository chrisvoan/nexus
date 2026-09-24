import "server-only"

import type { DriveConnection } from "@/lib/drive/connection"
import { markdownToHtmlDocument } from "@/lib/drive/markdown-to-html"
import { proxyGetBuffer } from "@/lib/drive/read-file"
import { parseSheetRows, rowsToCsv } from "@/lib/drive/sheet-rows"
import { DRIVE_MIME } from "@/lib/drive/types"
import { getPipedreamClient, proxyPostRaw } from "@/lib/pipedream/client"
import type { MissionOutputType } from "@/lib/types/database"

// Every file is created with a Drive upload. Pipedream's Google Drive app may
// only call www.googleapis.com, so the Docs and Sheets APIs are out of reach;
// instead Drive converts uploaded HTML into a Doc and CSV into a Sheet.
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink"

export type DriveOutput = {
  fileId: string
  url: string
  /** Set when the file exists but something around it went wrong. */
  warning?: string
}

type UploadedFile = { id: string; webViewLink: string | null }

/**
 * Uploads `content` as a new file named `name`. When `mimeType` is a Google
 * type, Drive converts the upload into it.
 */
async function upload(
  connection: DriveConnection,
  file: { name: string; mimeType: string; content: Buffer; contentType: string }
): Promise<UploadedFile> {
  const boundary = `nexus-${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name: file.name, mimeType: file.mimeType })
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${file.contentType}\r\n\r\n`
    ),
    file.content,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const response = (await proxyPostRaw({
    url: UPLOAD_URL,
    externalUserId: connection.externalUserId,
    accountId: connection.accountId,
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  })) as Partial<Record<"id" | "webViewLink", unknown>> | null

  if (typeof response?.id !== "string" || !response.id)
    throw new Error("Google did not return an id for the new file.")
  return {
    id: response.id,
    webViewLink:
      typeof response.webViewLink === "string" ? response.webViewLink : null,
  }
}

function uploadDoc(connection: DriveConnection, title: string, content: string) {
  return upload(connection, {
    name: title,
    mimeType: DRIVE_MIME.googleDoc,
    content: Buffer.from(markdownToHtmlDocument(content, title)),
    contentType: "text/html; charset=UTF-8",
  })
}

async function createDoc(
  connection: DriveConnection,
  title: string,
  content: string
): Promise<DriveOutput> {
  const doc = await uploadDoc(connection, title, content)
  return {
    fileId: doc.id,
    url: doc.webViewLink ?? `https://docs.google.com/document/d/${doc.id}/edit`,
  }
}

function driveFileUrl(fileId: string) {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
}

// Drive can't convert straight to PDF, so the Markdown becomes a working Doc,
// the Doc is exported as a PDF, and the PDF is uploaded as a real file. The
// working Doc is then deleted, leaving only the PDF in Drive.
async function createPdf(
  connection: DriveConnection,
  title: string,
  content: string
): Promise<DriveOutput> {
  const doc = await uploadDoc(connection, title, content)

  let pdf: UploadedFile
  try {
    const bytes = await proxyGetBuffer(
      connection,
      `${driveFileUrl(doc.id)}/export`,
      { mimeType: "application/pdf" },
      "application/pdf"
    )
    pdf = await upload(connection, {
      name: title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`,
      mimeType: DRIVE_MIME.pdf,
      content: bytes,
      contentType: "application/pdf",
    })
  } catch (error) {
    // The content is in Drive as a Doc; hand that back rather than nothing.
    console.error("PDF export failed; keeping the Doc", doc.id, error)
    return {
      fileId: doc.id,
      url: `https://docs.google.com/document/d/${doc.id}/export?format=pdf`,
      warning:
        "The PDF couldn't be created, so the output was saved as a Google Doc; the link downloads it as a PDF.",
    }
  }

  try {
    await getPipedreamClient().proxy.delete({
      url: driveFileUrl(doc.id),
      externalUserId: connection.externalUserId,
      accountId: connection.accountId,
      params: { supportsAllDrives: "true" },
    })
  } catch (error) {
    // Harmless: the PDF exists; a spare Doc with the same title is left over.
    console.error("Working Doc cleanup failed", doc.id, error)
  }

  return {
    fileId: pdf.id,
    url: pdf.webViewLink ?? `https://drive.google.com/file/d/${pdf.id}/view`,
  }
}

async function createSheet(
  connection: DriveConnection,
  title: string,
  content: string
): Promise<DriveOutput> {
  const sheet = await upload(connection, {
    name: title,
    mimeType: DRIVE_MIME.googleSheet,
    content: Buffer.from(rowsToCsv(parseSheetRows(content))),
    contentType: "text/csv; charset=UTF-8",
  })
  return {
    fileId: sheet.id,
    url:
      sheet.webViewLink ??
      `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
  }
}

/**
 * Creates the mission's output file in Drive with the agent's content in it.
 * Throws when no file could be created; a fallback file comes back with a
 * `warning`.
 */
export async function createDriveOutput(
  connection: DriveConnection,
  output: { type: MissionOutputType; title: string; content: string }
): Promise<DriveOutput> {
  const title = output.title.trim() || "Mission output"
  switch (output.type) {
    case "sheet":
      return createSheet(connection, title, output.content)
    case "pdf":
      return createPdf(connection, title, output.content)
    case "doc":
      return createDoc(connection, title, output.content)
  }
}
