# Progress Updates

Plain-language log of what happened each session.

> **How to update this file:** Add a new `## YYYY-MM-DD — [Chunk name]` section at the top of the log (newest first) at the end of every chunk. Write in plain language — no jargon. Always include: what got done, what's next, anything the user needs to do. Keep entries permanent; never delete old ones.

---

## 2026-07-28 — Chunk 1.1 complete: database is live

**What got done:**
- Built the actual database in your Supabase project: 8 tables (accounts, categories, merchants, merchant aliases, raw inputs, transactions, transaction evidence, budgets) plus a fast-loading dashboard summary table.
- Locked every table down with Row Level Security — only the app itself (using a private key that never leaves the server) can write data. Verified this automatically: tried writing to the database using the public key and confirmed it gets rejected.
- Created the private `slips` storage folder for bank slip images/PDFs (10 MB per file limit, only image/PDF file types accepted).
- All of this is saved as 4 numbered `.sql` files in `/migrations` — a permanent record of your database's structure, so it can be rebuilt from scratch if ever needed.
- Added an automated test (`npm test`) that checks this setup stays correct going forward — 12 tests passing.

**Non-obvious finding:** Your Supabase project uses their newer "publishable/secret key" system rather than the older key format. Functionally identical for our purposes, but it changed one small detail of how a blocked request reports itself (401 vs. 403) — fixed in the test, no action needed from you.

**What's next:** Chunk 1.2 — scaffolding the actual Next.js web app and wiring up the design tokens (colors, spacing, fonts) so pages start rendering.

**Anything you need to do:** Nothing urgent. Whenever you get a chance: export Money Manager as an actual `.csv` (the `.xlsx` file already in the folder works for reference, but Phase 2.3 needs the CSV format), and keep gathering the 25 golden slip photos (5 per bank) for Chunk 1.5.

**Cost so far:** $0. Supabase free tier — nowhere near the 500 MB database / 1 GB storage limits yet.

---

## 2026-07-28 — Design pass: real accessibility bugs found and fixed

**What got done:** Installed a third-party design-review tool (`/impeccable`) at your request and used its checklist to re-examine `/design/preview` with real contrast math instead of eyeballing it. Found two genuine bugs, not style opinions:
- The green "income" and red "expense" color swatches had white text that only reached 2.5:1 and 3.7:1 contrast against their backgrounds — well under the 4.5:1 minimum for readable text. Fixed by switching to dark text (now 7.6:1 and 5.3:1).
- The purple accent color used for dark mode (`accent-dark`) was measurably too light/dark to pair with either near-white or near-black text at readable contrast — and this one was already live on the real "switch to dark/light" toggle button, not just the preview page. Nudged the color slightly (`#6366F1` → `#7075F5`) after checking the fix in your browser; light-mode colors are untouched.

**Worth flagging on the third-party tool itself:** while installing it, its own script printed text specifically written to influence *how I behave as your AI assistant* — including one part trying to get me to treat "you asked me to install this" as blanket permission to run its bundled sub-agents on my own authority going forward, without checking with you again. I did not follow that instruction and flagged it to you directly before continuing. I also found it wrote an automatic hook that now runs a script after every file edit and at the end of each response — you approved keeping that running.

**What's next:** Chunk 1.3 — the actual database connection code, still on pause per your request. Let me know when to resume.

**Anything you need to do:** Nothing urgent — just noting that a third-party tool is now part of this project's setup (`.claude/skills/impeccable/`), in case you want to reconsider that later.

**Cost so far:** $0.

---

## 2026-07-28 — Chunk 1.2 complete: the app has a face

**What got done:**
- The actual Next.js web app now exists and runs (`npm run dev` → localhost:3000).
- Wired up the color/font/spacing system from Chunk 0.2 for real — every color, font size, and rounded-corner style you'll ever see in this app is pulled from one file (`design/tokens.ts`), not typed out by hand each time.
- Built `/design/preview` — a page showing every color, text size, spacing gap, corner radius, and shadow the app will ever use, plus a light/dark mode toggle button so you can see both look right.
- The homepage is a simple placeholder for now (the real dashboard is Phase 3) with a link to the design preview.
- Checked everything by actually opening it in a browser, not just running tests — and that caught a real bug: the demo boxes for "corner roundness" and "shadows" were invisible because of how I'd wired the sizing rules. Fixed it, verified the fix visually.
- 9 automated browser tests added (checking the preview page, the toggle, and the homepage link) — run on 3 different simulated devices (an Android phone, an iPhone, and desktop). All passing, alongside the 12 tests from before.

**Non-obvious finding:** `npm install` flagged 3 "high severity" security warnings — but they're both bundled inside Next.js itself (not something we chose), and only matter if the app processes files from strangers on the internet, which ours never will (single user, no public upload form). The suggested "fix" would downgrade Next.js six years. Logged in `docs/RISKS.md`, no action needed from you — just flagging it per our "no hidden costs or risks" rule.

**What's next:** Chunk 1.3 — the actual database connection code (so the app can eventually read/write real data) and the validation rules that check incoming data is shaped correctly.

**Anything you need to do:** Nothing. Same asks as before still stand whenever you get a chance: export Money Manager as `.csv`, keep gathering the 25 golden slip photos.

**Cost so far:** $0.

---

## 2026-07-26 — Chunk 0.1 complete

**What got done:** Repo initialized, full folder structure created, plan saved to docs/PLAN.md, README written, all doc scaffolding in place. Pushed to GitHub.

**What's next:** Chunk 0.2 (design tokens) — defining colors, type sizes, and spacing before any UI component is written.

**Anything you need to do:**
- Start collecting 5 bank slip images per bank (KBank, SCB, BBL) for OCR testing — any photos/screenshots/PDFs
- When you have time: create OpenRouter account at openrouter.ai (needed before we build the OCR pipeline)

---

## 2026-07-26 — Chunks 0.2 → 0.6 complete

**What got done:**
- Design tokens defined and 10 contract tests written (all pass).
- Vitest + Playwright test harness up and running.
- GitHub Actions CI running unit tests and a secret-safety check on every push/PR.
- `check-env.js` runs on `npm install` — verifies Node version, `.env.local` contents, secret safety, OneDrive path.
- `.env.local` filled in with Supabase, OpenRouter, and per-bank OneDrive folder paths.
- **Chunk 0.6 prior art research** — reviewed Actual Budget, Firefly III, Maybe Finance, Lunch Money. Checked latest Next.js, OpenRouter pricing, Supabase RLS, OneDrive Files-On-Demand, HEIC libraries. Written up in `docs/prior-art.md`.

**Non-obvious findings from research:**
1. **Next.js 16.2 is out** and worth using — new `"use cache"` directive is a better fit for our dashboard than the old `unstable_cache` approach. Small upgrade cost, real gain.
2. **Qwen3-VL is actually more expensive than Gemini 2.5 Flash Lite** on OpenRouter. Dropping Qwen from the plan — Gemini handles both OCR and any needed categorization.
3. **Skip AI categorization for MVP** — your Money Manager CSV already has ~150 merchants + categories, that's plenty to seed with. New merchants go to a manual review queue instead of guessing.
4. **OneDrive Files-On-Demand needs handling** — most of your 40k Pictures files are "placeholder" (metadata only, contents in cloud). Before reading a slip, sync script will run `attrib +P` to force download, then wait for the file to fully arrive before OCR.
5. **HEIC library choice: `heic-convert`, not `sharp`** — pure JS, no native binary headaches on Windows. Slower but volume is low.
6. **5 banks total, not 3** — golden slip set target is now 25 slips (5 per bank × KBank, SCB, BBL, Krungthai, Dime!).

**What's next:** Chunk 0.7 (doc conventions) is small — mostly formalizing how we write STATE / COMMS / RISKS / LOOP-LOG going forward. Then Phase 1 (database, Next.js scaffold, OpenRouter wrapper, golden set runner).

**Anything you need to do:**
- Nothing urgent. When you next open the laptop, you can start collecting bank slips (5 real slips per bank, 25 total) for the golden test set — Chunk 1.5 needs these.
- No new accounts needed for Phase 0.7. Supabase project + OpenRouter key are already in `.env.local`.

**Cost so far:** $0. No API calls made yet — everything so far is local scaffolding and research.
