import { describe, it, expect } from 'vitest'
import {
  amountMatches,
  buildReport,
  compareRow,
  matchRows,
  merchantMatches,
  normalizeMerchant,
  percent,
  type FileResult,
} from './score.ts'
import type { GoldenRow } from './notes.ts'
import type { ExtractedTransaction } from '../prompts/extract-slip.ts'

function golden(over: Partial<GoldenRow> = {}): GoldenRow {
  return {
    filename: 'x.jpg',
    date: '2026-07-21',
    amount: 700,
    direction: 'expense',
    merchant: 'NARAPON WONGK',
    notes: '',
    ...over,
  }
}

function extracted(over: Partial<ExtractedTransaction> = {}): ExtractedTransaction {
  return {
    date: '2026-07-21',
    amount: 700,
    currency: 'THB',
    direction: 'expense',
    merchant: 'NARAPON WONGK',
    sender_name: null,
    recipient_name: null,
    reference_no: null,
    ...over,
  }
}

describe('normalizeMerchant', () => {
  it('lowercases, collapses whitespace and drops punctuation', () => {
    expect(normalizeMerchant('  MR.  NARAPON,  WONGK. ')).toBe('mr narapon wongk')
  })

  it('leaves Thai script intact', () => {
    expect(normalizeMerchant('ข้าวแกงพอใจ')).toBe('ข้าวแกงพอใจ')
  })
})

describe('merchantMatches', () => {
  it('matches identical names', () => {
    expect(merchantMatches('JONES SALAD', 'Jones Salad')).toBe(true)
  })

  it('matches when a title is added', () => {
    expect(merchantMatches('NARAPON WONGK', 'MR. NARAPON WONGK')).toBe(true)
  })

  it('accepts the annotation being dropped', () => {
    expect(merchantMatches('PEERACHAT BUG (own SCB account)', 'PEERACHAT BUG')).toBe(true)
  })

  it('accepts a parenthetical that is part of the name', () => {
    expect(merchantMatches('Grab Ride (JustGrab)', 'Grab Ride (JustGrab)')).toBe(true)
    expect(merchantMatches('ครัวคุณอ๋อย (น)', 'ครัวคุณอ๋อย')).toBe(true)
  })

  it('matches Thai names ignoring surrounding whitespace', () => {
    expect(merchantMatches('ร้านยาฟาร์มาพลัส', ' ร้านยาฟาร์มาพลัส ')).toBe(true)
  })

  it('rejects a different merchant', () => {
    expect(merchantMatches('JONES SALAD', 'Arabica Coffee Roaster')).toBe(false)
  })

  it('rejects an empty answer', () => {
    expect(merchantMatches('JONES SALAD', '')).toBe(false)
  })

  it('rejects a null merchant without throwing', () => {
    expect(merchantMatches('JONES SALAD', null)).toBe(false)
  })

  it('treats a trailing ellipsis in the answer key as "and the rest"', () => {
    expect(merchantMatches('7-Eleven ศูนย์ประชุม...', '7-Eleven ศูนย์ประชุมแห่งชาติสิริกิติ์')).toBe(true)
  })

  it('does not let an ellipsis match a different merchant', () => {
    expect(merchantMatches('7-Eleven ศูนย์ประชุม...', 'Arabica Coffee Roaster')).toBe(false)
  })

  it('does not let a very short string match by containment', () => {
    expect(merchantMatches('7-Eleven สถานีหัวลำโพง', 'ก')).toBe(false)
  })

  it('still distinguishes two branches of the same chain', () => {
    expect(merchantMatches('7-Eleven สถานีหัวลำโพง', '7-Eleven สาทรไพรม์')).toBe(false)
  })
})

describe('amountMatches', () => {
  it('accepts float noise within a satang', () => {
    expect(amountMatches(999.97, 999.9701)).toBe(true)
  })

  it('rejects a rounded-off amount', () => {
    expect(amountMatches(999.97, 1000)).toBe(false)
  })

  it('rejects the gross amount when the net was expected', () => {
    // PaoTang: bill 250, 60/40 discount -150, actually paid 100.
    expect(amountMatches(100, 250)).toBe(false)
  })

  it('is absolute, not proportional — 30,000 vs 31,000 is wrong', () => {
    expect(amountMatches(30000, 31000)).toBe(false)
  })
})

describe('compareRow', () => {
  it('passes every field on an exact reading', () => {
    expect(compareRow(golden(), extracted())).toEqual({
      date: true,
      amount: true,
      direction: true,
      merchant: true,
    })
  })

  it('fails only the field that is wrong', () => {
    const result = compareRow(golden(), extracted({ date: '2569-07-21' }))
    expect(result.date).toBe(false)
    expect(result.amount).toBe(true)
    expect(result.direction).toBe(true)
  })

  it('catches expense reported where a transfer was expected', () => {
    const result = compareRow(golden({ direction: 'transfer' }), extracted({ direction: 'expense' }))
    expect(result.direction).toBe(false)
  })
})

describe('matchRows', () => {
  it('pairs a single row', () => {
    const rows = matchRows([golden()], [extracted()])
    expect(rows).toHaveLength(1)
    expect(rows[0].fields.amount).toBe(true)
  })

  it('pairs multi-transaction documents regardless of output order', () => {
    // One Grab digest PDF, three rides, returned by the model back-to-front.
    const expected = [
      golden({ filename: 'grab.pdf', amount: 26, merchant: 'GrabFood - ครัวคุณอ๋อย' }),
      golden({ filename: 'grab.pdf', amount: 117, merchant: 'GrabFood - Tama-Go' }),
      golden({ filename: 'grab.pdf', amount: 146, merchant: 'Grab Ride (JustGrab)' }),
    ]
    const actual = [
      extracted({ amount: 146, merchant: 'Grab Ride (JustGrab)' }),
      extracted({ amount: 117, merchant: 'GrabFood - Tama-Go' }),
      extracted({ amount: 26, merchant: 'GrabFood - ครัวคุณอ๋อย' }),
    ]
    const rows = matchRows(expected, actual)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.fields.amount && r.fields.merchant)).toBe(true)
  })

  it('marks a missed transaction as a null match with every field failed', () => {
    const expected = [golden({ amount: 26 }), golden({ amount: 117 })]
    const rows = matchRows(expected, [extracted({ amount: 26 })])
    expect(rows.filter((r) => r.actual === null)).toHaveLength(1)
    const missed = rows.find((r) => r.actual === null)!
    expect(Object.values(missed.fields).every((v) => v === false)).toBe(true)
  })

  it('never reuses one predicted row for two expected rows', () => {
    const expected = [golden({ amount: 50 }), golden({ amount: 50 })]
    const rows = matchRows(expected, [extracted({ amount: 50 })])
    expect(rows.filter((r) => r.actual !== null)).toHaveLength(1)
    expect(rows.filter((r) => r.actual === null)).toHaveLength(1)
  })
})

describe('buildReport', () => {
  const file = (over: Partial<FileResult>): FileResult => ({
    source: 'kbank',
    filename: 'x.jpg',
    rows: [],
    spurious: [],
    ...over,
  })

  it('tallies per field and per source', () => {
    const report = buildReport([
      file({ rows: matchRows([golden()], [extracted()]) }),
      file({
        source: 'scb',
        rows: matchRows([golden({ amount: 50 })], [extracted({ amount: 999 })]),
      }),
    ])

    expect(report.fields.date.passed).toBe(2)
    expect(report.fields.amount.passed).toBe(1)
    expect(report.fields.amount.total).toBe(2)
    expect(report.bySource.get('kbank')!.amount.passed).toBe(1)
    expect(report.bySource.get('scb')!.amount.passed).toBe(0)
  })

  it('counts a row exact only when every field passes', () => {
    const report = buildReport([
      file({ rows: matchRows([golden()], [extracted()]) }),
      file({ rows: matchRows([golden()], [extracted({ merchant: 'Someone Else' })]) }),
    ])
    expect(report.exactRows).toEqual({ passed: 1, total: 2 })
  })

  it('counts errored documents, missing rows and spurious rows', () => {
    const report = buildReport([
      file({
        error: 'timeout',
        rows: matchRows([golden()], []),
      }),
      file({ rows: matchRows([golden()], [extracted()]), spurious: [extracted({ amount: 1 })] }),
    ])
    expect(report.documentsWithErrors).toBe(1)
    expect(report.missingRows).toBe(1)
    expect(report.spuriousRows).toBe(1)
  })

  it('reports 0% rather than NaN for an empty run', () => {
    expect(percent(buildReport([]).fields.date)).toBe(0)
  })
})
