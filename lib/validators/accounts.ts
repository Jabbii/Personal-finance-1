// lib/validators/accounts.ts
// Mirrors migrations/001_schema.sql `accounts` table.

import { z } from 'zod'

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  bank_name: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1),
  current_balance: z.coerce.number().default(0),
  created_at: z.coerce.date().optional(),
})

export type Account = z.infer<typeof accountSchema>
