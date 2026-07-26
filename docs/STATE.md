# State of the System

Last updated: 2026-07-26

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

## What's next

- [ ] Phase 1.1: DB schema + RLS + storage bucket (Supabase)
- [ ] Phase 1.2: Next.js 16.2 scaffold + design tokens integration
- [ ] Phase 1.3: postgres.js client + Zod schemas
- [ ] Phase 1.4: OpenRouter wrapper
- [ ] Phase 1.5: Golden set eval runner

## Accounts needed before Phase 1

- [x] GitHub — github.com/Jabbii/Personal-finance-1
- [x] Supabase — account exists, project created
- [x] Vercel — account exists
- [x] OpenRouter — account and API key in .env.local
- [ ] Cloudflare R2 — needed in Phase 4 only

## Known gaps

- Money Manager CSV not yet exported (needed for Phase 2.3)
- Golden slip set not yet collected (needed for Chunk 1.5) — gather 5 real slips per bank × 5 banks = 25 total
- Supabase project not yet configured (tables, RLS, storage bucket — that is Chunk 1.1)
- Push alerts deferred to Phase 4
