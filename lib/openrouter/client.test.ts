// lib/openrouter/client.test.ts
// Chunk 1.4 acceptance test: the wrapper strips code fences, forces JSON
// output on the request, and returns a Zod-typed result — all against a
// mocked fetch, no real API key or network call needed.

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { callModel, stripFences, OpenRouterError } from './client'

const ocrSchema = z.object({
  merchant: z.string(),
  amount: z.number(),
  date: z.string(),
})

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function chatResponse(content: string) {
  return { choices: [{ message: { content } }] }
}

describe('stripFences', () => {
  it('strips a ```json fence', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips a bare ``` fence', () => {
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('leaves unfenced content unchanged', () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}')
  })
})

describe('callModel', () => {
  it('returns a typed result parsed from a clean JSON response', async () => {
    const fetchImpl = mockFetch(
      chatResponse(JSON.stringify({ merchant: '7-Eleven', amount: 65, date: '2026-07-31' }))
    )
    const result = await callModel({
      model: 'google/gemini-2.5-flash-lite',
      schema: ocrSchema,
      userPrompt: 'read this slip',
      apiKey: 'test-key',
      fetchImpl,
    })
    expect(result).toEqual({ merchant: '7-Eleven', amount: 65, date: '2026-07-31' })
  })

  it('strips a markdown fence around the JSON before parsing', async () => {
    const raw = '```json\n' + JSON.stringify({ merchant: 'Starbucks', amount: 120, date: '2026-07-31' }) + '\n```'
    const fetchImpl = mockFetch(chatResponse(raw))
    const result = await callModel({
      model: 'google/gemini-2.5-flash-lite',
      schema: ocrSchema,
      userPrompt: 'read this slip',
      apiKey: 'test-key',
      fetchImpl,
    })
    expect(result.merchant).toBe('Starbucks')
  })

  it('forces JSON output via response_format on the outgoing request', async () => {
    const fetchImpl = mockFetch(
      chatResponse(JSON.stringify({ merchant: 'x', amount: 1, date: '2026-07-31' }))
    )
    await callModel({
      model: 'google/gemini-2.5-flash-lite',
      schema: ocrSchema,
      userPrompt: 'read this slip',
      apiKey: 'test-key',
      fetchImpl,
    })
    const [, requestInit] = fetchImpl.mock.calls[0]
    const body = JSON.parse((requestInit as RequestInit).body as string)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('includes an image_url content block when imageUrl is passed', async () => {
    const fetchImpl = mockFetch(
      chatResponse(JSON.stringify({ merchant: 'x', amount: 1, date: '2026-07-31' }))
    )
    await callModel({
      model: 'google/gemini-2.5-flash-lite',
      schema: ocrSchema,
      userPrompt: 'read this slip',
      imageUrl: 'data:image/jpeg;base64,abc123',
      apiKey: 'test-key',
      fetchImpl,
    })
    const [, requestInit] = fetchImpl.mock.calls[0]
    const body = JSON.parse((requestInit as RequestInit).body as string)
    const content = body.messages[0].content
    expect(content).toContainEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } })
  })

  it('throws OpenRouterError when the response is not valid JSON', async () => {
    const fetchImpl = mockFetch(chatResponse('not json at all'))
    await expect(
      callModel({
        model: 'google/gemini-2.5-flash-lite',
        schema: ocrSchema,
        userPrompt: 'read this slip',
        apiKey: 'test-key',
        fetchImpl,
      })
    ).rejects.toThrow(OpenRouterError)
  })

  it('throws OpenRouterError when the JSON fails schema validation', async () => {
    const fetchImpl = mockFetch(chatResponse(JSON.stringify({ merchant: '7-Eleven' })))
    await expect(
      callModel({
        model: 'google/gemini-2.5-flash-lite',
        schema: ocrSchema,
        userPrompt: 'read this slip',
        apiKey: 'test-key',
        fetchImpl,
      })
    ).rejects.toThrow(OpenRouterError)
  })

  it('throws OpenRouterError on a non-ok HTTP response', async () => {
    const fetchImpl = mockFetch({ error: 'rate limited' }, 429)
    await expect(
      callModel({
        model: 'google/gemini-2.5-flash-lite',
        schema: ocrSchema,
        userPrompt: 'read this slip',
        apiKey: 'test-key',
        fetchImpl,
      })
    ).rejects.toThrow(OpenRouterError)
  })

  it('throws OpenRouterError when no API key is available', async () => {
    const previous = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    try {
      await expect(
        callModel({
          model: 'google/gemini-2.5-flash-lite',
          schema: ocrSchema,
          userPrompt: 'read this slip',
          fetchImpl: mockFetch(chatResponse('{}')),
        })
      ).rejects.toThrow(OpenRouterError)
    } finally {
      if (previous !== undefined) process.env.OPENROUTER_API_KEY = previous
    }
  })
})
