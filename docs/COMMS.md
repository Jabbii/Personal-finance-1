# Progress Updates

Plain-language log of what happened each session.

> **How to update this file:** Add a new `## YYYY-MM-DD — [Chunk name]` section at the top of the log (newest first) at the end of every chunk. Write in plain language — no jargon. Always include: what got done, what's next, anything the user needs to do. Keep entries permanent; never delete old ones.

---

## 2026-08-23 (end of day) — switched to Gemini 3.7 Flash, everything pushed to GitHub

**What got done:**
- **Switched the AI model to Gemini 3.7 Flash**, your decision from the bake-off. Gemini 2.5 Flash is dropped entirely — it scored identically but cost about double. The model we were actually using, 2.5 Flash Lite, was the weakest of the five tested.
- Checked it works for real after the switch rather than assuming: two KBank slips read end-to-end, 100% on all four fields.
- **Pushed everything to GitHub.** Eight commits that existed only on your laptop are now backed up, including all of Phase 1.

**One loose end, deliberately left open.** We used to have a "backup model" the app would retry with if the main one seemed unsure. Nothing we tested is better than 3.7 Flash, so that slot has no sensible occupant. It currently points at 3.7 Flash, meaning a retry is just a retry. That's harmless — the retry feature isn't built yet — and we'll settle it in Chunk 2.2 once we know what "seemed unsure" actually means.

**Worth knowing:** the report card numbers on file (date 100%, amount 100%, direction 85%, merchant 65%) were measured on the *old* model. The bake-off predicts 3.7 Flash does better on direction. Run `npm run eval` next session for a current figure — it costs about 36 calls and won't reuse the old answers.

**What's next:** Chunk 2.1 — reading files out of OneDrive properly.

---

## 2026-08-23 (later) — Grab unblocked, and we tested 5 AI models against each other

**What got done:**
- Your OpenRouter top-up unblocked the Grab receipts. All 9 Grab transactions now read correctly out of the 5 PDFs, including the ones holding three rides each. **Full report card is now date 100%, amount 100%, direction 85%, merchant 65% across all 40 transactions.**
- Ran a fair fight between 5 AI models: each one read all 36 slips, three times each, under identical conditions. 534 readings, **89 US cents** total, no failures.

**What we learned:**
- **Three of the things we measured turned out not to matter.** Every model got the number of transactions per document exactly right, every time — even the tricky Grab digests. Four of five got every date and every amount right. When everyone scores full marks, the test can't tell them apart.
- **The merchant score is measuring our problem, not theirs.** Every model sits around 50–65%, because they correctly read what's printed on the slip — the legal company name — while your notes record the shop name you actually use. That's the nickname list in Chunk 2.4, not something a better model fixes.
- **The model we're currently using is the worst of the five.** It's the only one that got dates and amounts wrong, it needed the most retries, it occasionally took 39 seconds to answer, and on one Grab receipt it returned just "GrabFood" and silently threw away the Thai restaurant name. It isn't even the cheapest — it does so much internal "thinking" that it costs more per slip than two faster, more accurate models.

**What needs you — one decision when you're back:**

Which model to switch to. Both of these beat what we're using now:

| Option | Cost per 1,000 slips | Speed | Trade-off |
|---|---|---|---|
| **Gemini 3.7 Flash** | $1.60 | 4.8s | Perfect scores on date, amount and direction. The safe pick. |
| **Gemini 3.5 Flash Lite** | **$1.06** | **2.1s** | Cheapest and fastest, best at Thai text. Slightly worse at telling transfers from expenses — but ordinary code takes that job over in Chunk 2.2 anyway. |

For scale, either one costs roughly 35–55 baht per 1,000 slips. My lean is **Gemini 3.5 Flash Lite**, since the one thing it's weaker at is about to stop being the AI's job.

**What's next:** your model decision, then Chunk 2.1 — reading files out of OneDrive properly.

---

## 2026-08-23 — Chunk 1.5 complete: the report card works, and it found real bugs

**What got done:**
- Built the report card. `npm run eval` shows each of your 36 slips to the AI, compares its answer to what you wrote by hand, and prints a score for each field — date, amount, merchant, direction — overall and per bank.
- Wrote the AI's instructions for reading a slip (the "prompt"), now on version 1.3.0. Four rounds of "run it, look at what broke, fix the instructions, run it again."
- Every AI answer is saved to your laptop, so re-running is instant and free. The save is keyed to the prompt version — change the instructions and it automatically re-asks rather than reusing a stale answer.
- 51 new automated tests. 91 total, all passing.

**The score, on the 31 slips the AI could read:**

| Field | Correct |
|---|---|
| Date | 31/31 — 100% |
| Amount | 31/31 — 100% |
| Direction | 25/31 — 81% |
| Merchant | 24/31 — 77% |

Dates and amounts are perfect, including the tricky ones: PaoTang slips where you pay 98 baht on a 245-baht bill after the 60/40 discount, and Dime slips where a US-dollar share purchase has to come out as baht.

**Four real bugs the report card caught:**
1. **A wrong answer in your answer key.** Two PaoTang slips from 16 July were recorded against each other's filenames. The AI read both correctly; the answer key was wrong. Verified against the images (the reference numbers prove it) and fixed.
2. **Dates were coming out three years early.** KBank prints "21 Jul 26" and the AI assumed the Thai calendar and subtracted 543. Fixed.
3. **Then 7-Eleven broke the fix.** It prints "20/07/69" — the same two digits, but Thai calendar. So there is no single rule; the AI now tries both readings and keeps whichever lands near today.
4. **"Transfer Completed" was being taken literally.** KBank titles nearly every payment that way, so paying a friend was filed as moving money between your own accounts. Direction is now judged from the two names, never the wording.

**Two things that are NOT AI mistakes, and shouldn't be fixed with better instructions:**
- **The SCB shop-name problem.** The AI reads "ABUNDANT EMINENT (THAILAND) LIMITED" because that is genuinely what the slip says — the words "Arabica Coffee Roaster" appear nowhere on it. Same for Bangkok Espresso (paid via a personal account, Mr Yutthana Pongsuwan) and Jones Salad (via BEAM CHECKOUT). This is exactly what the merchant nickname list in Chunk 2.4 is for: teach it once, remembered forever.
- **Direction judgement.** The AI reports the two names correctly every single time — it just reasons about them badly. Ordinary code comparing those names against your own is the right fix, and it belongs in Chunk 2.2. No more prompt tweaking.

**What needs you:**
1. **Your Grab receipts are stuck.** All 9 Grab transactions failed — OpenRouter requires at least $0.50 of credit before it will accept PDF files, and the balance is below that. Everything else went through because images are billed differently. Top up at openrouter.ai/settings/credits and they'll be read on the next run. That's 9 of your 40 transactions currently unmeasured.
2. **Two 7-Eleven branch names to confirm.** The AI read "7-Eleven สรรพากรอารีย์" where you wrote "7-Eleven สถานีสรรพากรอารีย์", and "ศูนย์การประชุมแห่ง..." where you wrote "ศูนย์ประชุมแห่ง...". I suspect the AI is right and the notes were shortened — worth a glance.

**What's next:** Chunk 2.1 — reading files out of OneDrive properly (forcing real downloads, splitting PDFs), then 2.2, which turns a read slip into a saved transaction and adds the code that will fix the direction scores.

---

## 2026-07-31 — Chunk 1.4 complete: the AI-reading wrapper is built

**What got done:**
- Built the code that will call the AI model to read your bank slips (`lib/openrouter/client.ts`). This is the one and only place in the whole app that talks to OpenRouter — every future feature that needs AI (reading slips, categorizing, analysis) goes through this one function instead of each writing its own API-calling code.
- It does three things reliably: asks the model to answer in JSON only, cleans up the response if the model wraps its answer in a markdown code block anyway (a common quirk), and double-checks the shape of what comes back against a strict rulebook before handing it off — so a malformed or unexpected AI response gets caught immediately instead of silently corrupting your data.
- 11 new automated tests, all using a fake/simulated AI response (no real API calls, no cost) to prove the fence-cleanup, JSON-forcing, and validation logic all work correctly. 40 tests total now passing.
- Which AI model gets used stays configurable in `.env.local` (`MODEL_PRIMARY`, `MODEL_FALLBACK`, `MODEL_ANALYSIS`) rather than hard-coded — so if Google or Anthropic renames or retires a model later, it's a one-line settings change, not a code change.

**What's next:** Chunk 1.5 — the golden set eval runner (the tool that will grade how accurately the AI reads your 25 real bank slip photos once you've sent them over).

**Anything you need to do:** Still the same two open items whenever you get a chance: export Money Manager as `.csv`, and send over the 25 golden slip photos (5 per bank × 5 banks) — Chunk 1.5 needs those to actually test anything.

**Cost so far:** $0 — this chunk only ran mocked/simulated tests, no real OpenRouter calls yet.

---

## 2026-07-31 — Chunk 1.3 complete: the app can now talk directly to the database

**What got done:**
- Wrote the actual code that connects to your database (`lib/db/client.ts`) — verified it works by running a real query against your live Supabase project.
- Wrote a rulebook for every one of the 8 database tables (`lib/validators/`) that checks incoming data is shaped correctly before it's saved — e.g. a transaction must have a real date, a positive-or-zero amount, and one of `income`/`expense`/`transfer` as its direction, or it gets rejected before it ever touches the database. This is what Phase 2 (reading bank slips and CSVs) will build on.
- 17 new automated tests added (29 total, all passing) checking both the database connection and every validation rule.
- Confirmed the new database library adds no weight to the actual web pages your browser downloads — it only runs on the server, never shipped to visitors.

**Non-obvious finding:** hit a real bug while wiring up the database connection — your database password contains an `@` symbol, which happens to be the same character that separates a password from a server address in a connection string. Without encoding it, the connection tried (and failed) to look up a server literally named after a fragment of your password. Fixed by encoding the special characters; no changes needed to the actual password.

**What's next:** Chunk 1.4 — the OpenRouter wrapper (the code that calls the AI model to read bank slips).

**Anything you need to do:** Nothing urgent. Same asks as before still stand whenever you get a chance: export Money Manager as `.csv`, keep gathering the 25 golden slip photos (5 per bank × 5 banks) for Chunk 1.5.

**Cost so far:** $0.

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
