-- 005_drop_storage.sql
-- Reverses 004. See docs/adr/002-drop-supabase-storage.md.
--
-- Slip images are never uploaded anywhere — they stay in OneDrive, where the
-- phone already puts them. Supabase holds numbers only. `raw_inputs.file_path`
-- points at the original on disk; `raw_inputs.ocr_response` keeps the model's
-- reading forever. Neither ever needed the cloud copy.
--
-- Safe to run: verified 0 rows in all 8 tables and 0 objects in the bucket
-- before executing on 2026-08-23.
--
-- To reverse: re-run 004, then re-add the column (default 'hot').

-- The bucket's access policies. Dropping the bucket does not remove these.
drop policy if exists "user_read_storage"     on storage.objects;
drop policy if exists "service_write_storage" on storage.objects;
drop policy if exists "service_update_storage" on storage.objects;
drop policy if exists "service_delete_storage" on storage.objects;

-- The bucket itself CANNOT be dropped from SQL. Supabase rejects it with
-- "Direct deletion from storage tables is not allowed. Use the Storage API
-- instead." Deleted on 2026-08-23 via the Storage API, after confirming it
-- held 0 objects:
--
--   DELETE {SUPABASE_URL}/storage/v1/bucket/slips
--   Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
--
-- Or, by hand: Supabase dashboard → Storage → slips → ⋮ → Delete bucket.
-- Verified afterward: zero buckets remain.

-- hot/cold/deleted only meant something when there were storage tiers to move
-- between. There is now exactly one place a slip lives.
alter table raw_inputs drop column if exists storage_tier;
