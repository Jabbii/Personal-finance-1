// lib/db/client.ts
// Direct Postgres connection via postgres.js, bypassing Supabase's REST API
// layer. Uses Supabase's Transaction pooler (port 6543), which works for
// both the long-running local sync script and future Vercel serverless
// functions — see docs/adr for the reasoning.
//
// `prepare: false` is required for the Transaction pooler: PgBouncer in
// transaction mode doesn't support session-level prepared statements.

import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local.')
}

export const sql = postgres(connectionString, { prepare: false })
