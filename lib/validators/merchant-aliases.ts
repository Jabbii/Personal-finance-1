// lib/validators/merchant-aliases.ts
// Mirrors migrations/001_schema.sql `merchant_aliases` table.

import { z } from 'zod'

export const merchantAliasSchema = z.object({
  alias: z.string().min(1),
  merchant_id: z.string().uuid(),
})

export type MerchantAlias = z.infer<typeof merchantAliasSchema>
