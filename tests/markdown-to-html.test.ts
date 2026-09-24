import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  inlineMarkdownToHtml,
  markdownToHtml,
  markdownToHtmlDocument,
} from "../lib/drive/markdown-to-html.ts"

describe("inlineMarkdownToHtml", () => {
  it("renders bold, italic, code, and links", () => {
    assert.equal(
      inlineMarkdownToHtml("A **bold** and *italic* `code` [site](https://x.dev)"),
      'A <b>bold</b> and <i>italic</i> <span style="font-family:\'Roboto Mono\',monospace">code</span> <a href="https://x.dev">site</a>'
    )
  })

  it("nests styles inside links", () => {
    assert.equal(
      inlineMarkdownToHtml("[**Docs**](https://x.dev)"),
      '<a href="https://x.dev"><b>Docs</b></a>'
    )
  })

  it("drops links that aren't web or mail links", () => {
    assert.equal(inlineMarkdownToHtml("[click](javascript:void)"), "click")
  })

  it("escapes HTML in the agent's text", () => {
    assert.equal(
      inlineMarkdownToHtml('<script>"x" & y</script>'),
      "&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;"
    )
  })

  it("restores escaped markdown characters as literal text", () => {
    assert.equal(
      inlineMarkdownToHtml("5 \\* 3 \\_not italic\\_"),
      "5 * 3 _not italic_"
    )
  })

  it("leaves snake_case words alone", () => {
    assert.equal(inlineMarkdownToHtml("use snake_case_names"), "use snake_case_names")
  })
})

// List structure, without the margin reset every list carries.
function unstyled(markdown: string) {
  return markdownToHtml(markdown).replaceAll(' style="margin:0;padding:0"', "")
}

describe("markdownToHtml", () => {
  it("is empty for empty content", () => {
    assert.equal(markdownToHtml("  \n\n "), "")
  })

  it("renders headings by level and paragraphs", () => {
    assert.equal(
      markdownToHtml("# One\n## Two **bold**\nBody"),
      "<h1>One</h1>\n<h2>Two <b>bold</b></h2>\n<p>Body</p>"
    )
  })

  it("keeps a blank line between prose paragraphs, but not around headings", () => {
    assert.equal(
      markdownToHtml("# Title\n\nFirst\n\nSecond"),
      "<h1>Title</h1>\n<p>First</p>\n<p><br></p>\n<p>Second</p>"
    )
  })

  it("resets list margins so Drive does not indent lists like quotes", () => {
    assert.equal(
      markdownToHtml("- a"),
      '<ul style="margin:0;padding:0"><li>a</li></ul>'
    )
  })

  it("nests lists and splits where the top-level kind changes", () => {
    assert.equal(
      unstyled("- a\n- b\n\n1. one\n   - detail\n2. two"),
      "<ul><li>a</li><li>b</li></ul>" +
        "<ol><li>one<ul><li>detail</li></ul></li><li>two</li></ol>"
    )
  })

  it("keeps a loose list (blank lines between items) as one list", () => {
    assert.equal(
      unstyled("- a\n\n- b"),
      "<ul><li>a</li><li>b</li></ul>"
    )
  })

  it("closes nested lists when the level drops back", () => {
    assert.equal(
      unstyled("- a\n    - deep\n- b"),
      "<ul><li>a<ul><li>deep</li></ul></li><li>b</li></ul>"
    )
  })

  it("renders tables with a header row and drops the divider", () => {
    assert.equal(
      markdownToHtml("| Name | Score |\n|---|---:|\n| **Ada** | 9 |"),
      "<table><thead><tr><th>Name</th><th>Score</th></tr></thead>" +
        "<tbody><tr><td><b>Ada</b></td><td>9</td></tr></tbody></table>"
    )
  })

  it("keeps code blocks verbatim and indented, in a monospace font", () => {
    const html = markdownToHtml("```bash\nnpm run **build**\n  <x>\n```")
    assert.match(html, /<p style="[^"]*monospace">npm run \*\*build\*\*<\/p>/)
    assert.match(html, /&nbsp;&nbsp;&lt;x&gt;/)
  })

  it("unwraps a whole-document ```markdown fence", () => {
    assert.equal(
      markdownToHtml("```markdown\n# Report\nBody\n```"),
      "<h1>Report</h1>\n<p>Body</p>"
    )
  })

  it("treats an escaped heading marker as text", () => {
    assert.equal(markdownToHtml("\\# not a heading"), "<p># not a heading</p>")
  })
})

describe("markdownToHtmlDocument", () => {
  it("wraps the body in a UTF-8 document with an escaped title", () => {
    const html = markdownToHtmlDocument("Hi", "Q3 <plan>")
    assert.match(html, /<meta charset="utf-8">/)
    assert.match(html, /<title>Q3 &lt;plan&gt;<\/title>/)
    assert.match(html, /<body><p>Hi<\/p><\/body>/)
  })
})
