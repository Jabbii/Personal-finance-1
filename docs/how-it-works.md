# How It Works — Plain-Language Reference

Last updated: 2026-08-23

> **Who this is for:** the user, not the engineer. Every technical term gets defined
> once, in one sentence. If something here stops being true, fix it here — this is
> the document you re-read when you've been away from the project for a month.
>
> `docs/PLAN.md` is the architecture spec. This is the same system explained in
> ordinary words, plus the reasoning behind the choices you'd otherwise have to
> take on faith.

---

## 1. The one-paragraph version

You screenshot a bank slip on your phone. It syncs to OneDrive on its own. When
you next open the laptop and run the sync, a script finds the new slips, sends
each picture to an AI that reads it, cleans up the answer with ordinary code,
and saves the result to a database in the cloud. A website reads that database
and shows you a dashboard on your phone. You do nothing except screenshot slips
and, occasionally, tag a merchant the system hasn't seen before.

---

## 2. Input to output, in nine steps

```
YOUR PHONE          YOUR LAPTOP                    THE CLOUD

  slip  ──OneDrive──▶  sync.js
                       ├─ force real download
                       ├─ fingerprint (SHA-256)
                       ├─ convert if needed
                       ├─ read it ────▶ OpenRouter ──▶ Gemini
                       │               (switchboard)   (reads it)
                       ├─ clean up  ◀──────────────────┘
                       └─ save ─────────────────▶ Supabase
                                                  ├─ Postgres (numbers)
                                                  └─ Storage (images)
                                                        │
  dashboard ◀──────────────────── Vercel (Next.js) ◀────┘
```

**1. The slip arrives.** You pay someone in K PLUS, screenshot the confirmation,
and your phone syncs it to OneDrive. You do nothing else. This already happens
today, without any of our code.

**2. You open the laptop and run the sync.** Nothing is automatic or always-on.
Processing is on-demand, triggered when the laptop is opened.

**3. `sync.js` finds new files and makes them readable.** See §4 — this step has
more traps in it than it looks.

**4. It sends each image out to be read.** OpenRouter forwards it to Gemini,
which returns `{date, amount, merchant, direction}`. **This is the only step
that leaves your machine, and the only step that costs money.**

**5. Normalizers clean it up — plain code, no AI.** Buddhist year 2569 becomes
2026. `"1,234.00 บาท"` becomes `1234`. `"SUNTAREE BUGGAKUPTA"` gets matched
against your curated merchant list. The internal-transfer rule fires here: if
sender and recipient are both you, mark it `transfer` and keep it out of
spending totals.

> **Why code and not AI for this step?** Design principle #6: *the prompt is a
> contract, not a knowledge base.* The AI's job is to read what's on the image.
> Deciding what it means is the code's job, because code is testable, free, and
> gives the same answer every time.

**6. It saves, then shuts up or shouts.** Success writes to Supabase. Failure
sends a push notification to your phone. There are no silent failures and no
error table you'd have to remember to check.

**7. Supabase stores everything** — see §3.

**8. The website builds the page on the server.** Next.js running on Vercel
reads the database and sends your phone finished HTML, not a spinner that
fetches data afterward. That's what makes it load instantly on mobile.

**9. You look at it.** A dashboard for the month, and a review queue holding
anything the AI was unsure about or any merchant it hasn't seen before. You tag
it once; it's remembered forever.

**Where money is spent:** step 4 only. Everything else is free-tier or your own
laptop.

**Where your data leaves your control:** step 4 (images to Google, via
OpenRouter) and step 7 (everything to Supabase, a US company running on AWS).

---

## 3. What each piece of the stack actually does

### Supabase — the filing cabinet

Supabase does **three** jobs for us, and it helps to keep them separate:

| Job | What lives there | Why |
|---|---|---|
| **Postgres** (database) | The numbers — transactions, merchants, accounts, categories, budgets | This is the actual ledger. All dashboard math runs here. |
| ~~**Storage** (files)~~ | ~~Slip images~~ | **Removed 2026-08-23 (ADR-002).** Images stay in OneDrive. |
| **Auth** (logins) | Almost nothing | There is exactly one user: you. Barely used. |

**Supabase now holds numbers only.** That was a deliberate simplification: you
said you don't need to see slip pictures on your phone, and that was the only
thing the cloud copy existed for.

Supabase is just **hosted Postgres with conveniences bolted on**. Postgres is
the open-source database that has been the boring, correct choice for thirty
years. We are not locked in: we connect with a standard Postgres driver
(`postgres.js`), not Supabase's own toolkit, so moving to any other Postgres
host is a day of work, not a rewrite.

**Free tier:** 500 MB database, 1 GB file storage. When it fills, writes stop.
Paid is $25/month. At your transaction volume the database will take years to
fill; storage is the one to watch, which is why images age out (§5).

### OpenRouter — the switchboard

**OpenRouter is not an AI.** It doesn't read anything. You send it a request
saying "give this to Gemini," it forwards to Google, and passes the answer back.
One account, one key, one bill — but access to Google's models, Anthropic's, and
dozens of others.

**Why it's there:** swapping AI models becomes a one-line config change instead
of a rewrite. Without it, choosing Gemini means writing Google-specific code,
and switching later means rewriting that code, opening a new account, and adding
a new bill.

> **Provenance:** OpenRouter has been in `docs/PLAN.md` since the first commit
> (`d9e4727`, Chunk 0.1) as "OCR gateway," and was one of the six accounts asked
> about in Chunk -1.1. It was a single line in a table for three weeks before
> anyone explained what it was — hence this document.

### Gemini — the eyes

`google/gemini-3.7-flash` reads the slips — picked on 2026-08-23 by testing
five models against your own 36 slips three times each, not by reading a price
list (see §6). It costs about $1.60 per 1,000 slips, roughly 55 baht.
`anthropic/claude-opus-4-7`
is reserved for occasional heavy analysis ("what did I spend on food last month,
and is that unusual?") and is never called automatically.

### The rest, briefly

| Piece | Job |
|---|---|
| **Next.js on Vercel** | The website you look at. Builds pages on the server. |
| **`postgres.js`** | How the code talks to the database. Chosen for being ~10× smaller than the alternative. |
| ~~**Cloudflare R2**~~ | Dropped by ADR-002. May reappear in Phase 4 only if database backups don't go to OneDrive. |
| **Vitest / Playwright** | Automated tests. Nothing ships without them. |
| **GitHub Actions** | Runs those tests on every change. Broken tests block the change. |

---

## 4. The journey of one file

### Why it isn't as simple as "read the file"

**OneDrive gives you a fake file.** When your phone uploads a screenshot,
OneDrive on the laptop creates a **placeholder** — Explorer shows the filename
and even a thumbnail, but the actual image data is still sitting in Microsoft's
cloud. The file on disk is about 1 KB of nothing. This feature is called Files
On-Demand and it exists to save disk space.

A script that just opens the file either blocks for a long time or reads
garbage. So:

1. **Force a real download.** Run `attrib +P` on the file and *wait* for
   OneDrive to actually fetch it.
2. **Fingerprint it.** Compute a SHA-256 hash of the bytes — a 64-character code
   unique to that exact image. See §5; this is the backbone of the whole system.
3. **Convert only if needed.** A multi-page PDF like a Grab daily digest is split
   into one image per page, landing in `%USERPROFILE%/finance-sync/converted/`.
   A plain JPEG or PNG is read where it sits, with **no copy made** — which,
   per the scan below, is every image you own.

   > **HEIC conversion was planned and is not needed.** The plan assumed iPhone
   > HEIC photos and budgeted a `heic-convert` step for them. A scan of all 10
   > bank folders on 2026-08-23 found **1,956 files and zero HEIC**: 1,219 `.jpg`,
   > 565 `.jpeg`, 172 `.png`. The user is on Samsung, not iPhone — and more to the
   > point, these are *screenshots*, and HEIC is a camera format that Android
   > screenshots never use. Nothing was ever installed, so this is a plan-level
   > correction only. Decision deferred to Chunk 2.1; see `docs/STATE.md`.
4. **Read the bytes into memory** and send them to OpenRouter. The file isn't
   "uploaded" anywhere at this point — it's sent as data inside the request.
5. **Write the transaction row** to Postgres. The image itself is **not uploaded
   anywhere** — it stays in OneDrive, and `raw_inputs.file_path` records where.
   *(Amended 2026-08-23 — there used to be a step here uploading the image to
   Supabase Storage. See ADR-002.)*

### What happens to the files afterward

| File | Fate |
|---|---|
| **The original in OneDrive** | **Untouched. Never moved, renamed, or deleted** — and now the only copy that exists. Plan rule: OneDrive is user-owned; we scan whatever structure exists and never rearrange it. Optionally `attrib -P` un-pins it afterward, letting OneDrive evict it back to a placeholder later to reclaim disk space. |
| **Converted temp files** | Live in `finance-sync/converted/`, only for split PDFs. **Cleanup policy is an open gap** — see `docs/STATE.md`. To be settled in Chunk 2.1. |
| **The AI's reading of it** | **Kept forever**, in `raw_inputs.ocr_response`. |

**There is no cloud copy of any image.** (ADR-002, 2026-08-23 — the plan
originally uploaded every slip to Supabase and aged it through Cloudflare over
18 months.) The durable record of a transaction is the row in Postgres plus the
model's full reading of the slip, both kept forever. The picture itself lives
in OneDrive for as long as you keep it there.

**One consequence worth knowing:** if you ever delete slips from OneDrive to
free space, the numbers survive but the pictures are gone for good.

---

## 5. How data maps back to the right file

**The hash is the anchor — not the filename, not the folder path.**

```
OneDrive:  .../Pictures/K PLUS/016202144107DPP01788.jpeg
              │
              ├─ SHA-256 ──▶ a3f8b2c9d1e4...
              │
Postgres:  raw_inputs
             file_path    = "C:\...\K PLUS\016202144107DPP01788.jpeg"  ← the only
             file_hash    = "a3f8b2c9d1e4..."   ← UNIQUE, the real key   pointer
             ocr_response = { the AI's raw answer, kept forever }        to the
              │                                                          image
           transaction_evidence  (transaction_id ←→ raw_input_id)
              │
Postgres:  transactions
             date 2026-07-21, amount 700, merchant NARAPON WONGK
```

Four things fall out of this design:

- **No duplicates, ever.** `file_hash` is `UNIQUE` in the database. Run the sync
  twice and the second attempt hits that constraint and stops. Same if you
  screenshot the same slip twice.
- **Rename-proof.** Filenames collide and change — `Screenshot_20260802_183050.jpg`
  guarantees nothing. Move or rename a file in OneDrive and the hash is
  unchanged, so it isn't reprocessed.
- **`file_path` is now load-bearing.** It was a breadcrumb next to a cloud copy;
  since ADR-002 it is the *only* route back to the original image. Renaming a
  file in OneDrive won't cause reprocessing (the hash is unchanged), but the
  stored path will be stale and won't open.
- **One file can hold many transactions.** `transaction_evidence` is
  one-to-many. A Grab daily-digest PDF with five rides produces five transaction
  rows, all pointing back to one source document. (Discovered while building the
  golden set — see `docs/STATE.md`.)

---

## 6. Choices we made, and what we'd do instead

### Why not a different AI model?

Four genuinely different paths, cheapest and easiest first.

**A. A different model through the same OpenRouter.** Change one config line;
all other code stays. Current document-reading benchmark leaders are GLM-OCR (a
specialist), Gemini 3.x Pro, and Claude Opus. Specialist OCR models generally
beat general-purpose ones on raw text accuracy; general-purpose ones do better
at understanding a messy layout. Qwen3-VL explicitly supports Thai.
*Effort: one line. This is what the golden-set report card exists to test.*

**B. Call Google directly, drop OpenRouter.** Gains one less middleman touching
your slips. Loses the one-line model swap, and needs a Google Cloud billing
account plus Google-specific code. **Not worth it** — the middleman's cut is
small, the flexibility is worth more.

**C. Purpose-built OCR services** (Google Vision, AWS Textract, Azure Document
Intelligence). Verified pricing, July 2026:

| Service | Plain text | Structured extraction |
|---|---|---|
| Google Cloud Vision | $1.50 / 1,000 pages | $30 / 1,000 (custom) |
| AWS Textract | $1.50 / 1,000 pages | $50–70 / 1,000 |
| Azure Document Intelligence | $1.50 / 1,000 pages | $10 / 1,000 (prebuilt receipt) |

The $1.50 tier returns **raw text only** — a jumble of Thai lines you'd still
need code to interpret. The structured tiers are tuned for Western invoices, not
Thai bank transfer slips. Our current setup runs roughly **$0.0002 per slip**,
so even the cheapest tier is ~7× more for a worse result. **The option that
sounds more professional and is actually worse for this case.**

**D. Run a model on your own laptop.** Nothing would ever leave the house, and
per-slip cost would be zero forever. **Ruled out on 2026-08-23** — see §7.

### Why not Dropbox or Google Drive instead of OneDrive?

**The complexity isn't OneDrive.** It's the placeholder behaviour in §4, and
**all three do it**: OneDrive calls it Files On-Demand, Dropbox calls it Smart
Sync, Google calls it Drive for Desktop streaming. Switching swaps one vendor's
version of the same headache for another's, and Google Drive is arguably worst
from a script's perspective because it mounts as a virtual drive letter.

You'd also lose something real: your Samsung phone already sorts screenshots
into **per-app folders** — that's why there are 7 paths in `.env.local`. That
structure tells us which bank a slip came from *before* the AI looks at it.
There's no cost saving to justify the migration.

### The simplification we took

**Dropped Supabase Storage; images live only in OneDrive.** Decided 2026-08-23
— the user confirmed they don't need to see slip pictures from the phone, which
was the only thing the cloud copy served.

- **Gained:** no upload step, no image storage cost, no 6/12/18-month lifecycle
  machinery, no Cloudflare account, one fewer failure mode in `sync.js`. Also
  removed the tightest free-tier ceiling in the project.
- **Lost:** cannot view a slip image from the phone. Open the OneDrive folder on
  the laptop instead, using `raw_inputs.file_path`.

Full reasoning, including the database-backup consequence it nearly caused, in
`docs/adr/002-drop-supabase-storage.md`.

---

## 7. The laptop

Measured 2026-08-23:

```
ASUS Zenbook UM3402YA
CPU    AMD Ryzen 5 7530U — 6 cores / 12 threads
RAM    15.4 GB total
GPU    AMD Radeon integrated — no discrete graphics card
Disk   155 GB free of 475 GB
```

**Verdict: cannot run AI models locally.** Three reasons, in order of severity:

1. **No discrete graphics card.** The Radeon is integrated — it borrows system
   RAM and has no dedicated memory pool. It draws windows; it doesn't run neural
   networks.
2. **No CUDA.** Nearly all local vision-model tooling assumes an NVIDIA card.
   On AMD integrated graphics you're on CPU-only inference.
3. **Speed and memory.** A small vision model on this CPU takes roughly a minute
   per slip against about two seconds via API, while consuming 6–10 GB of RAM —
   against a plan budget of ≤500 MB for the entire sync.

**The laptop is entirely adequate for what the plan does ask of it.** The sync
script waits on disk and network far more than it computes.

---

## 8. Where the money goes

| Thing | Cost | What happens at the limit |
|---|---|---|
| Reading slips (Gemini) | ~$0.0002 per slip | You top up OpenRouter credit. Capped at $10. |
| Supabase | Free | 500 MB database, then writes stop. $25/mo to grow. Text rows only, so years of headroom. |
| Vercel | Free | Generous for one user. |
| GitHub | Free | Public repo. |
| Slip image storage | **$0** | OneDrive, which you already pay for. (ADR-002 removed the cloud copy and the Cloudflare account with it.) |
| Pushover (alerts) | $5 one-time | Telegram is a free alternative. |

**Realistic ongoing:** a few dollars a year in AI costs, plus about 4 hours a
quarter of maintenance (framework upgrades, the occasional bank redesigning its
slip).

---

## 9. Glossary

| Term | One sentence |
|---|---|
| **OCR** | Getting text out of a picture. We use shorthand — we actually use a vision model, which both reads *and* understands, in one step. |
| **Vision model** | An AI that accepts images as input, not just text. |
| **Placeholder / Files On-Demand** | A file that looks real in Explorer but whose contents are still in the cloud. |
| **Hash (SHA-256)** | A 64-character fingerprint computed from a file's contents. Same file, same fingerprint, always. |
| **Postgres** | The database engine holding your numbers. |
| **RLS** | Database rules deciding who can read or write what. Defence-in-depth for a single-user app. |
| **Normalizer** | Plain code that cleans up the AI's answer — dates, amounts, merchant names. |
| **Golden set** | 36 real slips with correct answers you wrote by hand, used to grade the AI. |
| **Idempotent** | Running it twice is harmless — the second run changes nothing. |
| **Chunk** | One session of work, ending in one commit and one plain-language update. |

---

## Sources

- [OCR & Document Processing Pricing, July 2026](https://www.buildmvpfast.com/api-costs/ocr)
- [Azure AI Document Intelligence Pricing 2026](https://docuocr.com/blog/azure-document-intelligence-pricing)
- [Best LLM for OCR 2026](https://ofox.ai/blog/best-ai-model-for-ocr-2026/)
- [Best Open Source OCR Tools 2026](https://unstract.com/blog/best-opensource-ocr-tools/)
- [Google vs AWS vs Azure OCR Comparison 2026](https://imagetotable.ai/blog/google-vs-aws-vs-azure-ocr-2026)
- [Placeholder files — Microsoft Learn](https://learn.microsoft.com/en-us/windows/compatibility/placeholder-files)
