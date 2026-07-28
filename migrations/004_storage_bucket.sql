-- 004_storage_bucket.sql
-- Chunk 1.1 — the "slips" storage bucket for bank slip images/PDFs.
-- Private bucket: nobody can browse it publicly. Only a logged-in user
-- can read a file; only the server (service role) can upload/replace/delete.
-- Run this FOURTH, after 001-003.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slips',
  'slips',
  false,
  10485760, -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

create policy "user_read_storage" on storage.objects
  for select using (bucket_id = 'slips' and auth.uid() is not null);

create policy "service_write_storage" on storage.objects
  for insert with check (bucket_id = 'slips' and auth.role() = 'service_role');

create policy "service_update_storage" on storage.objects
  for update using (bucket_id = 'slips' and auth.role() = 'service_role');

create policy "service_delete_storage" on storage.objects
  for delete using (bucket_id = 'slips' and auth.role() = 'service_role');
