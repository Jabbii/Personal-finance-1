// scripts/eval.mts
// Chunk 1.5 — the golden set report card.
//
//   npm run eval                 use cached answers, call the model for misses
//   npm run eval -- --refresh    ignore the cache, call the model for everything
//   npm run eval -- --offline    never call the model; fail on a cache miss (CI)
//   npm run eval -- --dry        parse fixtures and stop. No network, no cost.
//   npm run eval -- --source=kbank --limit=2
//
// WHY THE CACHE. Every model response is written to fixtures/.cache/ keyed by
// file hash + model + extractor version. Re-running is then free and instant,
// which matters because the whole point of this runner is to be run over and
// over while the prompt is tuned. A prompt change bumps EXTRACTOR_VERSION,
// which changes the key, which re-calls the model automatically — a stale
// answer can never be scored against a new prompt.
//
// This is the only script in the project that spends money. It prints what it
// is about to call before it calls it.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { callModel, OpenRouterError } from '../lib/openrouter/client.ts'
import {
  EXTRACTOR_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractionSchema,
  type ExtractedTransaction,
} from '../lib/prompts/extract-slip.ts'
import { groupByFilename, parseNotesCsv, type GoldenRow } from '../lib/eval/notes.ts'
import {
  SCORED_FIELDS,
  buildReport,
  matchRows,
  percent,
  type FileResult,
  type Report,
} from '../lib/eval/score.ts'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const FIXTURES = join(ROOT, 'fixtures')
const CACHE = join(FIXTURES, '.cache')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

// ---------------------------------------------------------------- arguments

interface Options {
  refresh: boolean
  offline: boolean
  dry: boolean
  source?: string
  limit?: number
}

function parseArgs(argv: string[]): Options {
  const options: Options = { refresh: false, offline: false, dry: false }
  for (const arg of argv) {
    if (arg === '--refresh') options.refresh = true
    else if (arg === '--offline') options.offline = true
    else if (arg === '--dry') options.dry = true
    else if (arg.startsWith('--source=')) options.source = arg.slice('--source='.length)
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length))
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(2)
    }
  }
  if (options.refresh && options.offline) {
    console.error('--refresh and --offline contradict each other.')
    process.exit(2)
  }
  return options
}

// ------------------------------------------------------------------ loading

interface Job {
  source: string
  filename: string
  path: string
  expected: GoldenRow[]
}

function loadJobs(options: Options): Job[] {
  const sources = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => !options.source || name === options.source)
    .sort()

  if (options.source && sources.length === 0) {
    console.error(`No fixture folder named "${options.source}".`)
    process.exit(2)
  }

  const jobs: Job[] = []

  for (const source of sources) {
    const notesPath = join(FIXTURES, source, 'notes.csv')
    if (!existsSync(notesPath)) {
      console.warn(`  ! ${source}: no notes.csv, skipped`)
      continue
    }

    const rows = parseNotesCsv(readFileSync(notesPath, 'utf8'), `${source}/notes.csv`)
    for (const [filename, expected] of groupByFilename(rows)) {
      const path = join(FIXTURES, source, filename)
      if (!existsSync(path)) {
        console.error(`  ! ${source}/${filename} is in notes.csv but not on disk`)
        process.exit(1)
      }
      jobs.push({ source, filename, path, expected })
    }
  }

  return options.limit ? jobs.slice(0, options.limit) : jobs
}

// -------------------------------------------------------------------- cache

function cacheKey(job: Job, model: string): string {
  const bytes = readFileSync(job.path)
  const fileHash = createHash('sha256').update(bytes).digest('hex')
  const promptHash = createHash('sha256')
    .update(`${model}\n${EXTRACTOR_VERSION}\n${SYSTEM_PROMPT}`)
    .digest('hex')
    .slice(0, 12)
  return `${fileHash.slice(0, 16)}-${promptHash}`
}

function readCache(key: string): ExtractedTransaction[] | null {
  const path = join(CACHE, `${key}.json`)
  if (!existsSync(path)) return null
  try {
    const parsed = extractionSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')).response)
    return parsed.success ? parsed.data.transactions : null
  } catch {
    return null
  }
}

function writeCache(key: string, job: Job, model: string, transactions: ExtractedTransaction[]): void {
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(
    join(CACHE, `${key}.json`),
    JSON.stringify(
      {
        source: job.source,
        filename: job.filename,
        model,
        extractor_version: EXTRACTOR_VERSION,
        cached_at: new Date().toISOString(),
        response: { transactions },
      },
      null,
      2
    ),
    'utf8'
  )
}

// ------------------------------------------------------------------ calling

function dataUrl(path: string): { mime: string; url: string } {
  const ext = extname(path).toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new Error(`Unsupported file type "${ext}" — add it to MIME in scripts/eval.mts`)
  return { mime, url: `data:${mime};base64,${readFileSync(path).toString('base64')}` }
}

async function extract(job: Job, model: string, names: string[]): Promise<ExtractedTransaction[]> {
  const { mime, url } = dataUrl(job.path)
  const result = await callModel({
    model,
    schema: extractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({ accountHolderNames: names }),
    ...(mime === 'application/pdf'
      ? { file: { filename: basename(job.path), dataUrl: url } }
      : { imageUrl: url }),
  })
  return result.transactions
}

// ------------------------------------------------------------------- report

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width)
  const colour = pct >= 95 ? GREEN : pct >= 80 ? YELLOW : RED
  return `${colour}${'█'.repeat(filled)}${DIM}${'░'.repeat(width - filled)}${RESET}`
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

function printReport(report: Report, model: string, calls: number, cached: number): void {
  console.log(`\n${BOLD}Golden set — ${model}, extractor v${EXTRACTOR_VERSION}${RESET}`)
  console.log(
    `${DIM}${report.files.length} documents · ${report.exactRows.total} transactions · ` +
      `${cached} from cache · ${calls} model calls${RESET}\n`
  )

  console.log(`${BOLD}FIELD ACCURACY${RESET}`)
  for (const field of SCORED_FIELDS) {
    const tally = report.fields[field]
    const pct = percent(tally)
    console.log(
      `  ${pad(field, 11)}${pad(`${tally.passed}/${tally.total}`, 8)}` +
        `${pad(`${pct.toFixed(0)}%`, 6)}${bar(pct)}`
    )
  }

  const exactPct = percent(report.exactRows)
  console.log(
    `\n  ${BOLD}${pad('all four', 11)}${pad(`${report.exactRows.passed}/${report.exactRows.total}`, 8)}` +
      `${pad(`${exactPct.toFixed(0)}%`, 6)}${RESET}${bar(exactPct)}`
  )

  if (report.missingRows || report.spuriousRows || report.documentsWithErrors) {
    console.log(
      `\n  ${DIM}missed ${report.missingRows} · invented ${report.spuriousRows} · ` +
        `failed calls ${report.documentsWithErrors}${RESET}`
    )
  }

  console.log(`\n${BOLD}BY SOURCE${RESET}`)
  console.log(`  ${DIM}${pad('source', 12)}${pad('rows', 6)}${SCORED_FIELDS.map((f) => pad(f, 11)).join('')}${RESET}`)
  for (const [source, tally] of [...report.bySource].sort()) {
    const cells = SCORED_FIELDS.map((f) => {
      const pct = percent(tally[f])
      const colour = pct >= 95 ? GREEN : pct >= 80 ? YELLOW : RED
      return `${colour}${pad(`${pct.toFixed(0)}%`, 11)}${RESET}`
    }).join('')
    console.log(`  ${pad(source, 12)}${pad(String(tally.date.total), 6)}${cells}`)
  }

  const failures = report.files.filter(
    (file) => file.error || file.rows.some((row) => SCORED_FIELDS.some((f) => !row.fields[f]))
  )
  if (failures.length === 0) {
    console.log(`\n${GREEN}${BOLD}Every field on every transaction is correct.${RESET}`)
    return
  }

  console.log(`\n${BOLD}FAILURES${RESET} ${DIM}(${failures.length} documents)${RESET}`)
  for (const file of failures) {
    console.log(`\n  ${BOLD}${file.source}/${file.filename}${RESET}`)
    if (file.error) {
      console.log(`    ${RED}call failed${RESET} ${file.error}`)
      continue
    }
    for (const row of file.rows) {
      if (row.actual === null) {
        console.log(
          `    ${RED}not found${RESET}  expected ${row.expected.amount} ` +
            `${row.expected.direction} ${row.expected.merchant}`
        )
        continue
      }
      for (const field of SCORED_FIELDS) {
        if (row.fields[field]) continue
        console.log(
          `    ${RED}${pad(field, 10)}${RESET} expected ${BOLD}${row.expected[field]}${RESET}` +
            `  got ${BOLD}${row.actual[field]}${RESET}`
        )
      }
      if (row.expected.notes) console.log(`    ${DIM}note: ${row.expected.notes}${RESET}`)
    }
    for (const extra of file.spurious) {
      console.log(`    ${YELLOW}invented${RESET}  ${extra.amount} ${extra.direction} ${extra.merchant}`)
    }
  }
}

// --------------------------------------------------------------------- main

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const model = process.env.MODEL_PRIMARY ?? 'google/gemini-2.5-flash-lite'
  const names = (process.env.ACCOUNT_HOLDER_NAMES ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  const jobs = loadJobs(options)
  const totalRows = jobs.reduce((sum, job) => sum + job.expected.length, 0)

  console.log(
    `${BOLD}Loaded${RESET} ${jobs.length} documents, ${totalRows} ground-truth transactions ` +
      `from ${new Set(jobs.map((j) => j.source)).size} sources`
  )

  if (names.length === 0) {
    console.warn(
      `${YELLOW}  ! ACCOUNT_HOLDER_NAMES is not set in .env.local — the model has no way to ` +
        `recognise a same-person transfer, so expect the direction score to suffer.${RESET}`
    )
  }

  if (options.dry) {
    console.log(`${GREEN}Fixtures parsed cleanly. Nothing called, nothing spent.${RESET}`)
    for (const job of jobs.filter((j) => j.expected.length > 1)) {
      console.log(`  ${DIM}${job.source}/${job.filename} holds ${job.expected.length} transactions${RESET}`)
    }
    return
  }

  if (!options.offline && !process.env.OPENROUTER_API_KEY) {
    console.error(
      `${RED}OPENROUTER_API_KEY is not set.${RESET} Run through "npm run eval" so .env.local loads, ` +
        `or pass --offline to score cached answers only.`
    )
    process.exit(2)
  }

  const results: FileResult[] = []
  let calls = 0
  let cached = 0

  for (const [index, job] of jobs.entries()) {
    const key = cacheKey(job, model)
    const progress = `${DIM}[${String(index + 1).padStart(2)}/${jobs.length}]${RESET}`
    let transactions: ExtractedTransaction[] | null = options.refresh ? null : readCache(key)

    if (transactions) {
      cached++
      console.log(`${progress} ${DIM}cached${RESET}  ${job.source}/${job.filename}`)
    } else if (options.offline) {
      console.log(`${progress} ${RED}no cache${RESET} ${job.source}/${job.filename}`)
      results.push({
        source: job.source,
        filename: job.filename,
        rows: matchRows(job.expected, []),
        spurious: [],
        error: 'no cached response and --offline was set',
      })
      continue
    } else {
      console.log(`${progress} ${YELLOW}calling${RESET} ${job.source}/${job.filename}`)
      try {
        transactions = await extract(job, model, names)
        calls++
        writeCache(key, job, model, transactions)
      } catch (error) {
        calls++
        const message =
          error instanceof OpenRouterError ? error.message : String((error as Error).message ?? error)
        console.log(`         ${RED}failed${RESET} ${message.slice(0, 160)}`)
        results.push({
          source: job.source,
          filename: job.filename,
          rows: matchRows(job.expected, []),
          spurious: [],
          error: message.slice(0, 300),
        })
        continue
      }
    }

    const rows = matchRows(job.expected, transactions)
    const matched = new Set(rows.map((r) => r.actual).filter(Boolean))
    results.push({
      source: job.source,
      filename: job.filename,
      rows,
      spurious: transactions.filter((t) => !matched.has(t)),
    })
  }

  const report = buildReport(results)
  printReport(report, model, calls, cached)

  // Non-zero exit on a failed call so CI notices; accuracy itself is reported,
  // not enforced, until Chunk 2.2 sets the >95% bar.
  if (report.documentsWithErrors > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`${RED}Eval crashed:${RESET}`, error)
  process.exit(1)
})
