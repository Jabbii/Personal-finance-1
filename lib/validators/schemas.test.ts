// lib/validators/schemas.test.ts
// Chunk 1.3 acceptance test: every Zod schema accepts a valid row and
// rejects the same row with its key constraint broken.

import { describe, it, expect } from 'vitest'
import { accountSchema } from './accounts'
import { categorySchema } from './categories'
import { merchantSchema } from './merchants'
import { merchantAliasSchema } from './merchant-aliases'
import { rawInputSchema } from './raw-inputs'
import { transactionSchema } from './transactions'
import { transactionEvidenceSchema } from './transaction-evidence'
import { budgetSchema } from './budgets'

const uuid1 = '11111111-1111-4111-8111-111111111111'
const uuid2 = '22222222-2222-4222-8222-222222222222'

describe('accountSchema', () => {
  it('accepts a valid account and defaults current_balance to 0', () => {
    const result = accountSchema.parse({
      bank_name: 'KBank',
      account_name: 'K PLUS',
      account_type: 'checking',
    })
    expect(result.current_balance).toBe(0)
  })

  it('rejects a missing bank_name', () => {
    expect(() =>
      accountSchema.parse({ account_name: 'K PLUS', account_type: 'checking' })
    ).toThrow()
  })
})

describe('categorySchema', () => {
  it('accepts a top-level category with no parent', () => {
    const result = categorySchema.parse({ name: 'Groceries' })
    expect(result.name).toBe('Groceries')
  })

  it('rejects a non-uuid parent_id', () => {
    expect(() => categorySchema.parse({ name: 'Snacks', parent_id: 'not-a-uuid' })).toThrow()
  })
})

describe('merchantSchema', () => {
  it('defaults created_by to csv-bootstrap', () => {
    const result = merchantSchema.parse({ canonical_name: '7-Eleven' })
    expect(result.created_by).toBe('csv-bootstrap')
  })

  it('rejects an empty canonical_name', () => {
    expect(() => merchantSchema.parse({ canonical_name: '' })).toThrow()
  })
})

describe('merchantAliasSchema', () => {
  it('accepts a valid alias/merchant_id pair', () => {
    const result = merchantAliasSchema.parse({ alias: '7-ELEVEN #123', merchant_id: uuid1 })
    expect(result.merchant_id).toBe(uuid1)
  })

  it('rejects a non-uuid merchant_id', () => {
    expect(() => merchantAliasSchema.parse({ alias: '7-ELEVEN #123', merchant_id: 'nope' })).toThrow()
  })
})

describe('rawInputSchema', () => {
  it('accepts a valid bank slip input and defaults storage_tier to hot', () => {
    const result = rawInputSchema.parse({
      source: 'bank_slip',
      file_path: '/slips/2026-07-31-kbank.jpg',
      file_hash: 'abc123',
      extractor_version: 'v1',
    })
    expect(result.storage_tier).toBe('hot')
  })

  it('rejects an invalid source', () => {
    expect(() =>
      rawInputSchema.parse({
        source: 'fax',
        file_path: '/slips/x.jpg',
        file_hash: 'abc123',
        extractor_version: 'v1',
      })
    ).toThrow()
  })
})

describe('transactionSchema', () => {
  it('accepts a valid expense and defaults currency to THB', () => {
    const result = transactionSchema.parse({
      date: '2026-07-31',
      amount: 120.5,
      direction: 'expense',
      account_id: uuid1,
      extractor_version: 'v1',
    })
    expect(result.currency).toBe('THB')
  })

  it('rejects an invalid direction', () => {
    expect(() =>
      transactionSchema.parse({
        date: '2026-07-31',
        amount: 120.5,
        direction: 'refund',
        account_id: uuid1,
        extractor_version: 'v1',
      })
    ).toThrow()
  })
})

describe('transactionEvidenceSchema', () => {
  it('accepts a valid link', () => {
    const result = transactionEvidenceSchema.parse({ transaction_id: uuid1, raw_input_id: uuid2 })
    expect(result.transaction_id).toBe(uuid1)
  })

  it('rejects a missing raw_input_id', () => {
    expect(() => transactionEvidenceSchema.parse({ transaction_id: uuid1 })).toThrow()
  })
})

describe('budgetSchema', () => {
  it('accepts a valid monthly budget', () => {
    const result = budgetSchema.parse({
      category_id: uuid1,
      monthly_limit: 5000,
      year: 2026,
      month: 7,
    })
    expect(result.month).toBe(7)
  })

  it('rejects month 13', () => {
    expect(() =>
      budgetSchema.parse({ category_id: uuid1, monthly_limit: 5000, year: 2026, month: 13 })
    ).toThrow()
  })
})
