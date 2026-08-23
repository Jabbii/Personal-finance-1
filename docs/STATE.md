# State of the System

Last updated: 2026-08-23

> **How to update this file:** At the end of every chunk, move the finished item from "What's next" to "What exists and works" with a `[x]`. Update "Last updated" date. Keep "Known gaps" current — add gaps as you discover them, remove them when fixed.

---

## What exists and works

- [x] Repo initialized, directory structure created
- [x] Plan documented in `docs/PLAN.md` (v5)
- [x] .gitignore, README in place
- [x] Design tokens defined — `design/tokens.ts`
- [x] Design ADR written — `docs/adr/001-design-system.md`
- [x] Test harness — Vitest + Playwright configured, 10 unit tests passing
- [x] CI — GitHub Actions runs unit tests + secret safety check on every push/PR
- [x] `check-env.js` — runs on postinstall, checks Node, .env.local, required vars, secret safety, OneDrive paths
- [x] `.env.local` filled in — Supabase URL/keys, OpenRouter key, 7 per-bank OneDrive paths
- [x] Chunk 0.6: Prior art research — `docs/prior-art.md` written (Opus, 2026-07-26)
- [x] PLAN.md v4 → v5 — Next.js 16.2, Qwen dropped, AI categorization dropped, `attrib +P` OneDrive step, `heic-convert` library, 5 banks, 25-slip golden set
- [x] Chunk 0.7: Doc conventions finalized
- [x] Chunk 1.1: DB schema + RLS + storage bucket — all 8 tables + `dashboard_current_month` view live in Supabase (`migrations/001-004`), RLS enabled and policy-tested, `slips` storage bucket created (private, 10 MB limit, image/PDF only)
- [x] Chunk 1.2: Next.js 16.2 scaffold + design tokens integration — App Router + Tailwind v4 wired directly to `design/tokens.ts` (no duplicated values), Inter loaded via `next/font`, `/design/preview` renders every token with a working light/dark toggle, home page stub in place. Verified in a real browser (Chrome) and with 9 Playwright tests across Mobile Chrome/Safari + Desktop.
- [x] Installed the Impeccable design-review skill (`/impeccable`) — its craft-floor checklist caught two real WCAG contrast failures: `income`/`expense` swatch text (2.54:1 and 3.67:1, both fixed to 7.65:1/5.28:1) and the `accent.dark` token itself (4.34:1 against either dark-mode text color, affecting the real theme-toggle button — nudged `#6366F1` → `#7075F5`, now 5.13:1). Amendment logged in `docs/adr/001-design-system.md`.
- [x] Chunk 1.3: postgres.js client + Zod schemas — `lib/db/client.ts` connects to Supabase's Transaction pooler (`prepare: false` for PgBouncer compatibility), verified live with `select 1`. `lib/validators/` has one Zod schema per table (accounts, categories, merchants, merchant_aliases, raw_inputs, transactions, transaction_evidence, budgets). 17 new unit tests passing (29 total). `postgres` package is server-only and ~90 KB uncompressed, well under the 150 KB budget — confirmed with a real `next build`.
- [x] Chunk 1.4: OpenRouter wrapper — `lib/openrouter/client.ts` (`callModel()`) sends `response_format: json_object` to force JSON, strips a markdown code fence if the model adds one anyway, then validates the parsed JSON against a caller-supplied Zod schema and returns a typed result (throws `OpenRouterError` on any failure: bad JSON, failed validation, non-2xx response, missing API key). Model choice (`MODEL_PRIMARY`/`MODEL_FALLBACK`/`MODEL_ANALYSIS`) stays in `.env.local`, not hard-coded. 11 new unit tests against a mocked `fetch` — no real API key or network call needed (40 total).
- [x] Money Manager history exported to CSV — `Money Manager_7-26-26.csv` in the repo root (gitignored, UTF-8 with BOM, 3,251 rows), alongside the original `.xlsx`. Needed for Phase 2.3.
- [x] Golden set collected and validated (prerequisite for Chunk 1.5) — 36 source files across 7 folders producing 40 ground-truth transaction rows, one `notes.csv` per folder. Two new source folders beyond the 5 banks: `fixtures/7-11/` and `fixtures/grab/`, which are apps with their own in-app payment systems, so no bank slip exists and the e-receipt is the only source document. Validated clean on 2026-08-12: no encoding corruption, all dates `YYYY-MM-DD`, every filename cross-checked against a real file on disk in both directions. Grab's daily-digest PDFs establish the multi-transaction convention — one row per transaction with `filename` repeating, disambiguated by a reference number in `notes`, mirroring how `transaction_evidence` already allows many transactions per `raw_inputs` row.

- [x] `docs/how-it-works.md` written (2026-08-23) — plain-language reference covering the full input→output pipeline, what each vendor actually does (Supabase's three jobs, OpenRouter as a switchboard not an AI), the file journey through OneDrive placeholders, hash-based mapping, the model alternatives we rejected and why, laptop specs, costs, and a glossary. This is the document to re-read after time away from the project.
- [x] Laptop specs measured (2026-08-23, closing out Chunk -1.4) — ASUS Zenbook UM3402YA, Ryzen 5 7530U (6c/12t), 15.4 GB RAM, **integrated AMD Radeon only, no discrete GPU**, 155 GB free. Running a vision model locally is ruled out: no CUDA, ~1 min/slip on CPU vs ~2 s via API, and 6–10 GB RAM against a ≤500 MB plan budget. Confirms Gemini-via-OpenRouter as the right call.
- [x] Golden set eval mode decided (2026-08-23) — user approved real API calls against the 36 real slips, with each model response cached to disk so re-runs and CI replay offline for free.

## What's next

- [ ] Phase 1.5: Golden set eval runner

## Accounts needed before Phase 1

- [x] GitHub — github.com/Jabbii/Personal-finance-1
- [x] Supabase — account exists, project created
- [x] Vercel — account exists
- [x] OpenRouter — account and API key in .env.local
- [ ] Cloudflare R2 — needed in Phase 4 only

## Known gaps

- Golden set has **zero `income` examples** — the split is 35 expense / 5 transfer / 0 income. The one row previously tagged `income` (BBL, 2024-11-29, 50,000 THB, memo "Salary") was re-tagged `transfer` on 2026-08-12 after reading the slip image: it is outgoing from the user's own BBL account to their own KBank account, so the memo describes where the funds originated rather than the transaction itself. Consequence: the eval cannot measure income classification at all. Needs a few real salary-arriving slips.
- Eval runner must **strip the UTF-8 BOM** when parsing `fixtures/*/notes.csv`. The Thai-bearing files are UTF-8 *with* BOM because that is what Excel's "CSV UTF-8" save produces; without stripping, the first header field parses as `﻿filename` and every column lookup fails.
- `fixtures/line/` is intentionally empty — no LINE OA notification screenshots collected yet. Not a blocker for Chunk 1.5.
- **`.env.local` has an unclosed quote** on `ONEDRIVE_MAKEBYKBANK_PATH` — the value opens with `"` and never closes it, while every other path line is unquoted. Would break the MAKE by KBank folder scan in Chunk 2.1. Not edited yet: it's the credentials file, so the user should make the change (delete the leading `"`).
- **No cleanup policy for `%USERPROFILE%/finance-sync/converted/`** — PLAN.md calls the HEIC→JPEG and split-PDF outputs "temp files" but never says when they get deleted, so the folder grows without bound. Settle this in Chunk 2.1.
- **Open question for the user:** whether to drop Supabase Storage entirely and keep slip images only in OneDrive. Would remove the upload step, the image storage cost, and the whole 6/12/18-month lifecycle machinery (including the Cloudflare R2 dependency in Phase 4) — at the cost of not being able to view the original slip from the phone. See `docs/how-it-works.md` §6.
- Push alerts deferred to Phase 4
- No Supabase Auth user exists yet — the `user_read` RLS policy (logged-in user can read) has nothing to authenticate as yet. Not a blocker: the app reads via a direct Postgres connection (Phase 1.3), which doesn't go through this policy at all. This is pure defense-in-depth for now.
