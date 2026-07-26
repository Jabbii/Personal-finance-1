# Personal Finance Tracker

Personal-use finance tracker for Thailand (KBank, SCB, BBL). Processes bank slips via OCR, tracks spending, and shows a clean mobile-first dashboard.

## How it works

1. Bank slips and LINE screenshots land in OneDrive
2. Run `node scripts/sync.js` on your laptop — it OCRs new slips and saves transactions
3. Open the web app on your phone to see your spending

## Docs

- [Full plan](docs/PLAN.md) — architecture, design principles, tech stack
- [Current state](docs/STATE.md) — what's built and working right now
- [Risks & costs](docs/RISKS.md) — what this costs and what could go wrong
- [Updates log](docs/COMMS.md) — plain-language progress updates
- [Failure log](docs/LOOP-LOG.md) — bugs encountered and how they were fixed
- [Architecture decisions](docs/adr/) — why key choices were made

## Folder structure

```
/app              Next.js routes (server-rendered)
/components       UI components
/lib              Shared utilities (DB, OCR, normalizers)
/scripts          sync.js — run this to process new slips
/fixtures         Test slips for OCR accuracy checks
/migrations       Supabase SQL schema
/config           Lifecycle rules, bank hints
/docs             All documentation
/tests            Vitest unit tests + Playwright E2E
```

## Setup

See [docs/STATE.md](docs/STATE.md) for current setup status.
