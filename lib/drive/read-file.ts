import "server-only"

import type { DriveConnection } from "@/lib/drive/connection"
import { DRIVE_MIME } from "@/lib/drive/types"
import { describePipedreamError, getPipedreamClient } from "@/lib/pipedream/client"

// A single pinned file should never be able to swamp a Claude session. Drive
// export is capped at 10MB server-side; this caps what we hand to the model.
const MAX_TEXT_LENGTH = 200_000

// Arrays are serialised as repeated keys, which is what Google's APIs expect
// for parameters like `ranges`.
type ProxyParams = Record<string, string | string[]>

// `pd.proxy.get()` returns a BinaryResponse instead of parsed JSON when the
// caller's Accept header asks for anything other than JSON.
type BinaryResponse = { arrayBuffer: () => Promise<ArrayBuffer> }

function isBinaryResponse(value: unknown): value is BinaryResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BinaryResponse).arrayBuffer === "function"
  )
}

async function proxyGet(
  connection: DriveConnection,
  url: string,
  params: ProxyParams,
  accept?: string
) {
  return getPipedreamClient().proxy.get({
    url,
    externalUserId: connection.externalUserId,
    accountId: connection.accountId,
    params,
    ...(accept ? { headers: { Accept: accept } } : {}),
  })
}

async function proxyGetJson(
  connection: DriveConnection,
  url: string,
  params: ProxyParams
): Promise<unknown> {
  return proxyGet(connection, url, params)
}

async function proxyGetBuffer(
  connection: DriveConnection,
  url: string,
  params: ProxyParams,
  accept: string
): Promise<Buffer> {
  const response = await proxyGet(connection, url, params, accept)
  if (!isBinaryResponse(response))
    // Google answered with a JSON payload where bytes were expected, which in
    // practice means an error body the proxy passed through as 200.
    throw new Error("Drive returned no file content.")
  return Buffer.from(await response.arrayBuffer())
}

async function proxyGetText(
  connection: DriveConnection,
  url: string,
  params: ProxyParams,
  accept: string
) {
  return (await proxyGetBuffer(connection, url, params, accept)).toString(
    "utf-8"
  )
}

// ---------------------------------------------------------------------------
// Per-format extraction
// ---------------------------------------------------------------------------

// Drive's own export endpoint is used rather than the Docs API: it needs only
// the Drive scope the Pipedream Google Drive app already holds, and Markdown
// keeps the headings and lists the agent benefits from.
async function readGoogleDoc(connection: DriveConnection, fileId: string) {
  const params = { supportsAllDrives: "true" }
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`
  try {
    return await proxyGetText(
      connection,
      url,
      { ...params, mimeType: "text/markdown" },
      "text/markdown"
    )
  } catch {
    // Older documents and some shared drives refuse the Markdown export.
    return proxyGetText(
      connection,
      url,
      { ...params, mimeType: "text/plain" },
      "text/plain"
    )
  }
}

type SheetProperties = { properties?: { title?: unknown } }
type SpreadsheetMeta = { sheets?: SheetProperties[] }
type ValueRange = { range?: unknown; values?: unknown[][] }
type BatchGetResponse = { valueRanges?: ValueRange[] }

function sheetTitles(meta: unknown): string[] {
  const sheets = (meta as SpreadsheetMeta)?.sheets
  if (!Array.isArray(sheets)) return []
  return sheets.flatMap((sheet) =>
    typeof sheet?.properties?.title === "string" ? [sheet.properties.title] : []
  )
}

function rowsToText(values: unknown[][] | undefined) {
  if (!values?.length) return ""
  return values
    .map((row) => row.map((cell) => String(cell ?? "")).join("\t"))
    .join("\n")
}

// Every tab, not just the first: an agent asked about "the pricing tab" should
// be able to find it. Falls back to Drive's CSV export (first tab only) if the
// Sheets API is not reachable with this account's scopes.
async function readGoogleSheet(connection: DriveConnection, fileId: string) {
  const id = encodeURIComponent(fileId)
  try {
    const meta = await proxyGetJson(
      connection,
      `https://sheets.googleapis.com/v4/spreadsheets/${id}`,
      { fields: "sheets.properties.title" }
    )
    const titles = sheetTitles(meta)
    if (!titles.length) return "(empty sheet)"

    const batch = (await proxyGetJson(
      connection,
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet`,
      { ranges: titles, majorDimension: "ROWS" }
    )) as BatchGetResponse

    const sections = (batch.valueRanges ?? []).flatMap((range, index) => {
      const text = rowsToText(range.values)
      if (!text) return []
      const title = titles[index] ?? `Sheet ${index + 1}`
      return [`## ${title}\n\n${text}`]
    })
    return sections.length ? sections.join("\n\n") : "(empty sheet)"
  } catch {
    const csv = await proxyGetText(
      connection,
      `https://www.googleapis.com/drive/v3/files/${id}/export`,
      { mimeType: "text/csv", supportsAllDrives: "true" },
      "text/csv"
    )
    return csv.trim() || "(empty sheet)"
  }
}

function downloadParams() {
  return { alt: "media", supportsAllDrives: "true" }
}

function downloadUrl(fileId: string) {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
}

async function readDocx(connection: DriveConnection, fileId: string) {
  const buffer = await proxyGetBuffer(
    connection,
    downloadUrl(fileId),
    downloadParams(),
    "application/octet-stream"
  )
  const mammoth = (await import("mammoth")).default
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim() || "(empty document)"
}

// pdf2json, not pdf-parse: pdf-parse v2 breaks on the pdfjs worker under
// Next.js bundling, and v1 has a tokenizer bug on some PDFs.
async function readPdf(connection: DriveConnection, fileId: string) {
  const buffer = await proxyGetBuffer(
    connection,
    downloadUrl(fileId),
    downloadParams(),
    "application/pdf"
  )
  const PDFParser = (await import("pdf2json")).default

  const text = await new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(null, true)
    parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()))
    parser.on("pdfParser_dataError", (error) =>
      reject(error instanceof Error ? error : error.parserError)
    )
    parser.parseBuffer(buffer)
  })
  return text.trim() || "(empty PDF)"
}

async function readPlainText(connection: DriveConnection, fileId: string) {
  const text = await proxyGetText(
    connection,
    downloadUrl(fileId),
    downloadParams(),
    "text/plain"
  )
  return text.trim() || "(empty file)"
}

// ---------------------------------------------------------------------------

export type ReadableDriveFile = {
  file_id: string
  file_mime_type: string
}

/**
 * Extracts a Drive file to plain text that can be mounted into a Claude
 * session. Never throws: an unreadable file becomes a note in the text so one
 * bad file cannot abort a whole mission run.
 */
export async function readDriveFile(
  connection: DriveConnection,
  file: ReadableDriveFile
): Promise<string> {
  const { file_id: fileId, file_mime_type: mimeType } = file

  try {
    let text: string
    switch (mimeType) {
      case DRIVE_MIME.googleDoc:
        text = await readGoogleDoc(connection, fileId)
        break
      case DRIVE_MIME.googleSheet:
        text = await readGoogleSheet(connection, fileId)
        break
      case DRIVE_MIME.docx:
        text = await readDocx(connection, fileId)
        break
      case DRIVE_MIME.pdf:
        text = await readPdf(connection, fileId)
        break
      case DRIVE_MIME.txt:
      case DRIVE_MIME.csv:
        text = await readPlainText(connection, fileId)
        break
      case DRIVE_MIME.xlsx:
        return "(Excel file — convert it to a native Google Sheet in Drive so its content can be read by the agent)"
      default:
        return `(File type "${mimeType}" is not supported — skipped)`
    }

    const trimmed = text.trim()
    if (!trimmed) return "(empty file)"
    return trimmed.length > MAX_TEXT_LENGTH
      ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}\n\n(truncated — file is longer than ${MAX_TEXT_LENGTH.toLocaleString()} characters)`
      : trimmed
  } catch (error) {
    console.error("Drive file read failed", fileId, mimeType, error)
    return `(Could not read file content: ${describePipedreamError(error)})`
  }
}
