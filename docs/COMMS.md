# Progress Updates

Plain-language log of what happened each session.

> **How to update this file:** Add a new `## YYYY-MM-DD — [Chunk name]` section at the top of the log (newest first) at the end of every chunk. Write in plain language — no jargon. Always include: what got done, what's next, anything the user needs to do. Keep entries permanent; never delete old ones.

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
