-- 2026-11-10 — Invoice language (English / Français).
--
--   language — 'en' | 'fr'. Decides the wording/date/currency format of the
--              client-facing PDF, public link and email. Existing rows = 'en'.
--
-- GRANTS: adds a COLUMN to an existing table, not a new table, so no new Data
-- API GRANT statements are needed (table-level grants + RLS already cover it).
--
-- RUN THIS BEFORE deploying the app version that writes `language`.
-- Requires 20261110180000_add_brand_and_client_company.sql to have been run first.

alter table public.invoices
  add column if not exists language text not null default 'en';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_language_check') then
    alter table public.invoices
      add constraint invoices_language_check check (language in ('en', 'fr'));
  end if;
end $$;

-- `language` is appended at the END of the view (CREATE OR REPLACE VIEW rule).
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
    client_company,
    language
   from invoices;

revoke all on table public.invoice_public_v from anon, authenticated, public;
grant all on table public.invoice_public_v to service_role;

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
