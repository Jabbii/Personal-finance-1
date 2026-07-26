// check-env.js — runs on postinstall via package.json
// Verifies the local environment is ready before you try to run or build.
// Plain Node.js only — no dependencies, no imports.

'use strict'

const fs   = require('fs')
const path = require('path')

const MIN_NODE = 20
const ROOT     = path.resolve(__dirname, '..')
const PASS     = '  ✓ '
const FAIL     = '  ✗ '
const WARN     = '  ⚠  '

let errors   = 0
let warnings = 0

function pass(msg)  { console.log(`\x1b[32m${PASS}\x1b[0m${msg}`) }
function fail(msg)  { console.error(`\x1b[31m${FAIL}\x1b[0m${msg}`); errors++ }
function warn(msg)  { console.warn(`\x1b[33m${WARN}\x1b[0m${msg}`); warnings++ }
function header(msg){ console.log(`\n\x1b[1m${msg}\x1b[0m`) }

// ── Skip in CI (GitHub Actions sets CI=true automatically) ──────────────────
if (process.env.CI) {
  console.log('check-env: CI environment — skipping local checks.')
  process.exit(0)
}

console.log('\n\x1b[1mcheck-env — verifying your local setup\x1b[0m')
console.log('─'.repeat(44))

// ── 1. Node version ──────────────────────────────────────────────────────────
header('1. Node.js version')
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10)
if (nodeMajor < MIN_NODE) {
  fail(`Node ${process.version} is too old. Need Node ${MIN_NODE}+.`)
  console.error('     Download the latest LTS at https://nodejs.org/')
} else {
  pass(`Node ${process.version}`)
}

// ── 2. .env.local exists ─────────────────────────────────────────────────────
header('2. Environment file')
const envPath = path.join(ROOT, '.env.local')

if (!fs.existsSync(envPath)) {
  warn('.env.local not found.')
  console.warn('     Copy .env.example to .env.local and fill in your values.')
  console.warn('     The app and sync script will not work without it.')
  console.log('\n' + '─'.repeat(44))
  console.log(`\n  ${warnings} warning(s). Finish setting up .env.local to continue.\n`)
  process.exit(0)  // not fatal — expected during first-time setup
}
pass('.env.local found')

// ── 3. Parse .env.local ──────────────────────────────────────────────────────
const envVars = {}
fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) return
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    envVars[key] = val
  })

// ── 4. Required vars present and not placeholder ─────────────────────────────
header('3. Required environment variables')

const REQUIRED = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',   hint: 'Found in Supabase → Settings → API' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Found in Supabase → Settings → API' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',  hint: 'Found in Supabase → Settings → API (keep secret!)' },
  { key: 'OPENROUTER_API_KEY',         hint: 'Found in openrouter.ai → Keys' },
]

const PLACEHOLDER_PATTERNS = ['your-', 'xxx', 'replace', 'todo', '<', '>']

for (const { key, hint } of REQUIRED) {
  const val = envVars[key]
  if (!val) {
    fail(`${key} is missing.`)
    console.error(`     ${hint}`)
  } else if (PLACEHOLDER_PATTERNS.some(p => val.toLowerCase().includes(p))) {
    warn(`${key} looks like it still has a placeholder value.`)
    console.warn(`     ${hint}`)
  } else {
    pass(key)
  }
}

// ── 5. Security: no server secret with NEXT_PUBLIC_ prefix ───────────────────
header('4. Secret safety check')

const DANGEROUS = ['SERVICE_ROLE', 'SECRET', 'PRIVATE', 'PASSWORD']
let leaked = false
for (const key of Object.keys(envVars)) {
  if (key.startsWith('NEXT_PUBLIC_') && DANGEROUS.some(d => key.includes(d))) {
    fail(`${key} is a server-only secret but has NEXT_PUBLIC_ prefix.`)
    console.error('     This would expose it in the browser. Rename it.')
    leaked = true
  }
}
if (!leaked) pass('No server secrets exposed to browser')

// ── 6. OneDrive path reachable (optional) ────────────────────────────────────
header('5. OneDrive slip folder')

const onedrivePath = envVars['ONEDRIVE_SLIP_PATH']
if (!onedrivePath) {
  warn('ONEDRIVE_SLIP_PATH not set in .env.local.')
  console.warn('     Set it to the folder where your bank slips are stored.')
  console.warn('     Example: C:\\Users\\YourName\\OneDrive\\Bank Slips')
} else if (!fs.existsSync(onedrivePath)) {
  warn(`Path not found: ${onedrivePath}`)
  console.warn('     Check the path in .env.local — OneDrive may not have synced yet.')
} else {
  pass(`${onedrivePath}`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(44))

if (errors > 0) {
  console.error(`\n\x1b[31m  ${errors} error(s) found. Fix them before running the app.\x1b[0m\n`)
  process.exit(1)
} else if (warnings > 0) {
  console.warn(`\n\x1b[33m  ${warnings} warning(s). App may not work fully until resolved.\x1b[0m\n`)
  process.exit(0)
} else {
  console.log('\n\x1b[32m  All checks passed. You are good to go.\x1b[0m\n')
  process.exit(0)
}
