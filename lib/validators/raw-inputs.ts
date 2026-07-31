// lib/validators/raw-inputs.ts
// Mirrors migrations/001_schema.sql `raw_inputs` table.

import { z } from 'zod'

export const RAW_INPUT_SOURCES = ['bank_slip', 'line_screenshot', 'money_manager_csv'] as const
export const STORAGE_TIERS = ['hot', 'cold', 'deleted'] as const

export const rawInputSchema = z.object({
  id: z.string().uuid().optional(),
  source: z.enum(RAW_INPUT_SOURCES),
  storage_tier: z.enum(STORAGE_TIERS).default('hot'),
  file_path: z.string().min(1),
  file_hash: z.string().min(1),
  extractor_version: z.string().min(1),
  ocr_response: z.record(z.string(), z.unknown()).nullable().optional(),
  ingested_at: z.coerce.date().optional(),
  archived_at: z.coerce.date().nullable().optional(),
})

export type RawInput = z.infer<typeof rawInputSchema>
