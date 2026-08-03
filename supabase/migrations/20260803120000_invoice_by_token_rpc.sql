-- 2026-08-03 — Close anonymous read access to public.invoices.
--
-- Applied to project ipnajvgwtjrlecbqfwrh. This file is the record of SQL that
-- was run by hand in the Supabase SQL editor; it is transcribed here verbatim so
-- the deployed state is reproducible. See ../README.md for the caveat about the
-- missing baseline schema.
--
-- THE PROBLEM
--
-- The public invoice viewer let clients open a tokenized link without logging
-- in. The policy enabling that was:
--
--   tablename: invoices | cmd: SELECT | applies to: {anon}
--   using: (view_token IS NOT NULL)
--
-- RLS is evaluated per row and can only see the row. It cannot see the token in
-- the URL or the filter in the request, so that predicate only asked "does this
-- row have a token at all" — true for every invoice ever sent. The actual
-- scoping lived in the page's own query filter (view_token=eq.<token>), and a
-- filter the caller supplies is a filter the caller can remove.
--
-- Confirmed empirically before the fix: an unauthenticated request with no
-- filter, holding only the publishable key, returned every invoice row
-- including its view_token, which is enough to construct a valid link for any
-- client.
--
--   curl -s "https://<project>.supabase.co/rest/v1/invoices?select=id,view_token&apikey=<publishable key>"
--
-- THE FIX
--
-- A token that arrives as a query filter is invisible to the database, so the
-- token becomes a function argument instead. Section 1 adds the function;
-- section 2 removes the policy that is no longer needed.
--
-- ORDERING (mattered at the time, does not matter on a fresh replay)
--
-- Section 1 is additive and was run first. The application change that calls
-- invoice_by_token (commit a04b28e, merged in #3) was deployed next, and a real
-- client link was clicked to confirm it still worked. Only then was section 2
-- run. Dropping the policy before the app change would have broken every link
-- clients were holding at that moment.

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 1 — token lookup as a function argument
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.invoice_by_token(text);

-- The view fixes the client-facing column list in one place. Returning
-- `setof` this view means the function's declared shape and its projection are
-- the same object and cannot drift apart — a hand-written `returns table (...)`
-- signature paired with a hand-written select list can silently transpose two
-- same-typed columns (client_name / client_email) and render wrong without
-- raising anything.
--
-- The select list is the whitelist: anything not named below is excluded. The
-- notable exclusions, all internal:
--   view_token          the client already holds it; no reason to echo it back
--   email_log           array of every send timestamp — internal chasing history
--   emailed_at          same
--   view_count          tracking the client is not told about
--   first_viewed_at     same
--   pdf_download_count  same
create or replace view public.invoice_public_v as
select id, invoice_number, client_name, client_email,
       address_line1, address_line2, address_city, address_postal,
       province, service_date, created_at, services,
       subtotal, discount_type, discount_value, discount_amount,
       gst_enabled, gst_amount, total, notes, status
from public.invoices;

-- Supabase grants SELECT on new objects in `public` to anon/authenticated by
-- default privilege. This view must NOT inherit that: PostgREST would expose it
-- at /rest/v1/invoice_public_v, and a view runs with its owner's rights, so it
-- would bypass RLS on invoices and re-open the hole this migration closes
-- (minus the token). The function below reaches the view as its definer owner,
-- so revoking direct access costs nothing.
revoke all on table public.invoice_public_v from anon, authenticated, public;

-- security definer: the caller is anon and, after section 2, anon has no policy
--   on public.invoices at all. The function is the only door.
-- stable: no writes, and lets the planner cache within a statement.
-- set search_path: pins resolution so the definer context cannot be redirected
--   through a schema earlier on the caller's path.
create function public.invoice_by_token(token text)
returns setof public.invoice_public_v
language sql
security definer
stable
set search_path = public
as $$
  select v.*
  from public.invoice_public_v v
  where v.id in (
    select i.id from public.invoices i where i.view_token::text = token
  );
$$;

-- The cast is on the column side on purpose. `token::uuid` would raise
-- "invalid input syntax for type uuid" on a malformed token, which reaches the
-- browser as a PostgREST error instead of the app's "Invoice Not Found" screen.
-- Casting view_token to text instead means a malformed or empty token simply
-- matches nothing: zero rows, no exception. Verified — see section 3.

revoke all on function public.invoice_by_token(text) from public;
grant execute on function public.invoice_by_token(text) to anon, authenticated;

-- PostgREST caches the schema. Without this it can 404 the new function for
-- several minutes, which reads like a broken deploy.
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 2 — drop the anonymous SELECT policy
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Written as a loop rather than a named `drop policy` because the policy name
-- was not recorded at the time. On a fresh database the loop matches nothing and
-- is a no-op, so this is safe to replay.
--
-- The three increment_invoice_* functions also run as anon and write to
-- public.invoices. All were confirmed SECURITY DEFINER before this ran, so they
-- bypass RLS and are unaffected by the drop. There is no anonymous write policy
-- on the table, so had any of them been SECURITY INVOKER it would already have
-- been silently updating zero rows.

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and cmd = 'SELECT' and 'anon' = any(roles)
  loop
    execute format('drop policy %I on public.invoices', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 3 — verification (not run by migration; paste into the SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Results recorded on 2026-08-03: 1, 0, 0, 0, true. The two malformed-token
-- cases are the ones that catch a `token::uuid` implementation — against that
-- version they abort instead of returning zero.
--
--   select count(*) as should_be_1 from public.invoice_by_token(
--     (select view_token::text from public.invoices
--      where view_token is not null order by created_at desc limit 1));
--
--   select count(*) as should_be_0
--   from public.invoice_by_token('00000000-0000-4000-8000-000000000000');
--
--   select count(*) as should_be_0_not_an_error
--   from public.invoice_by_token('not-a-uuid');
--
--   select count(*) as should_be_0_not_an_error
--   from public.invoice_by_token('');
--
--   select has_function_privilege('anon','public.invoice_by_token(text)','execute')
--     as should_be_true;
--
-- And the original curl, which returned [] afterwards while real client links
-- kept working.
