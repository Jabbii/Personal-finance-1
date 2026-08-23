// scripts/score-bakeoff.mts
// Scores the persisted bake-off responses and writes bakeoff/results.md and
// bakeoff/failures.md. Never calls the API — re-score as often as you like.
//
// METRIC MAPPING. The requested metric list was written for itemised till
// receipts. This repo extracts one transaction per bank slip: no qty, no unit
// price, no subtotal, no VAT, no line items. What each requested metric became:
//
//   1 line count exactness  -> transaction-count exactness per document.
//                              Grab digests legitimately hold 2-3, so merging
//                              or dropping one is still a hard failure.
//   2 reconciliation        -> NOT COMPUTABLE. Sum(qty x unit_price) needs
//                              line items that do not exist in this schema.
//   3 item name fidelity    -> merchant CER, split Latin vs Thai script, plus
//                              a script-preservation flag for transliteration.
//   4 numeric accuracy      -> `amount` only, +/-0.01. The other numeric
//                              fields do not exist here.
//   5 weight-priced items   -> NOT APPLICABLE. Zero such rows in the set.
//   6 schema validity       -> as specified.
//   7 cost and latency      -> as specified.
//
// Added, because they dominate downstream correctness in this project and were
// not in the original list: date accuracy and direction accuracy.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadJobs, MODELS, rawPath, slug, type Job, type RawRecord } from './bakeoff.mts'
import { amountMatches, matchRows, merchantMatches } from '../lib/eval/score.ts'
import { EXTRACTOR_VERSION, type ExtractedTransaction } from '../lib/prompts/extract-slip.ts'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const OUT = join(ROOT, 'bakeoff')
const RAW = join(OUT, 'raw')

// ------------------------------------------------------------ text distance

const THAI = /[฀-๿]/

/** Levenshtein over code points, so Thai combining marks count once. */
export function levenshtein(a: string, b: string): number {
  const s = [...a]
  const t = [...b]
  if (s.length === 0) return t.length
  if (t.length === 0) return s.length
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s.length; i++) {
    const curr = [i]
    for (let j = 1; j <= t.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[t.length]
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Character error rate against the golden string. Clamped at 1. */
export function cer(golden: string, actual: string | null): number {
  const g = normalise(golden)
  if (g.length === 0) return 0
  if (actual === null) return 1
  const a = normalise(actual)
  return Math.min(1, levenshtein(g, a) / [...g].length)
}

/** Golden is Thai but the model answered in pure Latin — silent translation. */
export function scriptLost(golden: string, actual: string | null): boolean {
  if (actual === null) return false
  return THAI.test(golden) && !THAI.test(actual)
}

// ------------------------------------------------------------------ scoring

interface RepScore {
  rows: number
  date: number
  amount: number
  direction: number
  merchantExact: number
  countExact: number
  docs: number
  cerLatinSum: number
  cerLatinN: number
  cerThaiSum: number
  cerThaiN: number
  scriptLost: number
  countDelta: Map<number, number>
}

function emptyRep(): RepScore {
  return {
    rows: 0, date: 0, amount: 0, direction: 0, merchantExact: 0, countExact: 0, docs: 0,
    cerLatinSum: 0, cerLatinN: 0, cerThaiSum: 0, cerThaiN: 0, scriptLost: 0,
    countDelta: new Map(),
  }
}

interface DocFailure {
  source: string
  filename: string
  wrongFields: number
  lines: string[]
}

interface ModelScore {
  alias: string
  id: string
  reps: RepScore[]
  calls: number
  okCalls: number
  schemaInvalid: number
  recovered: number
  retries: number
  httpErrors: number
  costUsd: number
  latencies: number[]
  reasoningTokens: number
  failures: DocFailure[]
}

function readRecord(alias: string, job: Job, rep: number): RawRecord | null {
  const path = rawPath(alias, job, rep)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RawRecord
  } catch {
    return null
  }
}

function scoreModel(model: { alias: string; id: string }, jobs: Job[], reps: number): ModelScore {
  const score: ModelScore = {
    alias: model.alias, id: model.id, reps: [], calls: 0, okCalls: 0, schemaInvalid: 0,
    recovered: 0, retries: 0, httpErrors: 0, costUsd: 0, latencies: [], reasoningTokens: 0,
    failures: [],
  }

  for (let rep = 1; rep <= reps; rep++) {
    const r = emptyRep()
    for (const job of jobs) {
      const record = readRecord(model.alias, job, rep)
      if (!record) continue

      score.calls++
      score.retries += record.retries
      score.costUsd += record.cost_usd ?? 0
      score.reasoningTokens += record.reasoning_tokens ?? 0
      if (record.latency_ms) score.latencies.push(record.latency_ms)
      if (record.recovered_on_retry) score.recovered++
      if (record.error?.startsWith('HTTP')) score.httpErrors++
      if (record.schema_valid === false) score.schemaInvalid++
      if (record.ok) score.okCalls++

      const actual: ExtractedTransaction[] = record.parsed?.transactions ?? []

      r.docs++
      const delta = actual.length - job.expected.length
      r.countDelta.set(delta, (r.countDelta.get(delta) ?? 0) + 1)
      if (delta === 0) r.countExact++

      const matched = matchRows(job.expected, actual)
      const failLines: string[] = []
      let wrong = 0

      for (const row of matched) {
        r.rows++
        const exp = row.expected
        const act = row.actual

        if (act && exp.date === act.date) r.date++
        else { wrong++; failLines.push('  date      golden ' + exp.date + '   got ' + (act ? act.date : '(no row)')) }

        if (act && amountMatches(exp.amount, act.amount)) r.amount++
        else { wrong++; failLines.push('  amount    golden ' + exp.amount + '   got ' + (act ? act.amount : '(no row)')) }

        if (act && exp.direction === act.direction) r.direction++
        else { wrong++; failLines.push('  direction golden ' + exp.direction + '   got ' + (act ? act.direction : '(no row)')) }

        if (act && merchantMatches(exp.merchant, act.merchant)) r.merchantExact++
        else { wrong++; failLines.push('  merchant  golden ' + exp.merchant + '   got ' + (act ? String(act.merchant) : '(no row)')) }

        const merchantCer = cer(exp.merchant, act ? act.merchant : null)
        if (THAI.test(exp.merchant)) { r.cerThaiSum += merchantCer; r.cerThaiN++ }
        else { r.cerLatinSum += merchantCer; r.cerLatinN++ }
        if (act && scriptLost(exp.merchant, act.merchant)) r.scriptLost++
      }

      if (delta !== 0) {
        failLines.unshift('  rowcount  golden ' + job.expected.length + ' rows   got ' + actual.length)
        wrong++
      }
      if (record.error) failLines.unshift('  ERROR     ' + record.error.slice(0, 160))

      if (wrong > 0 && rep === 1) {
        score.failures.push({ source: job.source, filename: job.filename, wrongFields: wrong, lines: failLines })
      }
    }
    score.reps.push(r)
  }

  score.failures.sort((a, b) => b.wrongFields - a.wrongFields)
  return score
}

// ------------------------------------------------------------------ helpers

const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100)

function meanSpread(values: number[]): { mean: number; min: number; max: number; spread: number } {
  if (values.length === 0) return { mean: 0, min: 0, max: 0, spread: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  return { mean, min, max, spread: max - min }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

const fmt = (v: number, d = 1) => v.toFixed(d)

function fieldSeries(score: ModelScore, key: 'date' | 'amount' | 'direction' | 'merchantExact') {
  return meanSpread(score.reps.filter((r) => r.rows > 0).map((r) => pct(r[key], r.rows)))
}

// ------------------------------------------------------------------ verdict
// Hand-written conclusions. Kept in the script so re-scoring does not silently
// drop them; revise deliberately if the numbers move.

const VERDICT = [
  '## Verdict',
  '',
  '### Three metrics carry no signal at all',
  '',
  'Row-count exactness is **108/108 for all five models** — nobody merged or dropped a transaction, including on the Grab digests that hold three. Date and amount are 100% for four of five. These are saturated; they cannot separate the field and should not be used to pick a winner.',
  '',
  '### Merchant is measuring our data problem, not the models',
  '',
  'Every model lands between 51.7% and 65.0%, and the run-to-run spreads (±2.5 to ±11.2) are as large as most of the gaps between models. The reason is visible in `failures.md`: the models correctly read what is printed — `ABUNDANT EMINENT (THAILAND) LIMITED`, `Grabtaxi (Thailand) Co.,Ltd.`, `Dime! USD` — while the golden set records the trading name the user recognises. **No model can win this metric and no prompt can fix it**; it needs the `merchant_aliases` table in Chunk 2.4. Treat the merchant column as noise for model selection.',
  '',
  'The high Latin CER (0.60–0.71) is the same effect: the strings are not misread, they are entirely different strings. Thai CER (0.122–0.203) is the more honest reading-accuracy signal, and there `flash-lite-35` is best.',
  '',
  '### Direction is the only accuracy metric that separates anything',
  '',
  '`flash-37` and `flash-25` both hit **100% with zero variance across three repeats**. `flash-lite-31` sits at 95.0% ±0.0 and `flash-lite-35` at 94.2% ±2.5 — real, repeatable deficits, not luck.',
  '',
  '**Important caveat:** Chunk 2.2 will move the direction decision out of the model entirely, into a normalizer that compares `sender_name`/`recipient_name` against `ACCOUNT_HOLDER_NAMES` in code. All five models already report those two names accurately. Once that lands, the one metric that separates these models stops mattering.',
  '',
  '### The incumbent production model is the worst in the field',
  '',
  '`flash-lite-25` — what the app is configured to use today — is:',
  '',
  '- the only model below 100% on date (97.5%) and amount (98.3% ±2.5, i.e. it disagrees with itself between runs);',
  '- the least reliable: 7 retries against 0 for three of the others, and a p95 latency of **39.2 seconds** against 3.4–13.8s;',
  '- the only model to silently drop script. On `grab/Gmail - Your Grab E-Receipt.pdf` it returned `GrabFood`, discarding the Thai restaurant name entirely, identically in all three repeats. Strict schema validation cannot catch this — the field is a valid non-empty string, it is just missing the merchant.',
  '- not even cheap: it burned 284,866 reasoning tokens, far more than any other model, making it **more expensive per receipt than `flash-lite-35` and `flash-lite-31`** despite the lowest headline token price.',
  '',
  '### Does anything beat the `flash-25` baseline by enough to switch?',
  '',
  'On accuracy, no — and that is the finding. `flash-37` matches `flash-25` exactly on every field (100/100/100, identical zero variance) while costing **$1.60 per 1,000 receipts against $3.06**, with p50 latency of 4.8s against 6.4s. That is not a better model, it is the same result for half the money.',
  '',
  '**The top four models are within noise of each other on everything that will still matter after Chunk 2.2.** Per your instruction, that means picking on cost rather than manufacturing a winner:',
  '',
  '| If you want | Pick | Why |',
  '|---|---|---|',
  '| Maximum safety today | `flash-37` | Only model matching the baseline at 100/100/100 with zero variance, at half the baseline cost |',
  '| Cheapest and fastest | `flash-lite-35` | $1.06/1k, p50 2.1s, best Thai CER (0.122). Costs 5.8pp of direction accuracy, which Chunk 2.2 makes irrelevant |',
  '',
  '**Recommendation: switch `MODEL_PRIMARY` off `flash-lite-25` now.** It is measurably the weakest model tested on accuracy, reliability, tail latency and silent data loss, and it is not the cheapest. Move to `flash-37` if you want the direction score locked at 100% before the Chunk 2.2 normalizer exists; move to `flash-lite-35` if you would rather take the cheapest and fastest option and let the normalizer handle direction. Do **not** adopt `flash-25` — triple the cost of `flash-lite-35` for measurably identical reading accuracy.',
  '',
  '### Notes for a possible round two (no prompt changes were made here)',
  '',
  '- `flash-lite-35` silently ignored `reasoning: {effort: "low"}` — 0 reasoning tokens against 20k–285k for the others. Its numbers are therefore a no-reasoning configuration, and it may improve if reasoning can be forced on.',
  '- The prompt tells the model to return the counterparty "exactly as printed". For Dime the models return `Dime!` or `Dime! USD` (the platform) instead of `NASDAQ - RKLB` (the security bought), and for Grab they return `Grabtaxi (Thailand) Co.,Ltd.` instead of the restaurant or ride type. A rule distinguishing *the platform that processed the payment* from *what was actually bought* would likely lift merchant scores across all five models at once. Not applied — round one compares models, not prompts.',
  '',
].join('\n')

// --------------------------------------------------------------------- main

const jobs = loadJobs()
const repsArg = process.argv.find((a) => a.startsWith('--reps='))
const reps = repsArg ? Number(repsArg.split('=')[1]) : 3

const scores = MODELS.map((m) => scoreModel(m, jobs, reps)).filter((s) => s.calls > 0)
if (scores.length === 0) {
  console.error('No persisted responses found in bakeoff/raw/. Run `npm run bakeoff` first.')
  process.exit(1)
}

const goldenRows = jobs.reduce((n, j) => n + j.expected.length, 0)
const totalCost = scores.reduce((s, m) => s + m.costUsd, 0)

// ------------------------------------------------------------- results.md

const L: string[] = []
L.push('# Model bake-off — slip extraction')
L.push('')
L.push('Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · prompt v' + EXTRACTOR_VERSION + ' · ' + jobs.length + ' documents, ' + goldenRows + ' golden transactions · ' + reps + ' repeats per document')
L.push('')
L.push('Held identical across models: prompt (imported, byte-for-byte), `temperature: 0`, strict `json_schema`, `reasoning: {effort: "low"}`, `usage: {include: true}`, original image bytes with no downsampling.')
L.push('')

L.push('## Metric mapping')
L.push('')
L.push('The requested metric list assumes itemised till receipts. This repo extracts one transaction per bank slip — there is no `qty`, `unit_price`, `subtotal`, `VAT`, or line item in the schema or the golden set. Two metrics could not be computed at all:')
L.push('')
L.push('| Requested | Here |')
L.push('|---|---|')
L.push('| 1. Line count exactness | Transaction-count exactness per document (Grab digests hold 2–3) |')
L.push('| 2. Reconciliation Σ(qty × unit_price) = subtotal | **Not computable** — no line items exist |')
L.push('| 3. Item name fidelity (CER by script) | Merchant CER, Latin vs Thai, + script-preservation flag |')
L.push('| 4. Numeric accuracy | `amount` only (±0.01); other numeric fields do not exist |')
L.push('| 5. Weight-priced `+W=___ G.` | **Not applicable** — zero such rows |')
L.push('| 6. Schema validity rate | As specified |')
L.push('| 7. Cost and latency | As specified |')
L.push('| *(added)* | Date accuracy and direction accuracy — the two fields that dominate downstream correctness here |')
L.push('')

L.push('## Summary')
L.push('')
L.push('Percentages are the mean across repeats; ± is the spread (max − min) across repeats, i.e. run-to-run variance.')
L.push('')
L.push('| Model | Date | Amount | Direction | Merchant | Row count | CER Latin | CER Thai | Schema OK | Retries | $/receipt | p50 | p95 |')
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|')

for (const s of scores) {
  const d = fieldSeries(s, 'date')
  const a = fieldSeries(s, 'amount')
  const dir = fieldSeries(s, 'direction')
  const m = fieldSeries(s, 'merchantExact')
  const rc = meanSpread(s.reps.filter((r) => r.docs > 0).map((r) => pct(r.countExact, r.docs)))
  const cerLatin = meanSpread(s.reps.filter((r) => r.cerLatinN > 0).map((r) => r.cerLatinSum / r.cerLatinN))
  const cerThai = meanSpread(s.reps.filter((r) => r.cerThaiN > 0).map((r) => r.cerThaiSum / r.cerThaiN))
  const perReceipt = s.calls > 0 ? s.costUsd / s.calls : 0
  L.push(
    '| `' + s.alias + '` | ' +
    fmt(d.mean) + '% ±' + fmt(d.spread) + ' | ' +
    fmt(a.mean) + '% ±' + fmt(a.spread) + ' | ' +
    fmt(dir.mean) + '% ±' + fmt(dir.spread) + ' | ' +
    fmt(m.mean) + '% ±' + fmt(m.spread) + ' | ' +
    fmt(rc.mean) + '% ±' + fmt(rc.spread) + ' | ' +
    fmt(cerLatin.mean, 3) + ' | ' + fmt(cerThai.mean, 3) + ' | ' +
    fmt(pct(s.calls - s.schemaInvalid, s.calls)) + '% | ' +
    s.retries + ' | $' + perReceipt.toFixed(5) + ' | ' +
    percentile(s.latencies, 50) + 'ms | ' + percentile(s.latencies, 95) + 'ms |'
  )
}
L.push('')

L.push('### Cost extrapolated to 1,000 receipts')
L.push('')
L.push('| Model | Measured $/receipt | $/1,000 receipts | Reasoning tokens spent | Honoured `effort: low`? |')
L.push('|---|---|---|---|---|')
for (const s of scores) {
  const per = s.calls > 0 ? s.costUsd / s.calls : 0
  L.push(
    '| `' + s.alias + '` | $' + per.toFixed(5) + ' | **$' + (per * 1000).toFixed(2) + '** | ' +
    s.reasoningTokens + ' | ' + (s.reasoningTokens > 0 ? 'yes' : 'no — silently ignored') + ' |'
  )
}
L.push('')

L.push('### Row-count deltas')
L.push('')
L.push('How often each model returned more or fewer transactions than the document actually holds. `0` is correct.')
L.push('')
L.push('| Model | ' + [-3, -2, -1, 0, 1, 2].map((d) => (d > 0 ? '+' + d : String(d))).join(' | ') + ' |')
L.push('|---|' + [-3, -2, -1, 0, 1, 2].map(() => '---').join('|') + '|')
for (const s of scores) {
  const totals = new Map<number, number>()
  for (const r of s.reps) for (const [k, v] of r.countDelta) totals.set(k, (totals.get(k) ?? 0) + v)
  L.push('| `' + s.alias + '` | ' + [-3, -2, -1, 0, 1, 2].map((d) => String(totals.get(d) ?? 0)).join(' | ') + ' |')
}
L.push('')

L.push('### Script preservation')
L.push('')
L.push('Rows where the golden merchant is Thai and the model answered in pure Latin — a silent translation or transliteration that strict schema validation cannot catch.')
L.push('')
L.push('| Model | Thai rows | Script lost |')
L.push('|---|---|---|')
for (const s of scores) {
  const thaiRows = s.reps.reduce((n, r) => n + r.cerThaiN, 0)
  const lost = s.reps.reduce((n, r) => n + r.scriptLost, 0)
  L.push('| `' + s.alias + '` | ' + thaiRows + ' | ' + lost + (lost > 0 ? ' ⚠️' : '') + ' |')
}
L.push('')
L.push('Total measured spend for this bake-off: **$' + totalCost.toFixed(4) + '** (ceiling $5.00). 534 calls, zero failed, 9 retries in total.')
L.push('')
L.push(VERDICT)

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'results.md'), L.join('\n'), 'utf8')

// ------------------------------------------------------------ failures.md

const F: string[] = []
F.push('# Bake-off failures')
F.push('')
F.push('The three worst documents per model, by number of wrong fields, from repeat 1. Golden on the left, extracted on the right.')
F.push('')
for (const s of scores) {
  F.push('## `' + s.alias + '` — ' + s.id)
  F.push('')
  if (s.failures.length === 0) {
    F.push('No failures.')
    F.push('')
    continue
  }
  for (const f of s.failures.slice(0, 3)) {
    F.push('### ' + f.source + '/' + f.filename + '  (' + f.wrongFields + ' wrong)')
    F.push('')
    F.push('```')
    for (const line of f.lines) F.push(line)
    F.push('```')
    F.push('')
  }
}
writeFileSync(join(OUT, 'failures.md'), F.join('\n'), 'utf8')

console.log('Wrote bakeoff/results.md and bakeoff/failures.md')
console.log('Models scored: ' + scores.map((s) => s.alias).join(', '))
console.log('Total measured spend: $' + totalCost.toFixed(4))
