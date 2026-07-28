// migrations/rls.test.ts
// Chunk 1.1 acceptance test: proves the SQL in this folder was applied
// correctly to the real Supabase project.
//   1. Every table exists and returns nothing to an anonymous caller.
//   2. An anonymous insert is rejected with Postgres error 42501
//      (insufficient_privilege) — the exact check the plan requires.
//
// This test talks to your live Supabase project over the network, so it
// only runs when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// are available (your local .env.local). CI has no copy of .env.local, so
// it skips there automatically — that's intentional, not a bug.

import { describe, it, expect } from 'vitest'
import { loadEnvLocal } from '../lib/env'

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const canRun = Boolean(SUPABASE_URL && ANON_KEY)

const TABLES = [
  'accounts',
  'categories',
  'merchants',
  'merchant_aliases',
  'raw_inputs',
  'transactions',
  'transaction_evidence',
  'budgets',
]

if (!canRun) {
  console.warn(
    '[migrations/rls.test.ts] Skipped — set NEXT_PUBLIC_SUPABASE_URL and ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to run this against your ' +
    'real Supabase project.'
  )
}

describe.skipIf(!canRun)('Chunk 1.1 — DB schema + RLS', () => {
  it('every table exists and hides its rows from an anonymous caller', async () => {
    for (const table of TABLES) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: ANON_KEY!,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      })
      expect(res.status, `${table}: expected 200 (table missing or misnamed?)`).toBe(200)
      const body = await res.json()
      expect(body, `${table}: anonymous caller should see zero rows`).toEqual([])
    }
  })

  it('blocks an anonymous insert with Postgres error 42501', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY!,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        bank_name: 'test',
        account_name: 'test',
        account_type: 'test',
      }),
    })
    // Supabase's newer publishable/secret key system wraps this as HTTP 401;
    // older anon-key JWT projects wrap it as 403. Either way, the Postgres
    // error code below is the actual proof RLS blocked the write.
    expect([401, 403]).toContain(res.status)
    const body = await res.json()
    expect(body.code).toBe('42501')
  })
})
