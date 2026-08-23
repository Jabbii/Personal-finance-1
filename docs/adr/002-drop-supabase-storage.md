# ADR-002: Drop Supabase Storage — OneDrive is the only image store

**Date:** 2026-08-23
**Status:** accepted

## What we decided

Slip images are **never uploaded anywhere.** They stay where the phone already
puts them: OneDrive, on the user's own machine. Supabase holds numbers only.

This removes Supabase Storage, Cloudflare R2 for images, the hot/cold/delete
lifecycle, and the nightly file-migration cron.

## Why

The user was asked directly whether they wanted to tap a transaction on their
phone and see the original slip. Answer: no, they don't care.

That single requirement was the only thing the cloud image copy existed to
serve. Without it, we were building an upload step, a storage bill, a second
storage vendor, a three-stage aging policy, and a nightly job — to maintain a
duplicate of files that already exist, already sync, and are already backed up
by Microsoft.

Design principle #1: *one user, not a SaaS.* Principle #7 said *"raw preserved,
but aged"* — the raw **is** preserved. It's preserved in OneDrive, by OneDrive,
for free, with better durability guarantees than our free tier had.

## Options considered

1. **Keep Supabase Storage as designed** — hot 6mo → R2 12mo → delete at 18mo.
   Full slip viewing from the phone. Costs an upload per slip, 1 GB free-tier
   ceiling, a second vendor, and the entire lifecycle subsystem.
2. **Upload lazily, on first view** — only copy an image to the cloud when the
   user actually opens it. Cheaper, but keeps every moving part and adds
   cache-invalidation questions, to serve a feature the user doesn't want.
3. **Drop cloud image storage entirely (chosen)** — OneDrive is the store.
   `raw_inputs.file_path` already records exactly where each file lives.

## What makes this safe

The parts of the system that actually matter never depended on the image copy:

- `raw_inputs.file_hash` — the SHA-256 dedup key, computed from bytes on the
  laptop. Unaffected.
- `raw_inputs.ocr_response` — the AI's full reading, **kept forever** in
  Postgres. This was always the durable artifact, not the picture.
- `raw_inputs.file_path` — the OneDrive path. Now the single pointer to the
  original, rather than a breadcrumb alongside a cloud copy.
- `transaction_evidence` — links transactions to source files by ID, not by
  storage location.

A transaction's provenance is fully intact: which file it came from, what the
model saw, and when. The only lost capability is rendering the JPEG in a
browser on a device that isn't the laptop.

Verified before executing: all 8 tables and the `slips` bucket contained **zero
rows and zero objects**. Nothing was migrated or discarded.

## Consequences

**Removed:**

- Supabase Storage `slips` bucket, and its 4 RLS policies on `storage.objects`
- `raw_inputs.storage_tier` column (`hot`/`cold`/`deleted` — now meaningless)
- The Data Lifecycle table's slip-image and LINE-screenshot rows
- Cloudflare R2 as an image destination, and from "Accounts needed"
- Chunk 4.2's `hot→cold` file migration; the cron keeps only `pg_dump` and the
  materialized-view refresh
- The 1 GB Supabase Storage free-tier ceiling — which was the **tightest
  constraint in the whole project**. At ~2,000 slips already on disk, image
  storage would have hit the ceiling long before the 500 MB database did.

**Gained:** one fewer vendor, one fewer failure mode in `sync.js`, no upload
latency per slip, and no retention policy to reason about.

**Lost:** cannot view a slip image from the phone. Viewing one means opening
the OneDrive folder on the laptop, using `raw_inputs.file_path`. Reversing this
decision later means re-running `migrations/004`, re-adding the column, and
writing an upload step — perhaps half a day, and only for slips arriving after
the reversal. Slips processed in the meantime would have no cloud copy.

**Unaffected:** the review queue. It shows extracted values for correction, not
the source image.

## The catch this nearly caused

R2 was carrying **two** unrelated jobs: cold slip images, and the nightly
`pg_dump` database backup (PLAN.md "Backup risk"). Dropping image storage would
have silently dropped the backup destination with it — losing the database
backup, which after this ADR is the *only* copy of the transaction history and
the OCR responses.

**The backup requirement survives this ADR unchanged and gets more important,
not less.**

**Proposal for Phase 4 (not yet decided):** write `pg_dump` output into a folder
inside OneDrive. It then syncs and is retained by Microsoft automatically, using
storage the user already pays for, keeping Cloudflare out of the project
entirely and making the backup story consistent with the image story — the
laptop plus OneDrive is the durable layer, Supabase is the queryable layer.
Chunk 4.2 finalizes this.
