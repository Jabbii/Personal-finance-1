import { describe, it, expect } from 'vitest'
import { parseNotesCsv, splitCsvLine, stripBom, groupByFilename, NotesParseError } from './notes.ts'

const HEADER = 'filename,date,amount,direction,merchant,notes'

describe('stripBom', () => {
  it('removes a leading UTF-8 BOM', () => {
    expect(stripBom('﻿filename,date')).toBe('filename,date')
  })

  it('leaves text without a BOM alone', () => {
    expect(stripBom('filename,date')).toBe('filename,date')
  })
})

describe('splitCsvLine', () => {
  it('splits plain fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('a,"b, still b",c')).toEqual(['a', 'b, still b', 'c'])
  })

  it('unescapes doubled quotes', () => {
    expect(splitCsvLine('a,"say ""hi""",c')).toEqual(['a', 'say "hi"', 'c'])
  })

  it('preserves empty trailing fields', () => {
    expect(splitCsvLine('a,b,')).toEqual(['a', 'b', ''])
  })
})

describe('parseNotesCsv', () => {
  it('parses a BOM-prefixed file — the shape Excel actually produces', () => {
    const csv = `﻿${HEADER}\n016202144107DPP01788.jpeg,2026-07-21,700,expense,NARAPON WONGK,era izzan izakaya`
    const rows = parseNotesCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].filename).toBe('016202144107DPP01788.jpeg')
    expect(rows[0].amount).toBe(700)
    expect(rows[0].direction).toBe('expense')
  })

  it('parses Thai merchant names and quoted notes containing commas', () => {
    const csv = `${HEADER}\nPaoTang_x.png,2026-07-16,20,expense,ข้าวแกงพอใจ,"bill 50 THB, discount -30 THB"`
    const rows = parseNotesCsv(csv)
    expect(rows[0].merchant).toBe('ข้าวแกงพอใจ')
    expect(rows[0].notes).toBe('bill 50 THB, discount -30 THB')
  })

  it('parses decimal amounts', () => {
    const csv = `${HEADER}\nSTK.png,2025-10-08,999.97,expense,NASDAQ - NBIS,`
    expect(parseNotesCsv(csv)[0].amount).toBeCloseTo(999.97)
  })

  it('strips thousands separators', () => {
    const csv = `${HEADER}\nx.jpg,2026-08-01,"30,000",transfer,SELF,`
    expect(parseNotesCsv(csv)[0].amount).toBe(30000)
  })

  it('returns an empty list for a header-only file (fixtures/line)', () => {
    expect(parseNotesCsv(HEADER)).toEqual([])
  })

  it('returns an empty list for an empty file', () => {
    expect(parseNotesCsv('')).toEqual([])
  })

  it('handles CRLF line endings', () => {
    const csv = `${HEADER}\r\nx.jpg,2026-08-01,10,expense,Shop,\r\n`
    expect(parseNotesCsv(csv)).toHaveLength(1)
  })

  // Each of these would otherwise silently inflate the score by dropping a row.
  it('throws when a required column is missing', () => {
    expect(() => parseNotesCsv('filename,date,amount,direction,merchant')).toThrow(NotesParseError)
  })

  it('throws on a non-numeric amount', () => {
    const csv = `${HEADER}\nx.jpg,2026-08-01,lots,expense,Shop,`
    expect(() => parseNotesCsv(csv)).toThrow(/not a number/)
  })

  it('throws on an unknown direction', () => {
    const csv = `${HEADER}\nx.jpg,2026-08-01,10,refund,Shop,`
    expect(() => parseNotesCsv(csv)).toThrow(/must be income, expense or transfer/)
  })

  it('throws on a non-ISO date', () => {
    const csv = `${HEADER}\nx.jpg,01/08/2026,10,expense,Shop,`
    expect(() => parseNotesCsv(csv)).toThrow(/must be YYYY-MM-DD/)
  })

  it('reports the row number in the error', () => {
    const csv = `${HEADER}\nok.jpg,2026-08-01,10,expense,Shop,\nbad.jpg,2026-08-01,10,nope,Shop,`
    expect(() => parseNotesCsv(csv, 'kbank/notes.csv')).toThrow(/kbank\/notes\.csv row 3/)
  })
})

describe('groupByFilename', () => {
  it('groups the repeated filenames a multi-transaction PDF produces', () => {
    const csv = [
      HEADER,
      'Grab.pdf,2026-08-01,26,expense,GrabFood,',
      'Grab.pdf,2026-08-01,117,expense,Tama-Go,',
      'Other.pdf,2026-07-30,95,expense,Grab Ride,',
    ].join('\n')
    const grouped = groupByFilename(parseNotesCsv(csv))
    expect(grouped.size).toBe(2)
    expect(grouped.get('Grab.pdf')).toHaveLength(2)
    expect(grouped.get('Other.pdf')).toHaveLength(1)
  })
})
