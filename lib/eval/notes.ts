// lib/eval/notes.ts
// Parses the hand-written ground truth in fixtures/<source>/notes.csv.
//
// Deliberately hand-rolled rather than pulling in a CSV library: the format is
// six known columns, the files are written by one person in Excel, and the two
// things that actually bite (the UTF-8 BOM and quoted fields containing commas)
// are ten lines each.
//
// THE BOM. Excel's "CSV UTF-8" export writes a byte-order mark. Five of the
// eight notes.csv files have one — the Thai-bearing ones — and three don't.
// Unstripped, the first header parses as "﻿filename" and every lookup of
// "filename" silently returns undefined, which looks exactly like an empty
// fixture rather than a parse bug. Strip it once, here, for everyone.

export interface GoldenRow {
  /** Filename within the fixture folder. Repeats when one document holds several transactions. */
  filename: string
  /** YYYY-MM-DD. */
  date: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  merchant: string
  /** Free-text context from the user. Never scored — it's for humans reading failures. */
  notes: string
}

const REQUIRED_COLUMNS = ['filename', 'date', 'amount', 'direction', 'merchant', 'notes'] as const

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Splits one CSV line, honouring double-quoted fields and the "" escape.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields.map((f) => f.trim())
}

export class NotesParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotesParseError'
  }
}

/**
 * Parses a notes.csv. Returns [] for a header-only file (fixtures/line/ is
 * intentionally empty), throws if the header or a row is malformed — a silently
 * skipped ground-truth row would inflate the eval score.
 */
export function parseNotesCsv(text: string, label = 'notes.csv'): GoldenRow[] {
  const clean = stripBom(text).replace(/\r\n/g, '\n').trim()
  if (clean.length === 0) return []

  const lines = clean.split('\n').filter((l) => l.trim().length > 0)
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())

  for (const column of REQUIRED_COLUMNS) {
    if (!header.includes(column)) {
      throw new NotesParseError(
        `${label}: missing required column "${column}". Found: ${header.join(', ')}`
      )
    }
  }

  const index = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>

  return lines.slice(1).map((line, i) => {
    const fields = splitCsvLine(line)
    const at = (column: string) => fields[index[column]] ?? ''
    const rowLabel = `${label} row ${i + 2}`

    const amount = Number(at('amount').replace(/,/g, ''))
    if (!Number.isFinite(amount)) {
      throw new NotesParseError(`${rowLabel}: amount "${at('amount')}" is not a number`)
    }

    const direction = at('direction').toLowerCase()
    if (direction !== 'income' && direction !== 'expense' && direction !== 'transfer') {
      throw new NotesParseError(
        `${rowLabel}: direction "${at('direction')}" must be income, expense or transfer`
      )
    }

    const date = at('date')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new NotesParseError(`${rowLabel}: date "${date}" must be YYYY-MM-DD`)
    }

    const filename = at('filename')
    if (filename.length === 0) {
      throw new NotesParseError(`${rowLabel}: filename is empty`)
    }

    return { filename, date, amount, direction, merchant: at('merchant'), notes: at('notes') }
  })
}

/** Groups rows by filename, preserving order. One document may hold several transactions. */
export function groupByFilename(rows: GoldenRow[]): Map<string, GoldenRow[]> {
  const grouped = new Map<string, GoldenRow[]>()
  for (const row of rows) {
    const existing = grouped.get(row.filename)
    if (existing) existing.push(row)
    else grouped.set(row.filename, [row])
  }
  return grouped
}
