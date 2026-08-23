# Prior Art & Research

Chunk 0.6 output. Written 2026-07-26 to inform Phase 1 decisions.

The point of this document is to answer, before any real coding starts:
"Has someone already solved parts of this, and what did they learn?" — so we don't reinvent things, and we avoid mistakes others have made.

---

## Part 1 — Finance apps we looked at

None of these support Thai bank OCR, so we're not forking any of them. But their data models and UI ideas are worth borrowing.

### Actual Budget
- **Stack:** JavaScript + SQLite, local-first, self-hostable, open source.
- **What it does well:** CSV/QIF/OFX import with a friendly column-mapping UI. It learns payee → category mappings over time, so recurring transactions auto-categorize after a few examples.
- **Borrow:** the CSV column-mapping wizard idea for our Money Manager import (Chunk 2.3). Learning payee → category over time.
- **Reject:** envelope budgeting (too much ceremony for you), no OCR support, its whole client-side sync model.

### Firefly III
- **Stack:** PHP + MySQL, self-host.
- **What it does well:** proper double-entry bookkeeping — every transaction has a source account and a destination account, which makes internal transfers "just work" (one write, two ledger entries).
- **Borrow:** the double-entry idea for handling your own transfers (which we already flagged as a hard rule). Their transaction-group / transaction-journal pattern maps directly to our `transaction_evidence` linkage.
- **Reject:** the whole PHP stack, its overwhelming feature set (budgets, bills, piggy banks, rules engines, tags, categories, all at once — feature bloat is exactly what "one user, not a SaaS" is meant to prevent).

### Maybe Finance
- **Status:** archived by owner 2025-07-27. Company pivoted to B2B and abandoned the OSS repo.
- **Stack:** Ruby on Rails + Postgres + Sidekiq.
- **What it does well:** event-sourced architecture — every transaction, trade, valuation is an immutable `Entry` record, and balance/holdings are materialized asynchronously into cache tables. Fast dashboard loads without stale data.
- **Borrow:** the "immutable entries + materialized cache" split. This is exactly what our `raw_inputs` (immutable) + `dashboard_current_month` materialized view is doing. Confirms the architecture.
- **Reject:** Ruby/Rails/Sidekiq (overkill for a single user), and the fact that it's abandoned is itself a warning about betting on a specific finance-app codebase.

### Lunch Money
- **Stack:** paid SaaS (~$10/mo), not open source. Look-only.
- **What it does well:** best-in-class review UX. Wide tap targets, drag-and-drop grouping, calendar view with transaction detail, "needs attention" panel that surfaces uncategorized items. Biometric login. No ads.
- **Borrow:** the "needs attention" widget on our dashboard (queue of transactions the OCR couldn't confidently categorize). Wide tap areas on mobile (already in our 44px minimum). The idea of a calendar view — worth considering as a Phase 3 nice-to-have.
- **Reject:** everything else — it's a SaaS with different goals.

### Ivy Wallet
- **Stack:** Android native.
- Screenshot-only inspiration for mobile-first look-and-feel.

---

## Part 2 — Patterns we're borrowing

| Pattern | From | Applied where |
|---|---|---|
| CSV column-mapping wizard | Actual Budget | Chunk 2.3 — Money Manager import |
| Learn payee → category over time | Actual Budget | Chunk 2.4 — merchant bootstrap + reinforcement in Phase 3 |
| Double-entry for internal transfers | Firefly III | Normalizer — flag `direction='transfer'` when sender=recipient=user |
| Immutable entries + materialized cache | Maybe Finance | Already in our schema (`raw_inputs` + `dashboard_current_month`) |
| "Needs attention" widget | Lunch Money | Dashboard Chunk 3.1 |
| Wide tap targets, no ads, biometric login (later) | Lunch Money | Design system already enforces 44px min |

## Part 3 — Patterns we're rejecting

| Rejected pattern | Why |
|---|---|
| Envelope budgeting (Actual, YNAB) | Too much monthly ceremony. You want to *see* spending, not pre-allocate every baht. |
| Kitchen-sink feature sets (Firefly III) | Violates "one user, not a SaaS". Every unused feature is dead weight in the UI. |
| Heavy background job systems (Sidekiq / Redis) | Overkill for on-demand sync from a laptop. |
| Direct bank API connections (Plaid, SimpleFIN, GoCardless) | None reliably support Thai banks; also expensive. Slip OCR is our workaround. |
| Client-side data fetching for dashboard | Kills first-paint on mobile. RSC server-render everything is the whole point. |

---

## Part 4 — Framework & tooling landscape (as of July 2026)

### Next.js: bump from 15 to 16.2

**Update from the plan.** The plan said Next.js 15. Next.js 16.2 shipped and is stable. Key changes:

- **Cache Components with `"use cache"`** — new directive that lets the compiler auto-generate cache keys for pages, components, and functions. Uses Partial Pre-Rendering (PPR). This is a better fit than our previous plan of `unstable_cache` for the dashboard.
- **`fetch()` and route segments are still uncached by default** (this happened in 15 and carried through). Every DB read needs explicit caching intent.
- **Middleware → `proxy.ts`** — same functionality, renamed to make the network boundary clearer.
- **React 19.2** under the hood.
- **Turbopack** is now the default for dev — noticeably faster HMR on Windows.

**Decision:** use **Next.js 16.2**. Cost is nil (upgrade path from 15 is small), gain is real (better caching semantics, faster dev builds). Update the plan.

**Practical Next.js rules for this project:**
1. Server Components are the default. Only opt into `"use client"` for leaf interactive components (edit-transaction form, review swipes).
2. Server Actions handle every mutation (categorize, edit, delete). No custom API routes for anything the UI needs.
3. Wrap DB queries in `"use cache"` with explicit tags — bust the tag on the matching Server Action.
4. Every data-fetching page has a `loading.tsx` skeleton. Non-negotiable.

### Supabase RLS

Best-practice checklist confirmed by 2026 docs (nothing radical, but a few Windows-user footguns worth naming):

1. **Enable RLS on every table** in the public schema — a table with RLS off is public to anyone who has the anon key (which lives in the browser bundle).
2. **Always use `auth.uid()`**, never a value the client passes.
3. **`WITH CHECK` on INSERT/UPDATE** — validates the row you're writing, not just the row you're reading.
4. **Index every column referenced in an RLS policy** — the #1 performance killer is missing indexes on `auth.uid()` filter columns.
5. **Test policies from the client SDK, not the SQL editor.** The SQL editor bypasses RLS — a policy can look correct in the editor and still be broken in the browser.
6. **The service role key bypasses RLS entirely.** Never expose it to the browser. Never prefix any env var containing it with `NEXT_PUBLIC_`.

**Sync script implication:** since `sync.js` runs on the laptop with the service role key, it bypasses RLS. That's fine — RLS exists to protect the browser session, not the sync script.

**Storage RLS:** buckets need explicit INSERT/SELECT/UPDATE/DELETE policies on `storage.objects`. The common pattern is to prefix file paths with the user ID (e.g. `slips/{user_id}/2026-07/...`), then policies just check `starts_with(name, auth.uid() || '/')`. For a single-user app we can simplify to "any authenticated user can read, service role can write".

### OpenRouter models — updated pricing (July 2026)

> **SUPERSEDED 2026-08-23.** The model choices below were made from published
> pricing and general reputation, before any of them had been tested on real
> slips. A measured bake-off (5 models × 36 documents × 3 repeats, see
> `bakeoff/results.md`) replaced Gemini 2.5 Flash Lite with **Gemini 3.7 Flash**
> as primary and dropped Gemini 2.5 Flash. Notably, 2.5 Flash Lite was *not*
> the cheapest in practice — it spent so many reasoning tokens that it cost
> more per slip than two faster, more accurate models. **Kept here as a record
> of the reasoning at the time; do not use this table to pick a model.**

| Model | Role in our app | Input $/M | Output $/M | Notes |
|---|---|---|---|---|
| `google/gemini-2.5-flash-lite` | **Primary OCR** | $0.10 | $0.40 | Still the cheapest capable vision model. Handles Thai text. |
| `google/gemini-2.5-flash` | Fallback OCR (retry on low confidence) | ~$0.30 | ~$2.50 | Same family, more accurate. |
| `google/gemini-3.5-flash` | Available but expensive | $1.50 | $9.00 | 15× the price of 2.5-lite. Not worth it for slip OCR. |
| `anthropic/claude-opus-4-7` | On-demand analysis (chunk 4.x) | $5.00 | $25.00 | For "what did I spend on food last month, and is that unusual?" style questions. |
| `qwen/qwen3-vl-8b-instruct` | ~~Categorization~~ | $0.117 | $0.455 | **Actually more expensive than Gemini 2.5 Flash Lite.** Drop this from the plan — use Gemini 2.5 Flash Lite for categorization too, or (better) skip AI categorization entirely and rely on the curated merchant list from the CSV import. |

**Decisions:**
- Keep **Gemini 2.5 Flash Lite** as primary OCR — confirmed the right choice.
- Keep **Gemini 2.5 Flash** as fallback — same family, easy swap.
- **Drop Qwen3-VL** from the plan. It's not cheaper than Gemini, and adds a second provider we'd have to reason about.
- **Skip AI categorization for the MVP.** Money Manager CSV already gives us ~150 merchants + categories. New merchants that appear from OCR go straight to the review queue for manual first-time tagging. Save the API budget for OCR and Opus analysis.
- Keep **Claude Opus 4.7** for analysis, invoked manually only. Not on a cron.

### OneDrive Files-On-Demand — the Windows footgun

Your 40k-file Pictures folder is almost certainly full of **placeholder files** (Files On-Demand: the file appears in Explorer but its contents live in the cloud until opened). Node's `fs.readFile()` on a placeholder will silently trigger a download and block until it completes — or fail if OneDrive isn't running.

**How we handle it in `sync.js`:**
1. Before reading any slip, run `attrib +P "<path>"` via `child_process`. This pins the file (marks it "always keep on this device") and forces OneDrive to download it if it's not local.
2. Wait for the download by polling file size until it's non-zero *and* stable across two 500ms reads.
3. Only then read the bytes and send to OCR.
4. Optionally `attrib -P "<path>"` afterwards to un-pin, so the file can be evicted later to save disk space.

The file attribute `P` = pinned, `U` = unpinned, `O` = online-only. `attrib.exe` is built into Windows — no dependency to install.

### HEIC decoding on Windows

Samsung and iPhone both produce HEIC, and Samsung's HEIC files have caused breakage with some libraries in the past. Two options:

| Library | Pros | Cons |
|---|---|---|
| `sharp` (with libvips + libheif) | Fast, streaming, best quality | Native binary; Windows install is fiddly; needs libvips build flags to include libheif support |
| `heic-convert` | Pure JS, zero native deps, `npm i` and go | Slower on large images; loads full file into memory |

**Decision: use `heic-convert`.** Volume is low (dozens of slips per week, not thousands per hour), and "install and go on Windows" beats "faster but requires a working libvips" every time for a solo project. Migrate to `sharp` only if HEIC decoding ever becomes a bottleneck (unlikely).

---

## Part 5 — Plan changes

Update these lines in `docs/PLAN.md` and `docs/STATE.md`:

1. **Tech Stack table:** Next.js 15 → **Next.js 16.2**. Note "Cache Components (`use cache`) for dashboard queries".
2. **Tech Stack table:** remove Qwen3-VL line. Merge OCR + categorization into "Gemini 2.5 Flash Lite (primary), Gemini 2.5 Flash (fallback)".
3. **Chunk 2.4:** "Bootstrap merchant list from CSV" — remove the AI-categorization fallback. New merchants go to the review queue instead.
4. **Chunk 2.1:** add an explicit sub-step for `attrib +P` pin-and-wait before any file read.
5. **HEIC library:** `heic-convert`, not `sharp`.
6. **RLS on Storage:** simplified single-user policies (any auth'd user can read, service role can write).

---

## Sources

**Prior-art apps**
- [Actual Budget — Importing Transactions](https://actualbudget.org/docs/transactions/importing/)
- [Firefly III — Transaction types](https://docs.firefly-iii.org/references/firefly-iii/transaction-types/)
- [Firefly III — Architecture](https://docs.firefly-iii.org/explanation/more-information/architecture/)
- [Maybe Finance — Vision & architecture](https://github.com/maybe-finance/maybe/wiki/vision)
- [Maybe Finance — breakdown](https://memo.d.foundation/breakdown/maybe-finance)
- [Lunch Money — Changelog](https://lunchmoney.app/changelog)
- [Lunch Money — 2026 Review (Family Money Adventure)](https://familymoneyadventure.com/lunch-money-review/)

**Next.js**
- [Next.js 16 release notes](https://nextjs.org/blog/next-16)
- [Next.js 16.2 release notes](https://nextjs.org/blog/next-16-2)
- [Upgrading to Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 15 caching explained](https://www.iloveblogs.blog/post/nextjs-15-caching-explained)

**OpenRouter pricing**
- [Gemini 2.5 Flash Lite on OpenRouter](https://openrouter.ai/google/gemini-2.5-flash-lite)
- [Gemini 2.5 Flash on OpenRouter](https://openrouter.ai/google/gemini-2.5-flash)
- [Gemini 3.5 Flash on OpenRouter](https://openrouter.ai/google/gemini-3.5-flash)
- [Claude Opus 4.7 on OpenRouter](https://openrouter.ai/anthropic/claude-opus-4.7)
- [Qwen3-VL-8B on OpenRouter](https://openrouter.ai/qwen/qwen3-vl-8b-instruct)

**Supabase**
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase RLS Guide 2026 (Design Revision)](https://designrevision.com/blog/supabase-row-level-security)
- [Supabase RLS Best Practices (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

**Windows / OneDrive**
- [Placeholder files — Microsoft Learn](https://learn.microsoft.com/en-us/windows/compatibility/placeholder-files)
- [Query and set Files On-Demand states in Windows](https://learn.microsoft.com/en-us/OneDrive/files-on-demand-windows)
- [Configure OneDrive Files On-Demand states using PowerShell (Tristan Tyson)](https://tech.tristantyson.com/setonedrivefodstatespowershell)

**HEIC**
- [heic-convert on npm](https://www.npmjs.com/package/heic-convert)
- [Converting HEIC in Node.js with Sharp (DEV.to)](https://dev.to/up9t/converting-heic-image-extension-in-nodejs-with-the-sharp-library-39mg)
