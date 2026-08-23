// lib/prompts/extract-slip.ts
// version: 1.0.0
//
// The contract between us and the vision model: one slip image in, a list of
// transactions out. Bump EXTRACTOR_VERSION on any change to the prompt text or
// the schema, then re-run `npm run eval` — the cache is keyed by this version,
// so a bump automatically invalidates every stored response.
//
// Design principle #6: the prompt is a contract, not a knowledge base. It
// describes the SHAPE of the answer and the few reading rules the model cannot
// infer from the image alone (Buddhist years, net-vs-gross amounts). Anything
// that can be decided by deterministic code afterwards — merchant aliasing,
// account matching, the internal-transfer rule — belongs in a normalizer, not
// here. `sender_name` / `recipient_name` are returned precisely so Chunk 2.2
// can make that call in code rather than trusting the model's judgement.
//
// Prompt cap is 2,000 tokens (docs/PLAN.md "Prompt Discipline"). This is well
// under it; keep it that way. New bank quirks go in config/bank-hints.json.

import { z } from 'zod'

// 1.1.0 — first eval run found two systematic misreads on a single KBank slip:
//   * "21 Jul 26" became 2023-07-21. The model assumed any short year was
//     Buddhist and subtracted 543. Year handling is now case-by-case on digit
//     count (rule 2).
//   * A payment to another person was classified "transfer" because KBank
//     titles the slip "Transfer Completed". Direction is now decided from the
//     two names only, with the printed wording called out as noise (rule 4).
// 1.2.0 — second run, remaining KBank failures:
//   * merchant came back as "KBank" — the bank printed beside the recipient's
//     name rather than the recipient. Rule 5 now rejects institution names.
//   * money to the account holder's mother was classified "transfer" on the
//     strength of a shared surname. Rule 4 now requires the same full name.
// 1.3.0 — first full run over all 36 documents:
//   * 7-Eleven prints "20/07/69", a two-digit BUDDHIST year, while KBank prints
//     "21 Jul 26", a two-digit GREGORIAN one. v1.1.0's flat "two digits means
//     Gregorian" rule was wrong half the time. Rule 2 now tests both readings
//     and keeps whichever lands near today, which needs today's date — hence
//     `today` in buildUserPrompt().
//   * BBL slips name only the recipient, so same-person transfers scored as
//     expenses. Rule 6 now states that an unnamed side is the account holder.
export const EXTRACTOR_VERSION = '1.3.0'

export const extractedTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('THB'),
  direction: z.enum(['income', 'expense', 'transfer']),
  // Nullable on purpose. On a self-transfer there is no counterparty, and the
  // model honestly returns null — which under a required-string schema threw
  // OpenRouterError and zeroed every field on the document, punishing a
  // correct reading far harder than a wrong one. A null merchant now fails
  // that one field and nothing else.
  merchant: z.string().nullable().default(null),
  sender_name: z.string().nullable().default(null),
  recipient_name: z.string().nullable().default(null),
  reference_no: z.string().nullable().default(null),
})

export const extractionSchema = z.object({
  transactions: z.array(extractedTransactionSchema),
})

export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>
export type Extraction = z.infer<typeof extractionSchema>

export const SYSTEM_PROMPT = `You read Thai banking slips, payment confirmations and e-receipts, and return structured JSON. You are precise and you never guess.

Return ONLY a JSON object of this shape:

{"transactions":[{"date":"YYYY-MM-DD","amount":<number>,"currency":"THB","direction":"income"|"expense"|"transfer","merchant":"<string>","sender_name":<string|null>,"recipient_name":<string|null>,"reference_no":<string|null>}]}

RULES

1. ONE ENTRY PER TRANSACTION. Most documents hold exactly one. Some — daily
   e-receipt digests especially — hold several. Return every transaction you
   can see, each as its own entry. Never merge them and never invent one.

2. DATE. Always YYYY-MM-DD. Read the year exactly as follows — this is the
   single most common mistake, so work through it every time:
   - FOUR digits, 2400 or more: Buddhist era. Subtract 543. (2569 -> 2026)
   - FOUR digits, less than 2400: already Gregorian. Use as-is. (2026 -> 2026)
   - TWO digits: AMBIGUOUS — Thai apps use both conventions, so you must test
     both and keep the one that lands in the recent past. Compute (a) 2000 + yy
     and (b) 2500 + yy - 543, then choose whichever falls within about three
     years of today's date. Never choose a future date.
       "26" -> (a) 2026, (b) 1983. Today is near 2026, so the answer is 2026.
       "69" -> (a) 2069, (b) 2026. 2069 is the future, so the answer is 2026.
     "21 Jul 26" and "20/07/69" are therefore both 2026 dates.
   Thai month abbreviations:
   ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06
   ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12
   Use the transaction date, not a printed-on or delivery date.

3. AMOUNT — THE MOST IMPORTANT FIELD. Report the amount ACTUALLY PAID from the
   account, in Thai baht, as a plain number with no commas or currency symbol.
   - If a discount, promotion, coupon or co-payment subsidy is shown, report
     the NET amount charged, not the original price. A receipt reading
     "bill 250, discount -150, pay 100" is 100.
   - If the document shows a foreign-currency trade with a baht total, report
     the baht total.
   - Ignore any running balance, credit limit or points total.
   Set "currency" to the currency you are reporting, normally "THB".

4. DIRECTION. Decide this from the two NAMES, never from the words printed on
   the document. Thai banking apps title almost every outgoing payment
   "Transfer Completed" or "โอนเงินสำเร็จ" — that describes the mechanism used,
   not the kind of transaction, and it is not evidence of anything.
   - "transfer" — ONLY when the sender and the recipient are the SAME PERSON
     moving money between their own accounts. Both names must be that one
     person. Paying somebody else is never a transfer, however the slip is
     titled. "Same person" means the same FULL name. A shared family name is
     not enough — relatives share surnames, and paying a relative is an
     expense.
   - "income" — money arrived from someone else.
   - "expense" — everything else, including every payment to another person,
     shop or service.
   If the recipient is anyone other than the sender, the answer is "expense"
   (or "income" if the money came in). When genuinely unsure, choose "expense"
   and let sender_name / recipient_name speak for themselves.

5. MERCHANT. WHO the money went to (or came from), exactly as printed — the
   shop, the person, or the service. Keep Thai script in Thai; do not translate
   or transliterate. Do not clean up spacing or capitalisation. For a store with
   a branch name, include the branch as printed.
   Never answer with a bank, wallet or payment-network name — "KBank", "SCB",
   "PromptPay", "Bangkok Bank" and the like describe HOW the money moved, not
   who received it. The slip shows those next to an account holder's name; the
   name is the merchant. Use an institution name only when it genuinely is the
   counterparty, such as paying a government office or a bank's own fee.

6. SENDER_NAME / RECIPIENT_NAME. Copy the account-holder names shown on the
   slip, verbatim. Use null where the document does not show one.
   Every document you are given belongs to one person — the account holder —
   so where a slip names only one side, the unnamed side is that account
   holder. Take this into account when applying rule 4.

7. REFERENCE_NO. Any transaction, reference or receipt number shown. If several
   appear, prefer the one labelled reference. Use null if there is none.

8. UNREADABLE. If the image is not a financial document, or is too unclear to
   read reliably, return {"transactions":[]}. An empty list is always better
   than a guessed number.`

export interface BuildPromptOptions {
  /**
   * Names the account holder appears under on their own slips. Supplied so the
   * model can recognise a same-person transfer; kept out of the prompt text
   * because it is personal data and this repo is public. Chunk 2.2 will make
   * this decision in a normalizer instead.
   */
  accountHolderNames?: string[]
  /** Per-bank quirks, eventually from config/bank-hints.json. */
  bankHint?: string
  /**
   * Today, as YYYY-MM-DD. Rule 2 resolves two-digit years by picking the
   * reading that lands in the recent past, which is meaningless without it.
   */
  today?: string
}

export function buildUserPrompt(options: BuildPromptOptions = {}): string {
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const parts = [
    `Today's date is ${today}. Read this document and return the JSON described in your instructions.`,
  ]

  const names = options.accountHolderNames?.filter((n) => n.trim().length > 0) ?? []
  if (names.length > 0) {
    parts.push(
      `The account holder is known by these names: ${names.join(', ')}. ` +
        'If both sender and recipient are this same person, direction is "transfer".'
    )
  }

  if (options.bankHint) {
    parts.push(options.bankHint)
  }

  return parts.join('\n\n')
}
