import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseSheetRows, rowsToCsv } from "../lib/drive/sheet-rows.ts"

describe("parseSheetRows", () => {
  it("splits tab-separated values", () => {
    assert.deepEqual(parseSheetRows("Name\tScore\nAda\t9\n\nGrace\t10\n"), [
      ["Name", "Score"],
      ["Ada", "9"],
      ["Grace", "10"],
    ])
  })

  it("ignores code fences around the values", () => {
    assert.deepEqual(parseSheetRows("```tsv\nA\tB\n1\t2\n```"), [
      ["A", "B"],
      ["1", "2"],
    ])
  })

  it("parses a Markdown table and drops the divider row", () => {
    const table = "Here you go:\n\n| Name | **Score** |\n|---|---:|\n| Ada | 9 |"
    assert.deepEqual(parseSheetRows(table), [
      ["Name", "Score"],
      ["Ada", "9"],
    ])
  })

  it("parses consistent CSV, including quoted commas and quotes", () => {
    const csv = 'Company,Note\n"Acme, Inc.","Said ""hi"""\nGlobex,Fine'
    assert.deepEqual(parseSheetRows(csv), [
      ["Company", "Note"],
      ["Acme, Inc.", 'Said "hi"'],
      ["Globex", "Fine"],
    ])
  })

  it("falls back to one cell per line for prose", () => {
    assert.deepEqual(parseSheetRows("First, a thought.\nSecond line"), [
      ["First, a thought."],
      ["Second line"],
    ])
  })

  it("returns no rows for empty output", () => {
    assert.deepEqual(parseSheetRows("\n  \n"), [])
  })

  it("truncates cells past the Sheets limit", () => {
    const [[cell]] = parseSheetRows("x".repeat(60_000))
    assert.equal(cell.length, 50_000)
  })
})

describe("rowsToCsv", () => {
  it("joins plain cells with commas and rows with CRLF", () => {
    assert.equal(rowsToCsv([["Name", "Score"], ["Ada", "9"]]), "Name,Score\r\nAda,9")
  })

  it("quotes cells with commas, quotes, line breaks, or edge spaces", () => {
    assert.equal(
      rowsToCsv([["a,b", 'say "hi"', "two\nlines", " padded"]]),
      '"a,b","say ""hi""","two\nlines"," padded"'
    )
  })

  it("round-trips through parseSheetRows", () => {
    const rows = [["Region", "Revenue, USD"], ["EMEA", '1,200 "est"']]
    assert.deepEqual(parseSheetRows(rowsToCsv(rows)), rows)
  })
})
