// lib/validators/transactions.ts
// Mirrors migrations/001_schema.sql `transactions` table.

import { z } from 'zod'

export const TRANSACTION_DIRECTIONS = ['income', 'expense', 'transfer'] as const

export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  currency: z.string().length(3).default('THB'),
  direction: z.enum(TRANSACTION_DIRECTIONS),
  merchant_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid(),
  reference_no: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  extractor_version: z.string().min(1),
  created_at: z.coerce.date().optional(),
})

export type Transaction = z.infer<typeof transactionSchema>
