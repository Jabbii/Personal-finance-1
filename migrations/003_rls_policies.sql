-- 003_rls_policies.sql
-- Chunk 1.1 — Row Level Security. This locks every table so that only
-- the server (using the service role key) can write. A logged-in user
-- can read. Anyone else — including someone who finds the public anon
-- key — is blocked outright.
-- Run this THIRD, after 001_schema.sql and 002_dashboard_view.sql.

alter table accounts             enable row level security;
alter table categories           enable row level security;
alter table merchants            enable row level security;
alter table merchant_aliases     enable row level security;
alter table raw_inputs           enable row level security;
alter table transactions         enable row level security;
alter table transaction_evidence enable row level security;
alter table budgets              enable row level security;

create policy "service_role_all" on accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on accounts
  for select using (auth.uid() is not null);

create policy "service_role_all" on categories
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on categories
  for select using (auth.uid() is not null);

create policy "service_role_all" on merchants
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on merchants
  for select using (auth.uid() is not null);

create policy "service_role_all" on merchant_aliases
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on merchant_aliases
  for select using (auth.uid() is not null);

create policy "service_role_all" on raw_inputs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on raw_inputs
  for select using (auth.uid() is not null);

create policy "service_role_all" on transactions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on transactions
  for select using (auth.uid() is not null);

create policy "service_role_all" on transaction_evidence
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on transaction_evidence
  for select using (auth.uid() is not null);

create policy "service_role_all" on budgets
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "user_read" on budgets
  for select using (auth.uid() is not null);
