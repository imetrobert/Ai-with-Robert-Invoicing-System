# Security notes

Scope: this app and the `public.invoices` table in Supabase project
`ipnajvgwtjrlecbqfwrh`. That project is shared with other apps; policy work on
`etf_*`, `job_*` and `survey_responses` is tracked elsewhere and is deliberately
not covered here.

## How the public invoice viewer reads data

Clients open their invoice from a tokenized link without logging in:

```
https://invoices.aiwithrobert.com/#/invoice/public/<view_token>
```

The page calls a database function with the token as an **argument**:

```js
supabase.rpc('invoice_by_token', { token: String(token) })
```

It does **not** query the `invoices` table with a `view_token` filter. That
distinction is the whole security model, so it is worth stating plainly:

> Row Level Security is evaluated per row and can only see the row. It cannot
> see the token in the URL or the filter attached to the request. A policy can
> therefore never verify that the caller supplied the right token — only that
> the row has one. Any scoping expressed as a request filter is scoping the
> caller controls, and a caller can remove it.

The viewer previously did exactly that, guarded by a policy of
`(view_token IS NOT NULL)`, which was true for every invoice ever sent. An
unauthenticated request with no filter, holding only the publishable key,
returned every invoice along with its `view_token` — enough to build a working
link for any client. Fixed on 2026-08-03; see
`supabase/migrations/20260803120000_invoice_by_token_rpc.sql` for the reasoning
and the exact SQL.

Current shape:

- `public.invoice_by_token(token text)` — `security definer`, `stable`,
  `set search_path = public`. Executable by `anon` and `authenticated`.
- Returns `setof public.invoice_public_v`, a view that fixes the client-facing
  column list. `view_token`, `email_log`, `emailed_at` and the view/download
  counters are not in it.
- The view itself is revoked from `anon` and `authenticated`. It must stay that
  way — see open item 3.
- A malformed or empty token returns zero rows rather than raising, so the app's
  existing "Invoice Not Found" screen handles it.
- `invoices.view_token` is a `uuid` column. Inferred, not queried: the
  `increment_invoice_view(token uuid)` overload compares `view_token = token`
  with no cast, and PostgreSQL validates SQL function bodies at creation time,
  so that function could not exist if the column were `text`. Both
  `invoice_by_token` and the `text` overload cast on the column side and work
  either way.
- There is no anonymous SELECT policy on `public.invoices`. An unauthenticated
  request to `/rest/v1/invoices` returns `[]`.

The viewer's only other anonymous calls are `increment_invoice_view` and
`increment_invoice_pdf_download`, which already take the token as an argument
and are `security definer`. No other table is read with the publishable key:
client details are denormalized onto `invoices`, and the service catalogue is a
static constant in `src/lib/services.js`.

**If you add another public, unauthenticated read**, do it the same way — a
`security definer` function taking the secret as an argument, returning a view
that whitelists columns. Do not add a policy that inspects only the row.

## Resolved — 2026-08-03

### Duplicate `increment_invoice_view` overload (fixed)

`increment_invoice_view(token text)` and `increment_invoice_view(token uuid)`
both existed with the same parameter name. PostgREST resolves RPC arguments by
name, not type, so `rpc('increment_invoice_view', { token })` could not pick
between them and every call failed.

How it was confirmed, in order:

1. The catalog showed both overloads, both `security definer`.
2. `view_count` was `1` across the entire table, last set `2026-06-03 16:42:40`.
   Commit `09ce9e0` is dated `2026-06-03 16:45:49` — three minutes later. That
   commit changed the call from `{ token }` to `{ token: String(token) }`,
   commented "Explicitly cast token to string to match the text signature", and
   added `console.error` in the same change. `token` comes from `useParams()`
   and is already a string, so the cast was a no-op and the request body was
   byte-identical. Someone was debugging this exact failure, guessed at a type
   mismatch, and the guess could not have helped. The likeliest reading is that
   the `uuid` overload was created during that same session as an attempted fix,
   and creating it is what broke the call.
3. Opening a real invoice link changed nothing — a controlled repeat of the
   failure.
4. Calling both functions directly in SQL incremented the counters, proving the
   function bodies were fine. SQL resolves overloads by type; only the HTTP API
   cannot.
5. `has_function_privilege` confirmed `anon` could execute all of them, ruling
   out permissions.
6. `drop function public.increment_invoice_view(uuid)` plus a PostgREST schema
   reload, then tapping a link: `view_count` went `0 → 1`, and `0 → 2` on a
   second tap.

The `text` overload was kept because the app sends a JSON string, because its
`view_token::text = token` returns zero rows on a malformed token where the
`uuid` version would raise, and because it matches `invoice_by_token`.

Click counts before 2026-08-03 are not recoverable.

### PDF download counter never recorded (fixed in app code)

`pdf_download_count` was `0` on every invoice that had ever existed, and stayed
`0` through a controlled download test on iOS — even after the overload fix, and
even though `increment_invoice_pdf_download` has only one overload, is
`security definer`, is executable by `anon`, and increments correctly when called
directly in SQL.

Cause: `generateInvoicePDF` ends in `doc.save()` (`src/lib/pdfGenerator.js:256`).
On iOS that hands the file to Safari, which opens it and suspends the page,
killing the request that follows on the next line. The view counter was immune
because it fires during page load with nothing interrupting it.

Fixed by recording the download *before* generating the PDF. The trade is that a
started download is counted rather than a finished one; a PDF that fails to
generate now counts anyway. Not confirmed on desktop, where `doc.save()` does not
navigate away — the reorder is correct either way.

### Unique index on `invoices.view_token` (added)

The viewer takes `data[0]` rather than `.single()`, so two rows sharing a token
would silently render the wrong client's invoice. `invoices_view_token_key` now
prevents that. Built non-concurrently after `CREATE INDEX CONCURRENTLY` failed
inside the SQL editor's implicit transaction; the table is small enough that the
brief lock was irrelevant.

## Open items

Recorded deliberately, none actioned. Each is a separate decision.

### 1. Missing `SET search_path` on the `increment_invoice_*` functions

All three are `security definer` without a pinned `search_path`, and their bodies
reference `invoices` unqualified. Standard hardening for definer functions. Not
exploitable here — `anon` reaches the database only through PostgREST and cannot
execute the arbitrary SQL that shadowing an object would require — so this is
hygiene, not an incident.

`alter function ... set search_path = public, pg_temp` is sufficient; the setting
applies for the duration of the call whatever the caller's path is. Note
`pg_temp` explicitly **last**: if it is not listed, PostgreSQL searches the
temporary schema *first* for relations, which is the exact hijack the setting is
meant to prevent. `invoice_by_token` currently has `set search_path = public`
without `pg_temp` and would ideally get the same treatment — it is already immune
because its body schema-qualifies every reference, which is the belt to the
setting's braces.

### 2. Token rotation for pre-2026-08-03 invoices

Every invoice that existed before the fix had its `view_token` readable by anyone
holding the publishable key, for as long as the `(view_token IS NOT NULL)` policy
was in place. The key ships in the client bundle, so "anyone" means any visitor
who opened the app in a browser, plus anyone who read the deployed JavaScript.

Rotation would mean: `update public.invoices set view_token = gen_random_uuid()`
across the affected rows, which **invalidates every link already in a client's
inbox**. Those invoices then have to be re-sent from `InvoiceView.jsx`, one at a
time, each consuming EmailJS quota and each landing as a second email about an
invoice the client already received. Clients who kept the original link — or
bookmarked it, or forwarded it to a bookkeeper — get "Invoice Not Found" with no
explanation unless the re-send says so.

The counterfactual cost is unknown: whether anyone actually harvested tokens
while the policy was live cannot be determined after the fact, because PostgREST
request logs for that window would need checking and anonymous reads of a public
table are indistinguishable from ordinary viewer traffic in them.

Not decided. Business call, deliberately left open.

### 3. `invoice_public_v` depends on a revoke that nothing enforces

The view is exposed by PostgREST at `/rest/v1/invoice_public_v` and, like any
view, runs with its owner's rights — so it reads `invoices` without RLS applying.
The only thing keeping it closed is the explicit
`revoke all on table public.invoice_public_v from anon, authenticated, public`
in the migration. A later blanket `grant select on all tables in schema public
to anon`, or a tool that re-applies default privileges, would silently turn it
into a full read of every invoice minus the token.

On PostgreSQL 15+, `alter view public.invoice_public_v set (security_invoker =
on)` makes the view respect the caller's own RLS, which removes the dependency
on the revoke. `invoice_by_token` keeps working because it runs as its definer
owner. Worth confirming the server version before relying on it.

## Reporting

Security issues in this app: invoices@aiwithrobert.com.
