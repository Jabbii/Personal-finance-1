// lib/validators/budgets.ts
// Mirrors migrations/001_schema.sql `budgets` table.

import { z } from 'zod'

export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  monthly_limit: z.coerce.number(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export type Budget = z.infer<typeof budgetSchema>
