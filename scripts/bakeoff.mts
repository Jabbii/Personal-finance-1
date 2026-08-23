// scripts/bakeoff.mts
// Controlled model comparison for the slip-extraction step.
//
//   npm run bakeoff              full run: 5 models x 36 docs x 3 repeats
//   npm run bakeoff -- --reps=1  fewer repeats
//   npm run bakeoff -- --score   re-score persisted responses, no API calls
//
// FIXED CONDITIONS — everything not on the model axis is identical:
//   * SYSTEM_PROMPT and buildUserPrompt() are imported from lib/prompts, so
//     the prompt is byte-for-byte the same for every model. Never copied here.
//   * temperature 0
//   * response_format json_schema, strict: true
//   * reasoning { effort: 'low' } sent to all; whether a model actually spent
//     reasoning tokens is recorded rather than assumed
//   * usage { include: true } so cost comes from the provider, not an estimate
//   * original image bytes, no downsampling
//
// The golden data never enters a request body. Extraction runs blind against
// the image alone; scoring happens afterwards from the persisted responses,
// so changing the scoring logic never means paying for the calls again.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractionSchema,
  EXTRACTOR_VERSION,
  type ExtractedTransaction,
} from '../lib/prompts/extract-slip.ts'
import { groupByFilename, parseNotesCsv, type GoldenRow } from '../lib/eval/notes.ts'
import { matchRows } from '../lib/eval/score.ts'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const FIXTURES = join(ROOT, 'fixtures')
const OUT = join(ROOT, 'bakeoff')
const RAW = join(OUT, 'raw')

const COST_CEILING_USD = 5
const MAX_ATTEMPTS = 3
const CONCURRENCY = 4

export const MODELS = [
  { alias: 'flash-lite-31', id: 'google/gemini-3.1-flash-lite' },
  { alias: 'flash-37', id: 'google/gemini-3.7-flash' },
  { alias: 'flash-lite-35', id: 'google/gemini-3.5-flash-lite' },
  { alias: 'flash-25', id: 'google/gemini-2.5-flash' },
  { alias: 'flash-lite-25', id: 'google/gemini-2.5-flash-lite' },
] as const

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
}

// Strict JSON Schema mirroring extractionSchema. Strict mode wants every
// property in `required` and additionalProperties false; nullable is a type
// union rather than a Zod .nullable().
const JSON_SCHEMA = {
  name: 'slip_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            direction: { type: 'string', enum: ['income', 'expense', 'transfer'] },
            merchant: { type: ['string', 'null'] },
            sender_name: { type: ['string', 'null'] },
            recipient_name: { type: ['string', 'null'] },
            reference_no: { type: ['string', 'null'] },
          },
          required: [
            'date',
            'amount',
            'currency',
            'direction',
            'merchant',
            'sender_name',
            'recipient_name',
            'reference_no',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['transactions'],
    additionalProperties: false,
  },
}

export interface Job {
  source: string
  filename: string
  path: string
  expected: GoldenRow[]
}

export function loadJobs(): Job[] {
  const jobs: Job[] = []
  for (const entry of readdirSync(FIXTURES, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const notes = join(FIXTURES, entry.name, 'notes.csv')
    if (!existsSync(notes)) continue
    const rows = parseNotesCsv(readFileSync(notes, 'utf8'), entry.name + '/notes.csv')
    for (const [filename, expected] of groupByFilename(rows)) {
      jobs.push({ source: entry.name, filename, path: join(FIXTURES, entry.name, filename), expected })
    }
  }
  return jobs.sort((a, b) => (a.source + a.filename).localeCompare(b.source + b.filename))
}

export function slug(text: string): string {
  return text.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

export interface RawRecord {
  model: string
  alias: string
  source: string
  filename: string
  rep: number
  ok: boolean
  error?: string
  attempts: number
  retries: number
  latency_ms: number
  usage?: Record<string, any>
  cost_usd?: number
  reasoning_tokens?: number
  content?: string
  parsed?: { transactions: ExtractedTransaction[] }
  schema_valid?: boolean
  recovered_on_retry?: boolean
}

export function rawPath(alias: string, job: Job, rep: number): string {
  return join(RAW, alias, slug(job.source + '__' + job.filename), 'rep' + rep + '.json')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const ACCOUNT_NAMES = (process.env.ACCOUNT_HOLDER_NAMES ?? '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)

let spentUsd = 0
let aborted = false

async function callOnce(model: string, job: Job) {
  const ext = extname(job.path).toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new Error('unsupported file type ' + ext)
  const url = 'data:' + mime + ';base64,' + readFileSync(job.path).toString('base64')
  const attachment =
    mime === 'application/pdf'
      ? { type: 'file', file: { filename: basename(job.path), file_data: url } }
      : { type: 'image_url', image_url: { url } }

  const started = Date.now()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      reasoning: { effort: 'low' },
      usage: { include: true },
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildUserPrompt({ accountHolderNames: ACCOUNT_NAMES }) },
            attachment,
          ],
        },
      ],
    }),
  })
  const text = await res.text()
  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 2000) }
  }
  return { res, body, latency: Date.now() - started }
}

async function runOne(model: { alias: string; id: string }, job: Job, rep: number): Promise<RawRecord> {
  const record: RawRecord = {
    model: model.id,
    alias: model.alias,
    source: job.source,
    filename: job.filename,
    rep,
    ok: false,
    attempts: 0,
    retries: 0,
    latency_ms: 0,
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    record.attempts = attempt
    if (attempt > 1) record.retries++
    try {
      const { res, body, latency } = await callOnce(model.id, job)
      record.latency_ms = latency

      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500
        record.error = 'HTTP ' + res.status + ': ' + JSON.stringify(body?.error ?? body).slice(0, 300)
        if (retryable && attempt < MAX_ATTEMPTS) {
          await sleep(1000 * Math.pow(2, attempt - 1))
          continue
        }
        return record
      }

      const usage = body?.usage ?? {}
      record.usage = usage
      record.cost_usd = typeof usage.cost === 'number' ? usage.cost : 0
      spentUsd += record.cost_usd ?? 0
      record.reasoning_tokens =
        usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0

      const content = body?.choices?.[0]?.message?.content
      record.content = typeof content === 'string' ? content : JSON.stringify(content)

      try {
        const parsed = extractionSchema.safeParse(JSON.parse(record.content ?? ''))
        record.schema_valid = parsed.success
        if (parsed.success) {
          record.parsed = parsed.data
          record.ok = true
          if (attempt > 1) record.recovered_on_retry = true
        } else {
          record.error = 'schema validation failed: ' + parsed.error.message.slice(0, 200)
        }
      } catch (e) {
        record.schema_valid = false
        record.error = 'unparseable JSON: ' + String((e as Error).message).slice(0, 150)
      }

      if (!record.ok && attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt)
        continue
      }
      return record
    } catch (e) {
      record.error = String((e as Error).message).slice(0, 300)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 * Math.pow(2, attempt - 1))
        continue
      }
      return record
    }
  }
  return record
}

async function extractAll(reps: number): Promise<void> {
  const jobs = loadJobs()
  const tasks: Array<{ model: { alias: string; id: string }; job: Job; rep: number }> = []
  for (const model of MODELS) {
    for (const job of jobs) {
      for (let rep = 1; rep <= reps; rep++) tasks.push({ model, job, rep })
    }
  }

  const pending = tasks.filter((t) => !existsSync(rawPath(t.model.alias, t.job, t.rep)))
  console.log(
    MODELS.length + ' models x ' + jobs.length + ' documents x ' + reps + ' repeats = ' + tasks.length + ' calls'
  )
  console.log(tasks.length - pending.length + ' already on disk, ' + pending.length + ' to run')
  console.log('prompt v' + EXTRACTOR_VERSION + ', temperature 0, strict json_schema, no downsampling\n')

  let done = 0
  const queue = [...pending]

  async function worker(): Promise<void> {
    while (queue.length > 0 && !aborted) {
      const task = queue.shift()
      if (!task) return
      const record = await runOne(task.model, task.job, task.rep)
      const path = rawPath(task.model.alias, task.job, task.rep)
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, JSON.stringify(record, null, 2), 'utf8')
      done++
      const label = (task.job.source + '/' + task.job.filename).slice(0, 42)
      console.log(
        '[' + String(done).padStart(3) + '/' + pending.length + '] ' +
          (record.ok ? 'ok  ' : 'FAIL') + ' ' +
          task.model.alias.padEnd(14) + label.padEnd(43) + ' r' + task.rep + ' ' +
          String(record.latency_ms).padStart(6) + 'ms $' + (record.cost_usd ?? 0).toFixed(5) +
          ' run=$' + spentUsd.toFixed(4) +
          (record.error ? '  ' + record.error.slice(0, 60) : '')
      )
      if (spentUsd > COST_CEILING_USD) {
        aborted = true
        console.error('\nCOST CEILING HIT: $' + spentUsd.toFixed(4) + ' > $' + COST_CEILING_USD + '. Aborting.')
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  console.log('\nExtraction complete. Spend this run: $' + spentUsd.toFixed(4))
}

const repsArg = process.argv.find((a) => a.startsWith('--reps='))
const reps = repsArg ? Number(repsArg.split('=')[1]) : 3

// Only extract when this file IS the program being run. score-bakeoff.mts
// imports loadJobs/rawPath/MODELS from here, and without this guard that
// import kicked off a second full extraction run — spending real money in
// parallel with the first one. An imported module must never have side effects
// that cost money.
const isEntrypoint =
  typeof process.argv[1] === 'string' && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint && !process.argv.includes('--score')) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not set. Run via npm so .env.local loads.')
    process.exit(2)
  }
  await extractAll(reps)
}

export { matchRows }
