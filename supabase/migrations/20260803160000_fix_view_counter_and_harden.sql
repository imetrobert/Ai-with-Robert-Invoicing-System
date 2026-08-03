-- 2026-08-03 (later the same day) — Fix the broken click counter and harden the
-- remaining SECURITY DEFINER functions.
--
-- Applied to project ipnajvgwtjrlecbqfwrh by hand in the Supabase SQL editor and
-- transcribed here. None of this is a security fix; the anonymous read hole was
-- closed in 20260803120000. These are correctness and hygiene.
--
-- NOTE ON REPLAY: the increment_invoice_* functions were created by hand and
-- have never been in version control, so the statements below assume they exist.
-- See ../../README.md — this repo has no baseline schema.

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 1 — remove the duplicate overload that broke click counting
-- ─────────────────────────────────────────────────────────────────────────────
--
-- public.increment_invoice_view existed twice, as (token text) and (token uuid),
-- with the same parameter name in both. PostgREST resolves RPC arguments by
-- name, not type, so rpc('increment_invoice_view', { token }) could not choose
-- between them and every call from the invoice page failed. Plain SQL was
-- unaffected, because SQL resolves overloads by type — which is why the bug
-- survived so long and why calling the function directly always appeared to
-- work.
--
-- Evidence, and how far it had spread: view_count was 1 across the entire table,
-- last set 2026-06-03 16:42:40. Commit 09ce9e0 is dated 16:45:49 the same day —
-- three minutes later — and changed the call to String(token) to "match the text
-- signature", which was a no-op because the value was already a string. The uuid
-- overload was most likely created during that same debugging session as an
-- attempted fix, and creating it is what broke the call. Counting had been dead
-- for two months.
--
-- The text overload is the one kept: the app sends a JSON string, its
-- view_token::text = token returns zero rows on a malformed token where the uuid
-- version would raise, and it matches invoice_by_token's convention.
--
-- Verified after: tapping a real invoice link moved view_count 0 -> 1, and 1 -> 2
-- on a second tap. Counts recorded before this ran are not recoverable.

drop function if exists public.increment_invoice_view(uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 2 — unique index on view_token
-- ─────────────────────────────────────────────────────────────────────────────
--
-- InvoicePublic.jsx takes data[0] rather than .single(), so two rows sharing a
-- token would silently render one client's invoice to another instead of
-- erroring. Checked for duplicates first; there were none.
--
-- Built non-concurrently. CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block and the Supabase SQL editor wraps statements in one, so the
-- concurrent form failed. The table is small enough that the brief write lock
-- did not matter. NULL tokens on drafts are unaffected — a unique index permits
-- unlimited NULLs.

create unique index if not exists invoices_view_token_key
  on public.invoices (view_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 3 — pin search_path on every SECURITY DEFINER function
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The increment_invoice_* functions ran as definer with no pinned search_path
-- and unqualified references to `invoices`. Not exploitable — anon reaches the
-- database only through PostgREST and cannot execute the arbitrary SQL that
-- shadowing an object would need — so this is hygiene rather than an incident.
--
-- pg_temp is listed LAST on purpose. If it is not listed at all, PostgreSQL
-- searches the temporary schema FIRST for relation names, which is the exact
-- hijack the setting exists to prevent. invoice_by_token is included even though
-- its body schema-qualifies everything and it already had search_path = public;
-- consistency is cheap and the pg_temp position is the part that does the work.

alter function public.increment_invoice_view(text)         set search_path = public, pg_temp;
alter function public.increment_invoice_pdf_download(text) set search_path = public, pg_temp;
alter function public.invoice_by_token(text)               set search_path = public, pg_temp;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 4 — verification (not run by migration)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Recorded 2026-08-03: three rows, no uuid overload, every proconfig reading
-- search_path=public, pg_temp.
--
--   select p.oid::regprocedure as signature, p.proconfig
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('increment_invoice_view',
--                       'increment_invoice_pdf_download',
--                       'invoice_by_token')
--   order by 1;
--
-- The counter fix itself is only observable end to end: open a tokenized invoice
-- link and confirm view_count moves. Note that it counts page loads, not unique
-- visitors — a pull-to-refresh increments it again.
