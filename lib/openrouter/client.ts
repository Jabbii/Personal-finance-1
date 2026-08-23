// lib/openrouter/client.ts
// Thin gateway to OpenRouter's chat completions API. One call in, one typed
// object out — model choice lives in `.env.local` (MODEL_PRIMARY /
// MODEL_FALLBACK / MODEL_ANALYSIS), so swapping OCR providers never touches
// call sites (see docs/PLAN.md Tech Stack).
//
// Models occasionally wrap JSON in a ```json fence even when asked not to —
// stripFences() strips that before parsing. response_format: json_object
// forces JSON-shaped output where the model supports it; the Zod schema is
// the real guarantee regardless of what the model actually returns.

import type { z } from 'zod'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

export interface CallModelOptions<T> {
  model: string
  schema: z.ZodType<T>
  userPrompt: string
  systemPrompt?: string
  imageUrl?: string
  /**
   * A PDF to read, as a `data:application/pdf;base64,...` URL. OpenRouter takes
   * these as a `file` content part rather than an `image_url`; Gemini reads
   * multi-page PDFs directly, which is how one Grab digest yields several
   * transactions without us splitting pages first.
   */
  file?: { filename: string; dataUrl: string }
  apiKey?: string
  fetchImpl?: typeof fetch
}

export function stripFences(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

export async function callModel<T>(options: CallModelOptions<T>): Promise<T> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new OpenRouterError('OPENROUTER_API_KEY is not set.')
  }

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: options.userPrompt }]
  if (options.imageUrl) {
    content.push({ type: 'image_url', image_url: { url: options.imageUrl } })
  }
  if (options.file) {
    content.push({
      type: 'file',
      file: { filename: options.file.filename, file_data: options.file.dataUrl },
    })
  }

  const messages: Array<Record<string, unknown>> = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content })

  const doFetch = options.fetchImpl ?? fetch
  const res = await doFetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new OpenRouterError(`OpenRouter request failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string') {
    throw new OpenRouterError('OpenRouter response is missing message content.')
  }

  const cleaned = stripFences(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new OpenRouterError(`Model response was not valid JSON: ${cleaned.slice(0, 200)}`)
  }

  const result = options.schema.safeParse(parsed)
  if (!result.success) {
    throw new OpenRouterError(`Model response failed schema validation: ${result.error.message}`)
  }

  return result.data
}
