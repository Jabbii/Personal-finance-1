// lib/validators/transaction-evidence.ts
// Mirrors migrations/001_schema.sql `transaction_evidence` table.

import { z } from 'zod'

export const transactionEvidenceSchema = z.object({
  transaction_id: z.string().uuid(),
  raw_input_id: z.string().uuid(),
})

export type TransactionEvidence = z.infer<typeof transactionEvidenceSchema>
