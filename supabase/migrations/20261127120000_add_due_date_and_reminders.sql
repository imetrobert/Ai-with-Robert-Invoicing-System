-- 2026-11-27: payment terms and reminders.
--   due_date    = the date payment is due (null = no due date; old invoices stay null and never show as overdue)
--   reminded_at = when the last payment reminder email was sent
-- No new table here, so no new grants are needed: the existing table grants and the
-- "Authenticated users only" policy already cover new columns. The public view is
-- recreated to expose due_date to the client page (same revoke/grant as before).
-- Run this by hand in the Supabase SQL editor BEFORE deploying the app.

alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists reminded_at timestamp with time zone;

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
    language,
    due_date
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
