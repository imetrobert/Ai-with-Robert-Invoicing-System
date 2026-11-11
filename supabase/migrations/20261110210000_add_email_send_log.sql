-- 2026-11-10 — Permanent email send log (EmailJS quota tracker).
--
-- One row per email actually sent. Unlike invoices.email_log, rows here survive
-- deleting the invoice, so the dashboard's "EmailJS quota this cycle" stays
-- accurate. invoice_number is plain text (no foreign key) on purpose.
--
-- GRANTS: new table, so the explicit Data API grants are included below
-- (Supabase no longer auto-grants new public tables). RLS requires an
-- authenticated session; anon gets nothing.
--
-- Safe to run BEFORE or AFTER deploying the app: the app ignores a missing table.

create table if not exists public.email_send_log (
  id             bigint generated always as identity primary key,
  sent_at        timestamptz not null default now(),
  invoice_number text,
  brand          text,
  recipient      text
);

create index if not exists email_send_log_sent_at_idx on public.email_send_log (sent_at);

alter table public.email_send_log enable row level security;

grant select, insert on table public.email_send_log to authenticated;
grant all on table public.email_send_log to service_role;
grant usage, select on sequence public.email_send_log_id_seq to authenticated;
grant all on sequence public.email_send_log_id_seq to service_role;

drop policy if exists "Authenticated users only" on public.email_send_log;
create policy "Authenticated users only" on public.email_send_log
  as permissive
  for all
  to authenticated
  using (auth.role() = 'authenticated'::text)
  with check (auth.role() = 'authenticated'::text);
