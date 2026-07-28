-- 001_schema.sql
-- Chunk 1.1 — core tables for the finance app.
-- Run this FIRST in Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- One row per bank account/app (7 rows expected: K PLUS, MAKE by KBank,
-- SCB EASY, Bualuang mBanking, Krungthai NEXT, PaoTang, Dime!)
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  bank_name        text not null,
  account_name     text not null,
  account_type     text not null,
  current_balance  numeric(14,2) not null default 0,
  created_at       timestamptz not null default now()
);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  parent_id   uuid references categories(id),
  icon        text,
  color       text,
  created_at  timestamptz not null default now()
);

create table merchants (
  id              uuid primary key default gen_random_uuid(),
  canonical_name  text not null,
  category_id     uuid references categories(id),
  created_by      text not null default 'csv-bootstrap',
  created_at      timestamptz not null default now()
);

create table merchant_aliases (
  alias        text primary key,
  merchant_id  uuid not null references merchants(id) on delete cascade
);

-- One row per source file: a bank slip, a LINE screenshot, or a Money
-- Manager CSV row. The OCR response is kept forever even after the
-- original image is aged out (see docs/PLAN.md Data Lifecycle).
create table raw_inputs (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null check (source in ('bank_slip', 'line_screenshot', 'money_manager_csv')),
  storage_tier       text not null default 'hot' check (storage_tier in ('hot', 'cold', 'deleted')),
  file_path          text not null,
  file_hash          text not null unique,
  extractor_version  text not null,
  ocr_response       jsonb,
  ingested_at        timestamptz not null default now(),
  archived_at        timestamptz
);

create table transactions (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  amount             numeric(14,2) not null,
  currency           text not null default 'THB',
  direction          text not null check (direction in ('income', 'expense', 'transfer')),
  merchant_id        uuid references merchants(id),
  account_id         uuid not null references accounts(id),
  reference_no       text,
  notes              text,
  extractor_version  text not null,
  created_at         timestamptz not null default now()
);

-- Links one transaction to every raw input it was built from (usually 1,
-- but a re-extraction or a merged duplicate can have more).
create table transaction_evidence (
  transaction_id  uuid not null references transactions(id) on delete cascade,
  raw_input_id    uuid not null references raw_inputs(id) on delete cascade,
  primary key (transaction_id, raw_input_id)
);

create table budgets (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references categories(id),
  monthly_limit  numeric(14,2) not null,
  year           int not null,
  month          int not null check (month between 1 and 12),
  unique (category_id, year, month)
);

create index idx_transactions_date        on transactions(date);
create index idx_transactions_account     on transactions(account_id);
create index idx_transactions_merchant    on transactions(merchant_id);
create index idx_merchant_aliases_merch   on merchant_aliases(merchant_id);
create index idx_raw_inputs_source        on raw_inputs(source);
create index idx_transaction_evidence_raw on transaction_evidence(raw_input_id);
