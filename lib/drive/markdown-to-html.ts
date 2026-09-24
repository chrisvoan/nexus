// Turns an agent's Markdown into HTML that Drive converts into a Google Doc
// on upload, so the Doc gets real headings, lists, tables, bold, and links
// instead of literal `#` and `**` characters.
//
// HTML import is used rather than the Docs API because Pipedream's Google
// Drive app may only call www.googleapis.com; docs.googleapis.com is refused.
//
// Pure and import-free so it can be unit-tested with Node's built-in runner.

type ListKind = "bullet" | "numbered"

type Block =
  | { type: "blank" }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; kind: ListKind; level: number; text: string }
  | { type: "code"; text: string }
  | { type: "row"; cells: string[] }
  | { type: "paragraph"; text: string }

const MAX_LIST_LEVEL = 8
const CODE_STYLE = "font-family:'Roboto Mono',monospace"
// Without it, Drive reads the browser's default list padding as an extra
// indent and the list comes out looking like a block quote.
const LIST_STYLE = "margin:0;padding:0"

const FENCE = /^\s*(```|~~~)/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const BULLET = /^(\s*)[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const QUOTE = /^\s*>\s?(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

// Escaped Markdown punctuation is swapped for private-use characters while
// parsing so it can't be read as markup, and restored in the output.
const ESCAPABLE = "\\`*_[]()#+-.!|>~"
const ESCAPE_BASE = 0xe000

function protectEscapes(value: string) {
  return value.replace(/\\(.)/g, (match, char: string) => {
    const index = ESCAPABLE.indexOf(char)
    return index === -1 ? match : String.fromCharCode(ESCAPE_BASE + index)
  })
}

function restoreEscapes(value: string) {
  return value.replace(/[-]/g, (char) => {
    const index = char.charCodeAt(0) - ESCAPE_BASE
    return ESCAPABLE[index] ?? char
  })
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function text(value: string) {
  return escapeHtml(restoreEscapes(value))
}

// Links become clickable in the Doc, so only web and mail links are kept.
function safeUrl(url: string) {
  const restored = restoreEscapes(url)
  return /^(https?:|mailto:)/i.test(restored) ? restored : null
}

const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)([^*]+?)\*|(?<![\p{L}\p{N}])_(?!\s)([^_]+?)_(?![\p{L}\p{N}])/gu

/** Inline Markdown (bold, italic, code, links) as HTML. Expects protected escapes. */
function inline(source: string): string {
  let html = ""
  let last = 0

  for (const match of source.matchAll(INLINE)) {
    const index = match.index ?? 0
    html += text(source.slice(last, index))
    last = index + match[0].length

    const [, code, linkText, url, bold, boldAlt, italic, italicAlt] = match
    if (code !== undefined)
      html += `<span style="${CODE_STYLE}">${text(code)}</span>`
    else if (linkText !== undefined) {
      const href = safeUrl(url)
      html += href
        ? `<a href="${escapeHtml(href)}">${inline(linkText)}</a>`
        : inline(linkText)
    } else if (bold !== undefined || boldAlt !== undefined)
      html += `<b>${inline(bold ?? boldAlt)}</b>`
    else html += `<i>${inline(italic ?? italicAlt)}</i>`
  }

  return html + text(source.slice(last))
}

export function inlineMarkdownToHtml(source: string) {
  return inline(protectEscapes(source))
}

function listLevel(indent: string) {
  const width = indent.replace(/\t/g, "  ").length
  return Math.min(Math.floor(width / 2), MAX_LIST_LEVEL)
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

// Agents sometimes wrap the whole answer in ```markdown … ``` despite being
// asked not to; unwrap that one outer fence so the content is not all code.
function unwrapDocumentFence(markdown: string) {
  const match = markdown
    .trim()
    .match(/^(```|~~~)\s*(?:markdown|md)?\s*\n([\s\S]*?)\n\1\s*$/i)
  return match ? match[2] : markdown
}

function toBlocks(markdown: string): Block[] {
  const lines = unwrapDocumentFence(markdown.replace(/\r\n?/g, "\n")).split(
    "\n"
  )
  const blocks: Block[] = []
  let fence: string | null = null

  for (const raw of lines) {
    const fenceMatch = raw.match(FENCE)
    if (fence) {
      if (fenceMatch && fenceMatch[1] === fence) fence = null
      else blocks.push({ type: "code", text: raw.replace(/\t/g, "    ") })
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      continue
    }

    if (!raw.trim() || RULE.test(raw)) {
      blocks.push({ type: "blank" })
      continue
    }

    // Escapes are protected before any block pattern runs, so `\#` or `\-`
    // at the start of a line stays literal text.
    const line = protectEscapes(raw)

    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      })
      continue
    }

    const bullet = line.match(BULLET)
    if (bullet) {
      blocks.push({
        type: "list",
        kind: "bullet",
        level: listLevel(bullet[1]),
        text: bullet[2],
      })
      continue
    }

    const numbered = line.match(NUMBERED)
    if (numbered) {
      blocks.push({
        type: "list",
        kind: "numbered",
        level: listLevel(numbered[1]),
        text: numbered[2],
      })
      continue
    }

    if (TABLE_ROW.test(line)) {
      if (!TABLE_DIVIDER.test(line))
        blocks.push({ type: "row", cells: tableCells(line) })
      continue
    }

    const quote = line.match(QUOTE)
    blocks.push({ type: "paragraph", text: quote ? quote[1] : line.trim() })
  }

  return blocks
}

type ListItem = Extract<Block, { type: "list" }>

// Contiguous items form one list. A deeper item nests inside the item above
// it; an item of the other kind at the same level starts a new list, so a
// bullet list followed by steps doesn't merge into one.
function renderList(items: ListItem[]) {
  let html = ""
  const open: { kind: ListKind; level: number }[] = []
  const tag = (kind: ListKind) => (kind === "numbered" ? "ol" : "ul")
  const close = () => {
    const list = open.pop()
    if (list) html += `</li></${tag(list.kind)}>`
  }

  for (const item of items) {
    let top = open[open.length - 1]
    while (
      top &&
      (top.level > item.level ||
        (top.level === item.level && top.kind !== item.kind))
    ) {
      close()
      top = open[open.length - 1]
    }

    if (top?.level === item.level) html += "</li><li>"
    else {
      html += `<${tag(item.kind)} style="${LIST_STYLE}"><li>`
      open.push({ kind: item.kind, level: item.level })
    }
    html += inline(item.text)
  }

  while (open.length) close()
  return html
}

function renderTable(rows: string[][]) {
  const [header, ...body] = rows
  const row = (cells: string[], cell: "th" | "td") =>
    `<tr>${cells.map((value) => `<${cell}>${inline(value)}</${cell}>`).join("")}</tr>`
  return `<table><thead>${row(header, "th")}</thead><tbody>${body
    .map((cells) => row(cells, "td"))
    .join("")}</tbody></table>`
}

/**
 * The body of a Google Doc as HTML. Empty when the Markdown has no content.
 * Blank lines between prose keep one empty paragraph of breathing room, as
 * in the Markdown; lists and headings carry their own spacing.
 */
export function markdownToHtml(markdown: string): string {
  const blocks = toBlocks(markdown)
  const parts: string[] = []
  let pendingBlank = false
  let previous: Block["type"] | null = null

  for (let index = 0; index < blocks.length; ) {
    const block = blocks[index]
    if (block.type === "blank") {
      pendingBlank = previous !== null
      index++
      continue
    }

    if (
      pendingBlank &&
      previous === "paragraph" &&
      block.type === "paragraph"
    )
      parts.push("<p><br></p>")
    pendingBlank = false
    previous = block.type

    switch (block.type) {
      case "heading": {
        const heading = inline(block.text)
        if (heading.trim())
          parts.push(`<h${block.level}>${heading}</h${block.level}>`)
        index++
        break
      }
      case "paragraph":
        // Each Markdown line is its own paragraph.
        parts.push(`<p>${inline(block.text)}</p>`)
        index++
        break
      case "list": {
        const items: ListItem[] = []
        // Blank lines between items still leave one list ("loose" Markdown).
        while (index < blocks.length) {
          const next = blocks[index]
          if (next.type === "list") items.push(next)
          else if (next.type !== "blank" || blocks[index + 1]?.type !== "list")
            break
          index++
        }
        parts.push(renderList(items))
        break
      }
      case "row": {
        const rows: string[][] = []
        for (let next = blocks[index]; next?.type === "row"; next = blocks[++index])
          rows.push(next.cells)
        parts.push(renderTable(rows))
        break
      }
      case "code": {
        const lines: string[] = []
        for (let next = blocks[index]; next?.type === "code"; next = blocks[++index])
          lines.push(codeLine(next.text))
        parts.push(lines.join(""))
        break
      }
    }
  }

  return parts.join("\n")
}

// HTML collapses runs of spaces, so indentation is kept as non-breaking ones.
function codeLine(value: string) {
  const html = escapeHtml(value).replace(/^ +/, (spaces) =>
    "&nbsp;".repeat(spaces.length)
  )
  return `<p style="${CODE_STYLE}">${html || "<br>"}</p>`
}

/** A complete HTML document, ready for Drive to convert into a Google Doc. */
export function markdownToHtmlDocument(markdown: string, title: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${markdownToHtml(markdown)}</body></html>`
}
