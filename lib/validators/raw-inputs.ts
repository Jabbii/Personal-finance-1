// lib/validators/raw-inputs.ts
// Mirrors migrations/001_schema.sql `raw_inputs` table.

import { z } from 'zod'

export const RAW_INPUT_SOURCES = ['bank_slip', 'line_screenshot', 'money_manager_csv'] as const

// `storage_tier` was dropped in migrations/005 — slip images are never
// uploaded, so there are no tiers to move between. `file_path` points at the
// original in OneDrive. See docs/adr/002-drop-supabase-storage.md.

export const rawInputSchema = z.object({
  id: z.string().uuid().optional(),
  source: z.enum(RAW_INPUT_SOURCES),
  file_path: z.string().min(1),
  file_hash: z.string().min(1),
  extractor_version: z.string().min(1),
  ocr_response: z.record(z.string(), z.unknown()).nullable().optional(),
  ingested_at: z.coerce.date().optional(),
  archived_at: z.coerce.date().nullable().optional(),
})

export type RawInput = z.infer<typeof rawInputSchema>
