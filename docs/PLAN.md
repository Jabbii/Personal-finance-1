# Personal Finance Web App — Architecture Plan (v4)

## Context
Personal-use finance tracker for one user in Thailand. Inputs: OneDrive bank slips (JPEG/PNG/PDF/HEIC), LINE OA notification screenshots, and historical Money Manager (Realbyte) CSV export. Three banks: KBank, SCB, Bangkok Bank. Pain point: too many daily transactions across too many apps to track manually.

Processing is on-demand, triggered when the laptop is opened. The app must load instantly on mobile, break loudly on failure, and stay used weekly.

---

## Design Principles (immutable)

1. **One user, not a SaaS.** Every choice optimizes for single-user speed and clarity.
2. **Break loudly.** Failures push to phone, not to a DB table.
3. **One ingestion path.** Sync script owns all OCR. Web app is read-only + manual override.
4. **Server-render everything.** No client-side data fetching for the dashboard.
5. **Curated over clever.** ~150 merchants in a lifetime. Curated list beats fuzzy matching.
6. **Prompt is a contract, not a knowledge base.** Edge cases go into deterministic post-processors.
7. **Raw preserved, but aged.** Slips move to cold storage or delete after 6 months.
8. **Every extraction is versioned.** Old data can be re-extracted on prompt changes.
9. **Reuse before rebuild.** Audit what exists first. Never build what we can fork.
10. **Test alongside every change.** No commit without a test. No merge without CI green.
11. **Talk plainly, talk often.** Every chunk gets a plain-language status. Ask when unsure.
12. **Flag every hidden cost and risk.** No surprise bills, no silent lock-in.

---

## Communication Protocol with User

Every rule below is stated as **WHAT** we do, **WHY** it matters to you, and **IF-NOT** what breaks if we skip it.

### Cadence

**WHAT** — Every chunk (30–45 min of work) ends with a plain update in `docs/COMMS.md`: what got done, what's next, anything you should know. If a chunk drags past 60 min with no progress, we stop and ask.

**WHY** — You always know what's happening without having to check in. You catch us going the wrong direction early, when it's cheap to fix.

**IF-NOT** — We disappear into the code for hours. You return to find changes you didn't sign off on, or work that solved the wrong problem.

### Plain language, not jargon

**WHAT** — We say "I'm setting up the database now" instead of "Executing DDL migration for RLS-protected schema." No acronyms. No engineer-speak. If we must use a technical term, we define it once in one sentence.

**WHY** — You shouldn't need a computer science degree to understand what your own app is doing.

**IF-NOT** — You nod along without really understanding. Problems get spotted too late because the words hiding them didn't mean anything to you. You feel locked out of your own project.

### Costs stated up front

**WHAT** — Whenever a choice costs money, we say the dollar amount, where it goes, and what happens if you exceed the free tier. Example: "Supabase free is 500 MB. When we fill it, uploads stop. To go bigger costs $25/mo."

**WHY** — No surprise bills. You always know what you're signing up for and where the cliff is.

**IF-NOT** — Bills quietly stack up. You feel tricked. Trust in the app (and in me) breaks.

### Numbered steps for anything you need to click

**WHAT** — If you need to do something in Supabase, OpenRouter, or any outside tool, we give you 1-2-3 steps with the exact button names, not "just provision the anon key."

**WHY** — You can follow along without googling terms mid-task.

**IF-NOT** — You get stuck, ask us to repeat in plainer words, and waste 15 minutes on what should have taken 30 seconds.

### Questions phrased for the user, not the engineer

**WHAT** — We ask "Do you also use Google Photos, or just OneDrive?" instead of "Enumerate cloud photo sync targets." Questions use words you already use.

**WHY** — We get better answers. You don't have to guess what we're asking.

**IF-NOT** — You guess. We build the wrong thing based on the guess. We both waste hours.

### When we stop and interrupt you

**WHAT** — We stop and ask before:
- Creating any new account or requesting a credential
- Making any decision that changes cost, where data lives, or who can see it
- Filling in a requirement we don't have a clear answer for
- Using a tool version different from what your machine has

**WHY** — These are decisions only you should make. Our default is "ask first" for anything with money, privacy, or vendor implications.

**IF-NOT** — We sign you up for services you didn't want, expose slip images to providers you'd have said no to, or build a feature that misses the actual point.

### When we do NOT interrupt you

**WHAT** — We keep working without pinging you for:
- Refactoring within the agreed chunk
- Retrying a task after a fixable error we understand
- Reading files, running tests, running verifier commands

**WHY** — Constant pings waste your time and train you to ignore us — which then hides the important pings.

**IF-NOT** — Every five minutes you get a notification about something trivial. You start ignoring the app. You miss the one that actually matters.

### Weekly rollup

**WHAT** — Every Sunday, a plain summary in `docs/COMMS.md`: what shipped this week, what's next, any risks or costs that surfaced, any decisions waiting on you.

**WHY** — You have one predictable moment each week to catch up and steer, without having to remember to check in.

**IF-NOT** — Weeks pass, priorities drift, you lose track of what's actually done versus what we've promised. Motivation to use the app decays.

---

## Testing Discipline

**No chunk is "done" without tests.** Test scaffolding is Phase 0 work, not an afterthought.

| Test type | Scope | When it runs |
|---|---|---|
| Unit | Normalizers (date, amount, merchant), Zod schemas, utility fns | On save, in CI |
| Integration | OpenRouter wrapper with mocked responses, sync script phases | In CI |
| Golden set | 5 real slips per bank → expected JSON | On every prompt change |
| E2E (headless browser) | Upload flow, dashboard render, review flow | Nightly + pre-merge |
| RLS test | Anon key attempts write → must be blocked | On schema change |
| Performance | Dashboard first paint <500ms with 5000 tx | Pre-merge |

**Framework:** Vitest (unit + integration), Playwright (E2E). Tests live next to code as `foo.test.ts`.

**CI:** GitHub Actions on every push. Red CI blocks merge. Golden set delta reported in PR comment.

**Rule for Sonnet:** every code change ships with a test in the same commit. Missing test = chunk not done.

---

## File System Convention

**Repo structure:**
```
/finance-app
  /app                     # Next.js routes (RSC)
  /components              # UI (leaf) components only
  /lib
    /db                    # postgres.js client + query builders
    /openrouter            # model gateway wrapper
    /normalizers           # date, amount, merchant
    /validators            # Zod schemas
  /scripts
    sync.js                # main ingestion
    re-extract.js          # version-bump re-runner
    check-env.js           # runs on postinstall
  /fixtures                # golden set: /kbank, /scb, /bbl, /line
  /migrations              # Supabase SQL, numbered
  /config
    lifecycle.json         # retention rules
    bank-hints.json        # dynamic prompt hints per bank
  /docs
    /adr                   # architecture decisions
    STATE.md               # what exists, what works
    LOOP-LOG.md            # failure loop history
    RISKS.md               # hidden costs tracker
    COMMS.md               # user-facing status updates
  /tests
    /e2e                   # Playwright specs
  /.github/workflows       # CI + nightly cron
```

**Local machine — sync outputs:**
```
%USERPROFILE%/finance-sync/
  /logs/YYYY-MM-DD.jsonl        # structured logs, one line per event
  /converted/                   # HEIC→JPEG, PDF→pages temp files
  /failed/                      # copies of files that OCR failed, for manual look
```

**OneDrive (user-owned, not enforced):** we scan whatever structure exists. No rearranging user's files.

**Supabase Storage:**
```
/slips/{YYYY-MM}/{sha256}.{ext}      # deterministic path, dedup by hash
```

**Naming:** kebab-case for files, snake_case for DB, camelCase for JS variables.

---

## Prior Art & Research (Phase 0 chunk)

**Before we write code, look at what exists.** Candidates for fork or pattern-borrow:

| Project | Language | Fit assessment | Action |
|---|---|---|---|
| Actual Budget | JS, SQLite, local-first | Envelope budgeting, no OCR | Study import & UI patterns |
| Firefly III | PHP, MySQL, self-host | Mature, has bank import, no OCR | Study data model |
| Maybe Finance | React/Ruby, discontinued but open | Modern UI, net-worth focus | Study charts + net-worth model |
| Lunch Money | Paid SaaS | Best-in-class review UX | Screenshot inspiration only |
| Ivy Wallet | Android, open | Mobile UX inspiration | Screenshot inspiration only |

**Chunk 0.6 output:** `docs/prior-art.md` documenting what patterns we're borrowing, what we're rejecting, and why. No fork chosen because none support Thai bank OCR — but data model + import patterns will be reused.

**Also research in Phase 0:**
- Latest Next.js 15 patterns (App Router idioms shift often)
- Latest Supabase RLS best practices (recipes for single-user apps)
- Latest OpenRouter model list + prices (this changes monthly)
- Windows OneDrive Files-On-Demand behavior on current Windows 11
- HEIC decoder options in Node (libraries fail on macOS-produced HEIC)

---

## Risks & Hidden Costs (must be visible to user)

Tracked in `docs/RISKS.md`, reviewed monthly.

### Free-tier limits — what happens when hit

| Service | Free limit | Impact when exceeded | Mitigation |
|---|---|---|---|
| Supabase DB | 500 MB | Writes fail | Archive → R2, retention pruning |
| Supabase Storage | 1 GB | Uploads fail | Cold-tier migration at 6 months |
| Supabase bandwidth | 2 GB/mo | Reads throttled | Cache dashboard SQL; small payloads |
| Vercel bandwidth | 100 GB/mo | Site 503 | RSC = small payloads; realistically unhittable |
| Vercel build min | 6000 /mo | Deploys fail | Realistically unhittable for solo |
| Cloudflare R2 storage | 10 GB free | $0.015/GB after | Retention delete at 18 months |
| Cloudflare R2 egress | Free (Class A/B ops limited) | Class A: $4.50/M ops | Batch operations |
| OpenRouter | No free tier | Direct spend | Cost cap alert (see below) |
| GitHub Actions | 2000 min/mo (private) | CI throttled | Nightly job small; use public repo if needed |
| Pushover | 10,000 msg/mo | $5 for next 10K | Bundle daily digest |

### Cost cap / runaway protection

- OpenRouter monthly cap: hard $10 limit set in OpenRouter dashboard
- Kill switch: if daily API spend >$1, sync script refuses to run until manually resumed
- Batch size limit: sync script processes max 100 files per run, requires re-invocation for more

### Vendor & model risk

- **Gemini 2.5 model deprecation** — Google has deprecated Gemini versions with 6–12 month notice. Mitigation: OpenRouter wrapper abstracts model; `MODEL_PRIMARY` env var swap
- **Supabase pricing changes** — happened Aug 2024. Mitigation: `postgres.js` means we're not locked into their SDK; migration to plain Postgres possible in a day
- **Vercel pricing changes** — happened 2024. Mitigation: Next.js runs anywhere; docker + Fly.io as fallback
- **OpenRouter shutdown** — unlikely but possible. Mitigation: wrapper accepts direct Anthropic/Google keys as fallback

### Data privacy risk

- **Bank slips → OpenRouter → third-party model provider.** OpenRouter forwards requests to Google/Anthropic/etc. Some providers may retain or train on data.
- Mitigation: (a) use providers with "no training" enterprise policies (Gemini API, Anthropic API both offer this by default via OpenRouter), (b) redact account numbers post-OCR before storing OCR response JSON, (c) document in `RISKS.md` for user awareness

### Backup risk

- Supabase free tier: **7-day point-in-time recovery only, no exports**
- Mitigation: nightly `pg_dump` via GitHub Actions cron to R2. Retain 30 days. **Set up in Phase 4, not later.**

### Security risk

- API keys leaking via git → immediate financial exposure via OpenRouter
- Mitigation: `.env.local` in `.gitignore`, `git-secrets` pre-commit hook, key rotation quarterly, OpenRouter key scoped to $10 cap

### Maintenance cost (time, not money)

- Next.js major version every 6 months → 2–4 hrs upgrade
- Model deprecation → 1–2 hrs swap
- Bank changes slip format → 1 hr prompt tweak + golden set update
- Windows update breaks OneDrive path → 15 min
- Realistic ongoing: **~4 hrs/quarter** to keep it running

### The Hidden Ongoing Costs Summary

| Cost | Recurring | Notes |
|---|---|---|
| OpenRouter API | ~$2–5/mo | Depends on slip volume |
| Domain (optional) | ~$12/yr | If custom domain wanted |
| Pushover | $5 one-time | Or Telegram free |
| Time maintenance | ~4 hrs/quarter | You, staying on top of it |
| **Realistic total** | **~$3–6/mo + 1 hr/mo** | |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router, RSC-first) | Server components remove client waterfalls |
| DB access | `postgres.js` | ~10× smaller than Supabase JS client |
| Database | Supabase Postgres | Free tier, hosted, backups |
| Storage (hot) | Supabase Storage | Slips <6 months |
| Storage (cold) | Cloudflare R2 | Slips >6 months |
| UI | Tailwind + design tokens + shadcn/ui primitives only | No component sprawl |
| Charts | `uPlot` | Recharts is 200 KB, we render 3 charts |
| OCR gateway | OpenRouter | One API, model swap without code change |
| Primary OCR | Gemini 2.5 Flash Lite | $0.10 / $0.40 per M tokens |
| Fallback OCR | Gemini 2.5 Flash | On low-confidence retry |
| Analysis | Claude Opus 4.7 via OpenRouter | On-demand only |
| Sync runtime | Node.js 20+ | Runs on laptop |
| Alerts | Pushover or Telegram bot | Push to phone |
| Hosting | Vercel + Supabase | Free tier |
| Tests | Vitest + Playwright | Standard |
| CI | GitHub Actions | Free for public repo |

---

## Architecture

```
LOCAL LAPTOP                              CLOUD
┌─────────────────────────┐              ┌────────────────────────┐
│  OneDrive sync folder   │              │  Vercel (Next.js RSC)  │
│  ↓                      │              │  ├─ dashboard (SSR)    │
│  sync.js                │──writes─────▶│  ├─ transactions       │
│  ├─ verify readable     │              │  ├─ review             │
│  ├─ HEIC→JPEG           │              │  └─ merchants          │
│  ├─ PDF split           │              │  reads via postgres.js │
│  ├─ OpenRouter OCR      │              └────────────────────────┘
│  ├─ normalize           │                          ↑
│  ├─ save to Postgres    │              ┌────────────────────────┐
│  ├─ push notify on fail │─writes──────▶│  Supabase Postgres     │
│  └─ exit non-zero if any│              │  + Storage (hot)       │
└─────────────────────────┘              └────────────────────────┘
                                                     ↓ (>6 months, cron)
                                         ┌────────────────────────┐
                                         │  Cloudflare R2 (cold)  │
                                         └────────────────────────┘
```

**No queue. No retry backoff. No lease.** Sequential single-pass.

---

## Database Schema

```sql
raw_inputs (
  id, source, storage_tier, file_path, file_hash UNIQUE,
  extractor_version, ocr_response JSONB, ingested_at, archived_at
)

transactions (
  id, date, amount, currency, direction, merchant_id, account_id,
  reference_no, notes, extractor_version, created_at
)

transaction_evidence (transaction_id, raw_input_id)  -- 1:N linkage

merchants (id, canonical_name, category_id, created_by)
merchant_aliases (alias PK, merchant_id)
accounts (id, bank_name, account_name, account_type, current_balance)
categories (id, name, parent_id, icon, color)
budgets (id, category_id, monthly_limit, year, month)

-- Materialized view for dashboard
CREATE MATERIALIZED VIEW dashboard_current_month AS ...
```

No `status`, no `retry_count`, no `confidence_score` in DB.

---

## UX Design System

**Colors:** 4 tokens — `--bg`, `--fg`, `--muted`, `--accent`, dark/light variants.
**Type:** 3 sizes — 14, 16, 20 px. Font: Inter.
**Spacing:** 4 values — 4, 8, 16, 24 px.
**Breakpoints:** mobile + `md:` at 768 px.
**Touch targets:** ≥44 px.
**Loading:** skeleton on every data-fetching page.

`design/tokens.ts` + `/design/preview` route defined in Phase 0.

---

## Prompt Discipline

**System prompt cap: 2,000 tokens.** Edge cases live in normalizers + `bank_hints` table + fixtures, not prompt.

Prompt files versioned: `// version: 2.3`. Change → bump version → run golden set → new `extractor_version` on new rows.

---

## Data Lifecycle & Versioning

| Data | Hot | Cold | Delete |
|---|---|---|---|
| Slip images | 6 mo (Supabase) | 12 mo (R2) | 18 mo |
| LINE screenshots | 3 mo | 6 mo | 9 mo |
| OCR response JSON | Forever | — | never |
| Transactions | Forever | — | never |
| `system_errors` | 90 days | — | rolling |

**Nightly cron (GitHub Actions):** hot→cold, R2→delete, refresh materialized views, `pg_dump` backup.

**Re-extraction on version bump:** `re-extract.js` fetches all `raw_inputs` where `extractor_version < current`, runs new extractor, surfaces diffs in `/review/versioning` for user approval.

---

## Development Chunks (WBS)

Each chunk = one Sonnet session, one commit, one PR, one test suite, one plain-language user update.

### Phase -1 — User Inventory (ask first, build second)

| Chunk | Owner | Question to user |
|---|---|---|
| -1.1 Existing accounts | User | Do you have: OpenRouter? Supabase? Vercel? GitHub? Pushover? Cloudflare? |
| -1.2 Existing data exports | User | Money Manager CSV location? Format sample? Categories used? |
| -1.3 OneDrive structure | User | Share directory listing of `Bank Slips/` folder |
| -1.4 Laptop specs | Opus | RAM, disk free, Node version, PowerShell version, Windows build |
| -1.5 Existing scripts/tools | User | Any personal scripts/spreadsheets we should keep in sync? |
| -1.6 Golden slip set | User | Send 5 real slips per bank + write correct extraction in notes |
| -1.7 Design preference | User | Share 2–3 apps whose UI you'd want to feel like |

**No Phase 0 work starts until -1 is complete.**

### Phase 0 — Preflight

| Chunk | Agent | Depends on | Acceptance |
|---|---|---|---|
| 0.1 Repo scaffold + file convention | Foundation | -1 | Directory structure matches convention. `README` explains layout. |
| 0.2 Design tokens + `/design/preview` | Foundation | -1.7 | Preview route renders all tokens |
| 0.3 Test harness (Vitest + Playwright) | Foundation | 0.1 | `npm test` runs. Sample test passes. |
| 0.4 CI on GitHub Actions | Foundation | 0.3 | PR triggers CI. Red blocks merge. |
| 0.5 `check-env.js` on postinstall | Foundation | -1.4 | Fails install if Node <20 or OneDrive path missing |
| 0.6 Prior art research | Opus | -1 | `docs/prior-art.md` written |
| 0.7 ADR + STATE + RISKS + COMMS templates | Foundation | 0.1 | All doc scaffolding in place |

### Phase 1 — Foundation (sequential)

| Chunk | Agent | Depends on | Acceptance |
|---|---|---|---|
| 1.1 DB schema + RLS + storage bucket | Foundation | -1.1 | All tables exist. RLS test: anon key insert → 42501. Test passes. |
| 1.2 Next.js scaffold + design tokens | Foundation | 0.2 | `/design/preview` renders. Lighthouse >90. |
| 1.3 postgres.js client + Zod schemas | Foundation | 1.1 | `select 1` returns. Bundle <150 KB. Unit tests for schemas. |
| 1.4 OpenRouter wrapper | Foundation | -1.1 | Wrapper handles fences, forces JSON, returns typed. Mocked tests pass. |
| 1.5 Golden set eval runner | Foundation | -1.6, 1.4 | `npm run eval` runs all fixtures, prints pass/fail per field. |

### Phase 2 — Ingestion (Pipeline agent)

| Chunk | Depends on | Acceptance |
|---|---|---|
| 2.1 File readability + HEIC/PDF | 1.3 | Sync script scans, converts HEIC, splits PDF, skips 0-byte. Unit tested. |
| 2.2 OCR call + normalizers + save | 1.4, 1.5, 2.1 | 1 slip end-to-end → transaction row. Golden set >95%. E2E test. |
| 2.3 Money Manager CSV import | 1.3, -1.2 | 1 CSV → N tx rows. Idempotent via file_hash. Test on real CSV sample. |
| 2.4 Bootstrap merchant list from CSV | 2.3 | Merchants populated. Aliases created. Test count vs source. |
| 2.5 Pushover alerts on failure | 2.2, -1.1 | Simulated failure → phone push within 5s. Integration test with mocked API. |

### Phase 3 — UI (UI agent, parallelizable)

| Chunk | Depends on | Acceptance |
|---|---|---|
| 3.1 Dashboard RSC + materialized view | 1.2, 2.2 | Loads <500ms with 1000 tx. Single SQL query. Playwright test. |
| 3.2 Transaction list + filters | 1.2 | Server-rendered, URL params. Playwright test. |
| 3.3 Review page (image + editable) | 2.2 | 20 items reviewed <2 min on mobile. E2E test. |
| 3.4 Merchant management | 2.4 | Merge aliases. New merchant blocks sync until categorized. |

### Phase 4 — Lifecycle & Ops

| Chunk | Depends on | Acceptance |
|---|---|---|
| 4.1 Structured JSON logs + local file | 2.2 | `logs/YYYY-MM-DD.jsonl` written. Log rotation test. |
| 4.2 Nightly cron: hot→cold + `pg_dump` | 4.1 | Cron runs, moves files, backup lands in R2. Verified restore test. |
| 4.3 Re-extraction + versioning diff UI | 3.3 | Version bump on 10 slips shows diffs. User approves. Test with 2 versions. |
| 4.4 Weekly digest push | 2.5 | Sunday 9am push: spend, top category, review count. Integration test. |
| 4.5 Cost cap / kill switch | 2.5 | If daily API spend >$1, script refuses. Test with mocked spend. |

---

## Agent Assignment

| Agent | Owns | Cold-start briefing |
|---|---|---|
| **Foundation** | Phase -1, 0, 1 | Design principles + schema + tokens + eval + testing |
| **Pipeline** | Phase 2 | Design principles + schema + Phase 1 outputs + golden set |
| **UI** | Phase 3 | Design principles + tokens + schema read paths |
| **Ops** | Phase 4 | Design principles + lifecycle + logging + risk register |

**Handoff:** each agent's final commit updates `STATE.md` + `COMMS.md`. Next agent reads both first.

---

## Orchestration Protocol (Opus ↔ Sonnet)

```
TASK: [chunk name]
BUDGET: 45 min, 30k output tokens
INPUTS: [file paths, prior chunk outputs]
ACCEPTANCE:
  - verifier command that returns 0
  - matching test file exists and passes in CI
CHECKPOINTS:
  - report at 15 min / 10k tokens
  - stop and ask if blocked
OUTPUT:
  - files changed
  - verifier output
  - test file(s)
  - STATE.md diff
  - COMMS.md entry in plain language
```

**Opus verifies by:** running acceptance itself, diffing STATE.md, checking test coverage, checking token spend vs budget.

**Every 3 loops:** Opus re-reads the plan, asks "are we still solving the same problem, or accreting band-aids?"

---

## Traceability & Rollback

- One commit per chunk with `[phase.chunk]` prefix
- `STATE.md` — current system state
- `docs/adr/NNN-*.md` — one per non-trivial decision
- `docs/LOOP-LOG.md` — every failure loop
- `docs/COMMS.md` — every user-facing update
- `docs/RISKS.md` — every risk surfaced
- Git tags at phase boundaries: `phase-N-complete`

---

## Local Runtime Requirements

- Node 20+, Windows 10/11
- ≤500 MB RAM during full batch
- No Docker, Ghostscript, ImageMagick, or Postgres locally
- `npm ci` on fresh machine
- `check-env.js` on postinstall gates the install

---

## RLS Policy Templates (single-user app)

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON transactions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "user_read" ON transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Storage:
CREATE POLICY "user_read_storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'slips' AND auth.uid() IS NOT NULL);
CREATE POLICY "service_write_storage" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'slips' AND auth.role() = 'service_role');
```

Test: chunk 1.1 acceptance runs anon-key insert; must fail with `42501`.

**Key management:**
- `SUPABASE_ANON_KEY` — browser-safe
- `SUPABASE_SERVICE_ROLE_KEY` — sync script only, never `NEXT_PUBLIC_*`
- Build fails on `NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)` regex

---

## Observability

| Severity | Channel | Trigger |
|---|---|---|
| Fatal | Pushover push | Sync exits ≠0, DB unreachable |
| Warning | JSON log line | Low confidence, slow HEIC, model fallback |
| Info | Console + log file | Normal progress |

**Exit codes:** 0 all ok, 1 partial failure, 2 crashed.
**Local logs:** `logs/YYYY-MM-DD.jsonl`, rotated weekly.
**Weekly digest:** Sunday 9am push.

---

## Verification (Golden Path)

Before v1 ships:
1. Cold laptop test: fresh clone → `npm ci` → env → 20 real slips → all appear in dashboard in <3 min
2. Failure test: bad OpenRouter key → phone push in 30s → exit 2
3. Load test: dashboard with 5000 tx → first paint <500ms on 4G
4. Review test: 20 items reviewed on mobile <2 min
5. Version bump: change prompt, re-extract 10, diff UI works
6. Lifecycle test: 7-month-old slip → cron → moved to R2, dashboard OK
7. RLS test: anon key insert → 42501
8. Habit test: 2-week trial → open rate ≥5 days/week, review queue ≤20
9. Backup restore test: nightly `pg_dump` restored to fresh DB successfully
10. Cost cap test: mock spend >$1 → script blocks

---

## What This Plan Refuses to Do

- Build without asking what the user already has
- Ship code without a matching test
- Talk to the user in jargon or leave them without updates for hours
- Reinvent patterns without checking prior art
- Hide costs, retention limits, or vendor lock-in from the user
- Store confidence scores, retry counts, or queue states as data
- Bloat the OCR prompt with edge cases
- Assign all work to one long-running agent
- Ship without push-notification alerting
- Deploy without a defined design system
