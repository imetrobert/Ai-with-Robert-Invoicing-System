# invoices.aiwithrobert.com — working guide

React 18 + Vite + Supabase + jsPDF + EmailJS. Static SPA on GitHub Pages
(`HashRouter`, `base: '/'`), used from an iPhone. Read this first; do not
re-explore the repo. For any change, open only the file(s) named below.

## Hard rules

- **Supabase tables belong to this repo.** Every new table or migration must
  include explicit Data API grants in the same file (`grant ... to authenticated`,
  `grant all ... to service_role`, plus sequence grants). Supabase no longer
  auto-grants new public tables. Copy the pattern from
  `supabase/migrations/20261110210000_add_email_send_log.sql`.
- **Migrations are run by hand** in the Supabase SQL editor *before* deploying
  the app. After adding one, also update `supabase/schema.sql` (it is a snapshot
  of the live database, kept current, not a history).
- Never hardcode keys. Build-time env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_EMAILJS_*` (GitHub Actions secrets). The Gemini key lives in the
  user's browser `localStorage`, never in the repo.
- Both brands (Seniors, Business) are billed under the AIWithRobert master corp.
  Invoice numbers: Seniors `AWR-YYYYMM-001`, Business `AWR-B-YYYYMM-001`.
- Client-facing documents (PDF, public page, email) support EN and Quebec FR;
  the in-app admin UI stays English.
- Deploy = merge to `main` (`.github/workflows/deploy.yml`). A phone with a
  cached old app keeps sending the old email layout until it reloads.

## Where things live (edit only what you need)

| Task | File |
|------|------|
| Brand colours, logo, tagline, number prefix | `src/lib/brands.js` (logos in `public/logos/`) |
| Client-facing wording EN/FR, fr-CA formatting | `src/lib/i18n.js` |
| Money, dates, GST/QST (5% / 9.975%), invoice numbering | `src/lib/invoiceUtils.js` |
| Service catalog and rates | `src/lib/services.js` (`BUSINESS_SERVICES` is empty on purpose) |
| PDF layout | `src/lib/pdfGenerator.js` |
| Email sending (EmailJS; template Subject is `{{subject}}`) | `src/lib/emailService.js` |
| EmailJS quota log (200 per cycle, resets on the 10th) | `src/lib/emailLog.js` + table `email_send_log` |
| Email header banners (images, because Gmail dark mode inverts HTML) | `scripts/build_email_banners.py` (Pillow) writes `public/logos/email-<brand>-<lang>.png`; re-run if colours, logos or wording change |
| Gemini survey extraction (2.5 Flash, one call for front+back) | `src/lib/surveyExtractor.js` |
| Supabase client | `src/lib/supabase.js` |

## Components (line counts are large; grep the function, do not read whole files)

| File | Lines | What | Find with |
|------|-------|------|-----------|
| `src/App.jsx` | ~60 | Router + auth gate. Routes: `/login`, `/`, `/invoice/new`, `/invoice/:id`, `/invoice/:id/edit`, `/invoice/public/:token`, `/surveys`, `/surveys/upload`, `/tax-summary` | `grep -n "Route " src/App.jsx` |
| `Dashboard.jsx` | ~700 | Invoice list, All/Seniors/Business toggle, filters, CSV export, EmailJS quota card | `grep -n "^function\|^  async function\|^  function" ...` |
| `InvoiceForm.jsx` | ~690 | Create/edit: brand + language selectors, line items, discounts, autocomplete | same |
| `InvoiceView.jsx` | ~400 | Internal single-invoice view (send, mark paid, PDF) | |
| `InvoicePublic.jsx` | | Client link, no login (uses RPC `invoice_by_token`) | |
| `SurveyUpload.jsx` | ~600 | Photo of a paper survey to Gemini to review form to save | stages: `upload / staged / extracting / review / saving` |
| `SurveyDashboard.jsx` | | Results by topic | |
| `TaxSummary.jsx` | ~415 | GST/QST report; combines both brands | `getTaxBreakdown` |
| `Login.jsx`, `Navbar.jsx` | small | Auth screen; nav (title hidden under 480px) | |
| `src/index.css` | | All styles (`.navbar-*` etc.) | grep the class |

## Database (see `supabase/schema.sql`)

`invoices` (has `brand`, `client_company`, `language`, `view_token`, `email_log`),
view `invoice_public_v`, RPCs `invoice_by_token`, `increment_invoice_view`,
`increment_invoice_pdf_download`, and `email_send_log` (survives invoice deletion).
RLS: authenticated users only; anon reaches data only through the RPC/view.

## Cheap-edit habits

- Wording change on a client document: `src/lib/i18n.js` only (EN + FR together).
- Colour/logo change: `src/lib/brands.js`, then re-run `scripts/build_email_banners.py`.
- New field on invoices: migration (with grants) + `supabase/schema.sql` +
  `invoice_public_v` if the client page needs it + `InvoiceForm.jsx` + the three
  document renderers (PDF, `InvoicePublic.jsx`, `InvoiceView.jsx`).
- Keep-alive: `.github/workflows/keep-alive.yml` pings Supabase daily so the free
  tier does not pause. Leave it enabled.
- `README.md` is setup documentation for a fresh install; it is not needed for
  routine changes.
