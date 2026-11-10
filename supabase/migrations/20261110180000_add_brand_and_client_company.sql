-- 2026-11-10 — Business invoicing: brand + client company.
--
-- Both brands (Seniors, Business) are billed under the AIWithRobert master corp
-- and share this table. `brand` says which sub-brand an invoice belongs to; it
-- drives the logo/colours on the document and which invoice-number sequence is
-- used (seniors AWR-YYYYMM-001, business AWR-B-YYYYMM-001).
--
--   brand          — 'seniors' | 'business'. Every existing row becomes 'seniors'
--                    (the default), which is what they all are.
--   client_company — optional "Bill To" company name (used by Business invoices).
--
-- GRANTS: this migration adds COLUMNS to an existing table, not a new table, so no
-- new Data API GRANT statements are needed — the table-level grants and the RLS
-- policy already on public.invoices cover new columns automatically. (Any future
-- NEW table must include explicit grants in its own migration.)
--
-- RUN THIS BEFORE deploying the app version that writes these columns.

alter table public.invoices
  add column if not exists brand text not null default 'seniors',
  add column if not exists client_company text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_brand_check'
  ) then
    alter table public.invoices
      add constraint invoices_brand_check check (brand in ('seniors', 'business'));
  end if;
end $$;

create index if not exists idx_invoices_brand on public.invoices using btree (brand);

-- Client-facing view: brand and client_company are appended at the END of the
-- column list (CREATE OR REPLACE VIEW only allows adding columns at the end).
-- Still excludes view_token, email_log, emailed_at, view_count, first_viewed_at,
-- pdf_download_count and updated_at.
create or replace view public.invoice_public_v
with (security_invoker = on) as
 select id,
    invoice_number,
    client_name,
    client_email,
    address_line1,
    address_line2,
    address_city,
    address_postal,
    province,
    service_date,
    created_at,
    services,
    subtotal,
    discount_type,
    discount_value,
    discount_amount,
    gst_enabled,
    gst_amount,
    total,
    notes,
    status,
    brand,
    client_company
   from invoices;

revoke all on table public.invoice_public_v from anon, authenticated, public;
grant all on table public.invoice_public_v to service_role;

-- Re-create the token lookup so its row type picks up the two new view columns.
-- Same body, same security settings as before.
create or replace function public.invoice_by_token(token text)
 returns setof invoice_public_v
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select v.*
  from public.invoice_public_v v
  where v.id in (
    select i.id from public.invoices i where i.view_token::text = token
  );
$function$;

revoke all on function public.invoice_by_token(text) from public;
grant execute on function public.invoice_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
