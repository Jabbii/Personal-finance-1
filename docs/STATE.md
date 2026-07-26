# State of the System

Last updated: 2026-07-26

## What exists and works

- [x] Repo initialized, directory structure created
- [x] Plan documented in docs/PLAN.md
- [x] .gitignore, README in place
- [x] Design tokens defined — `design/tokens.ts`
- [x] Design ADR written — `docs/adr/001-design-system.md`

- [x] Test harness — Vitest + Playwright configured, 10 unit tests passing

- [x] CI — GitHub Actions runs unit tests + secret safety check on every push/PR

- [x] check-env.js — runs on postinstall, checks Node, .env.local, required vars, secret safety, OneDrive path

## What's next

- [ ] Chunk 0.6: Prior art research (switch to Opus for this one)
- [ ] Chunk 0.7: Doc templates finalised
- [ ] Chunk 0.3: Test harness (Vitest + Playwright)
- [ ] Chunk 0.4: CI on GitHub Actions
- [ ] Chunk 0.5: check-env.js on postinstall
- [ ] Chunk 0.6: Prior art research (Opus)
- [ ] Chunk 0.7: Doc templates finalized

## Accounts needed before Phase 1

- [x] GitHub — github.com/Jabbii/Personal-finance-1
- [x] Supabase — account exists, project TBD
- [x] Vercel — account exists
- [ ] OpenRouter — needs setup at openrouter.ai (needed before Chunk 1.4)
- [ ] Cloudflare R2 — needed in Phase 4 only

## Known gaps

- Money Manager CSV not yet exported (needed for Phase 2.3)
- Golden slip set not yet collected (needed for Chunk 1.5) — gather 5 slips per bank
- Push alerts deferred to Phase 4
