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
  way — see open item 5.
- A malformed or empty token returns zero rows rather than raising, so the app's
  existing "Invoice Not Found" screen handles it.
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

## Open items

Recorded deliberately, none actioned. Each is a separate decision.

### 1. Duplicate `increment_invoice_view` overload

`increment_invoice_view(token text)` and `increment_invoice_view(token uuid)`
both exist with the same parameter name. PostgREST resolves RPC arguments by
name, so it cannot disambiguate the two. This is a plausible cause of the
inconsistent invoice-link click counts.

The cleanup is a single `drop function`, but which overload to drop depends on
what else calls them. Wanted as a deliberate change, not folded into other work.

### 2. Missing `SET search_path` on the `increment_invoice_*` functions

All three are `security definer` without a pinned `search_path`. Standard
hardening for definer functions. Not exploitable here — `anon` cannot create
objects to shadow anything on the path — so this is hygiene, not an incident.

### 3. Token rotation for pre-2026-08-03 invoices

Every invoice that existed before the fix had its `view_token` readable by
anyone holding the publishable key. Rotating tokens invalidates links clients
already hold, which means re-sending those invoices. Business decision, not yet
made.

### 4. No unique index on `invoices.view_token`

Deferred during the fix because it can fail on pre-existing duplicates and adds
a decision mid-migration. Still the right hardening: the viewer now takes
`data[0]` rather than `.single()`, so two rows sharing a token would silently
render the wrong client's invoice instead of erroring.

Check first, and delete nothing if it comes back non-empty — the fix is to
reissue a token on the newer row, which invalidates that client's link:

```sql
select view_token, count(*), array_agg(id)
from public.invoices where view_token is not null
group by view_token having count(*) > 1;
```

Then, as the only statement in the editor (`concurrently` cannot run inside a
transaction block, and the SQL editor wraps a multi-statement paste in one):

```sql
create unique index concurrently if not exists invoices_view_token_key
  on public.invoices (view_token);
```

### 5. `invoice_public_v` depends on a revoke that nothing enforces

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
