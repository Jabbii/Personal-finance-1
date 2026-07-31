// lib/db/client.test.ts
// Chunk 1.3 acceptance test: proves the postgres.js client can reach the
// real Supabase project over the Transaction pooler.
//
// This test talks to your live Supabase project over the network, so it
// only runs when DATABASE_URL is available (your local .env.local). CI has
// no copy of .env.local, so it skips there automatically — intentional.

import { describe, it, expect, afterAll } from 'vitest'
import { loadEnvLocal } from '../env'

loadEnvLocal()

const canRun = Boolean(process.env.DATABASE_URL)

if (!canRun) {
  console.warn(
    '[lib/db/client.test.ts] Skipped — set DATABASE_URL in .env.local to run ' +
    'this against your real Supabase project.'
  )
}

describe.skipIf(!canRun)('Chunk 1.3 — postgres.js client', () => {
  it('connects and runs select 1', async () => {
    const { sql } = await import('./client')
    try {
      const result = await sql`select 1 as ok`
      expect(result[0].ok).toBe(1)
    } finally {
      await sql.end({ timeout: 3 })
    }
  })
})
