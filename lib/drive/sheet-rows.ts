// Parses an agent's Sheet output into rows of cells, which become a Google
// Sheet (via CSV) and the table on the mission page.
// Agents are asked for tab-separated values, but a Markdown table or CSV
// still comes out as proper columns rather than one long cell per row.
//
// Pure and import-free so it can be unit-tested with Node's built-in runner.

// Sheets rejects cells over 50,000 characters.
const MAX_CELL_LENGTH = 50_000

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function stripFences(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*(```|~~~)/.test(line))
    .join("\n")
}

function markdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/\*\*(.+?)\*\*/g, "$1"))
}

// RFC 4180-ish: quoted cells may contain commas and doubled quotes. Quoted
// newlines are not supported — rows arrive one per line.
function csvRow(line: string) {
  const cells: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && !cell.trim()) {
      quoted = true
      cell = ""
    } else if (char === ",") {
      cells.push(cell.trim())
      cell = ""
    } else cell += char
  }
  cells.push(cell.trim())
  return cells
}

function looksLikeCsv(lines: string[]) {
  if (lines.length < 2) return false
  const counts = lines.map((line) => csvRow(line).length)
  return counts[0] > 1 && counts.every((count) => count === counts[0])
}

function clampCell(cell: string) {
  return cell.length > MAX_CELL_LENGTH ? cell.slice(0, MAX_CELL_LENGTH) : cell
}

/** Rows of cells, header first. Empty when the content has no rows. */
export function parseSheetRows(content: string): string[][] {
  const lines = stripFences(content)
    .split("\n")
    .filter((line) => line.trim())

  let rows: string[][]
  if (lines.some((line) => line.includes("\t")))
    rows = lines.map((line) => line.split("\t").map((cell) => cell.trim()))
  else if (lines.filter((line) => line.trim().startsWith("|")).length >= 2)
    rows = lines
      .filter((line) => line.trim().startsWith("|"))
      .filter((line) => !TABLE_DIVIDER.test(line))
      .map(markdownRow)
  else if (looksLikeCsv(lines)) rows = lines.map(csvRow)
  else rows = lines.map((line) => [line.trim()])

  return rows.map((row) => row.map(clampCell))
}

// Quoted when a cell holds a delimiter, a quote, a line break, or edge
// whitespace that the import would otherwise trim.
function csvCell(cell: string) {
  return /[",\r\n]|^\s|\s$/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

/** Rows as CSV, which Drive converts into a Google Sheet on upload. */
export function rowsToCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
