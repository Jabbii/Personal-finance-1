// lib/eval/score.ts
// Compares what the model extracted against what the user wrote by hand.
//
// The judgement calls all live here, and they are worth stating plainly
// because they decide what the headline number means:
//
//   date       exact string match. No leniency — a wrong date files a
//              transaction in the wrong month, which is the whole product.
//   amount     equal within 0.01 THB, to absorb float noise on values like
//              999.97. Not a percentage tolerance: 5% of 30,000 is 1,500.
//   direction  exact. Three values, no partial credit.
//   merchant   normalized comparison with three accepted readings (below).
//              Deliberately the most forgiving field, because it feeds a
//              curated alias table in Chunk 2.4 rather than being used raw.
//
// Merchant matching accepts an answer if, after normalizing, it either equals
// the expected value, equals the part before a parenthetical, or one string
// contains the other and the shorter is at least MIN_CONTAINMENT chars. That
// last rule is what lets "NARAPON WONGK" match "MR. NARAPON WONGK" without
// letting "7-Eleven" match every 7-Eleven branch in the country.
//
// Parentheticals are genuinely ambiguous in this golden set: some annotate
// ("PEERACHAT BUG (own SCB account)"), some are part of the name
// ("ครัวคุณอ๋อย (น)", "Grab Ride (JustGrab)"). Both readings are accepted
// rather than guessing which kind each one is.

import type { GoldenRow } from './notes.ts'
import type { ExtractedTransaction } from '../prompts/extract-slip.ts'

export const AMOUNT_TOLERANCE = 0.01
export const MIN_CONTAINMENT = 4

export const SCORED_FIELDS = ['date', 'amount', 'direction', 'merchant'] as const
export type ScoredField = (typeof SCORED_FIELDS)[number]

export function normalizeMerchant(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:!?"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function beforeParenthetical(value: string): string {
  const index = value.indexOf('(')
  return index === -1 ? value : value.slice(0, index)
}

const TRUNCATED = /(\.{3,}|…)\s*$/

export function merchantMatches(expected: string, actual: string | null): boolean {
  if (actual === null) return false
  const e = normalizeMerchant(expected)
  const a = normalizeMerchant(actual)
  if (e.length === 0 || a.length === 0) return false
  if (e === a) return true

  // The user sometimes abbreviates a long branch name with a trailing "..."
  // in notes.csv. That is an explicit "and the rest", so compare the prefix.
  if (TRUNCATED.test(expected)) {
    const prefix = normalizeMerchant(expected.replace(TRUNCATED, ''))
    if (prefix.length >= MIN_CONTAINMENT && a.startsWith(prefix)) return true
  }

  const eShort = normalizeMerchant(beforeParenthetical(expected))
  const aShort = normalizeMerchant(beforeParenthetical(actual))
  if (eShort.length > 0 && aShort.length > 0 && eShort === aShort) return true
  if (eShort.length > 0 && eShort === a) return true
  if (aShort.length > 0 && aShort === e) return true

  const [shorter, longer] = e.length <= a.length ? [e, a] : [a, e]
  return shorter.length >= MIN_CONTAINMENT && longer.includes(shorter)
}

export function amountMatches(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) <= AMOUNT_TOLERANCE
}

export function compareRow(
  expected: GoldenRow,
  actual: ExtractedTransaction
): Record<ScoredField, boolean> {
  return {
    date: expected.date === actual.date,
    amount: amountMatches(expected.amount, actual.amount),
    direction: expected.direction === actual.direction,
    merchant: merchantMatches(expected.merchant, actual.merchant),
  }
}

function countPasses(result: Record<ScoredField, boolean>): number {
  return SCORED_FIELDS.filter((f) => result[f]).length
}

export interface RowResult {
  expected: GoldenRow
  /** null when the model returned fewer transactions than the document holds. */
  actual: ExtractedTransaction | null
  fields: Record<ScoredField, boolean>
}

export interface FileResult {
  source: string
  filename: string
  rows: RowResult[]
  /** Transactions the model returned that no ground-truth row claimed. */
  spurious: ExtractedTransaction[]
  /** Set when the model call itself failed — counts as a total miss, not a skip. */
  error?: string
}

/**
 * Pairs predicted rows to expected rows for documents holding several
 * transactions (Grab's daily digests). Greedy best-first on field-match count,
 * with amount as the tie-breaker since it is the most discriminating field.
 * Order in the model's output carries no meaning, so it is ignored.
 */
export function matchRows(expected: GoldenRow[], actual: ExtractedTransaction[]): FileResult['rows'] {
  const unmatched = [...actual]
  const rows: RowResult[] = []

  const candidates = expected.flatMap((exp, expIndex) =>
    actual.map((act, actIndex) => ({
      expIndex,
      actIndex,
      fields: compareRow(exp, act),
    }))
  )

  candidates.sort((a, b) => {
    const diff = countPasses(b.fields) - countPasses(a.fields)
    if (diff !== 0) return diff
    return Number(b.fields.amount) - Number(a.fields.amount)
  })

  const usedExp = new Set<number>()
  const usedAct = new Set<number>()
  const pairing = new Map<number, number>()

  for (const candidate of candidates) {
    if (usedExp.has(candidate.expIndex) || usedAct.has(candidate.actIndex)) continue
    usedExp.add(candidate.expIndex)
    usedAct.add(candidate.actIndex)
    pairing.set(candidate.expIndex, candidate.actIndex)
  }

  expected.forEach((exp, expIndex) => {
    const actIndex = pairing.get(expIndex)
    if (actIndex === undefined) {
      rows.push({
        expected: exp,
        actual: null,
        fields: { date: false, amount: false, direction: false, merchant: false },
      })
      return
    }
    const act = actual[actIndex]
    const used = unmatched.indexOf(act)
    if (used !== -1) unmatched.splice(used, 1)
    rows.push({ expected: exp, actual: act, fields: compareRow(exp, act) })
  })

  return rows
}

export interface FieldTally {
  passed: number
  total: number
}

export interface Report {
  files: FileResult[]
  fields: Record<ScoredField, FieldTally>
  bySource: Map<string, Record<ScoredField, FieldTally>>
  /** Rows where every scored field passed. The number that actually matters. */
  exactRows: FieldTally
  documentsWithErrors: number
  spuriousRows: number
  missingRows: number
}

function emptyTally(): Record<ScoredField, FieldTally> {
  return {
    date: { passed: 0, total: 0 },
    amount: { passed: 0, total: 0 },
    direction: { passed: 0, total: 0 },
    merchant: { passed: 0, total: 0 },
  }
}

export function buildReport(files: FileResult[]): Report {
  const fields = emptyTally()
  const bySource = new Map<string, Record<ScoredField, FieldTally>>()
  const exactRows: FieldTally = { passed: 0, total: 0 }
  let spuriousRows = 0
  let missingRows = 0
  let documentsWithErrors = 0

  for (const file of files) {
    if (file.error) documentsWithErrors++
    spuriousRows += file.spurious.length

    let sourceTally = bySource.get(file.source)
    if (!sourceTally) {
      sourceTally = emptyTally()
      bySource.set(file.source, sourceTally)
    }

    for (const row of file.rows) {
      if (row.actual === null) missingRows++
      exactRows.total++
      if (SCORED_FIELDS.every((f) => row.fields[f])) exactRows.passed++

      for (const field of SCORED_FIELDS) {
        fields[field].total++
        sourceTally[field].total++
        if (row.fields[field]) {
          fields[field].passed++
          sourceTally[field].passed++
        }
      }
    }
  }

  return { files, fields, bySource, exactRows, documentsWithErrors, spuriousRows, missingRows }
}

export function percent(tally: FieldTally): number {
  return tally.total === 0 ? 0 : (tally.passed / tally.total) * 100
}
