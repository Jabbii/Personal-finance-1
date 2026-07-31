// lib/validators/categories.ts
// Mirrors migrations/001_schema.sql `categories` table.

import { z } from 'zod'

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  parent_id: z.string().uuid().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  created_at: z.coerce.date().optional(),
})

export type Category = z.infer<typeof categorySchema>
