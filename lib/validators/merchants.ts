// lib/validators/merchants.ts
// Mirrors migrations/001_schema.sql `merchants` table.

import { z } from 'zod'

export const merchantSchema = z.object({
  id: z.string().uuid().optional(),
  canonical_name: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  created_by: z.string().min(1).default('csv-bootstrap'),
  created_at: z.coerce.date().optional(),
})

export type Merchant = z.infer<typeof merchantSchema>
