# Common edits — recipes (invoices.aiwithrobert.com)

Deploy = merge/push to `main` (`.github/workflows/deploy.yml`). Reload the app on the phone after a deploy (a cached phone keeps
the old code). Weekly safety net: the "Checks" workflow runs `scripts/check_money.mjs` (tax and numbering rules) and
`scripts/check_prices.py` (Business prices equal the website); a red run means something drifted. Run either by hand from
GitHub > Actions > Checks > Run workflow.

## Change a Business price
1. Change the website first (see the Business repo `docs/common-edits.md`: Pricing section, llms.txt, FAQ, `ba-math-text`).
2. Here: `src/lib/services.js`, `BUSINESS_SERVICES`, the `rate:` of that line (and its `name`/`description` if the wording changed).
3. The toolkit's `FX_PRICE` (repo aiwithrobert-toolkit, `index.html`) must also match.
4. Run Checks; it must be green.

## Change a Seniors price
`src/lib/services.js`, `SERVICES` (rates $60 online, $65 in-home, $275 Starter, $500 Complete, $35 per person). Also change the Seniors site
(see that repo's `docs/common-edits.md`) so both agree. Invoices already created keep their saved line items.

## Add a service to the quick-add list
Copy one block in `SERVICES` (Seniors) or `BUSINESS_SERVICES` (Business): unique `id`, `name`, `description`, `rate`, `unit` (`flat|hour|person|month`), `unitLabel`.
Rate x Quantity is the line total; each line stays editable on the invoice.

## Reword anything the client sees (PDF, public page, email)
`src/lib/i18n.js`: change the EN and FR strings together. The in-app admin screens stay English.

## Change brand colours, logo or tagline
`src/lib/brands.js` (logos in `public/logos/`). Email header banners are images (Gmail dark mode inverts HTML): re-run `scripts/build_email_banners.py`
(needs a computer with Python and Pillow; if you cannot, leave the banners as they are).

## Tax rates or invoice numbers
`src/lib/invoiceUtils.js`: `getProvinceTaxRate` (QC 14.975 = GST 5 + QST 9.975, ON 13, Atlantic 15, others 5), `generateInvoiceNumber`
(Seniors `AWR-YYYYMM-001`, Business `AWR-B-YYYYMM-001`). After any change run `node scripts/check_money.mjs`.

## Email sending
`src/lib/emailService.js` (EmailJS; the template Subject must stay `{{subject}}`). Quota is 200 per cycle, resets on the 10th; the log is
`src/lib/emailLog.js` + table `email_send_log`.

## A new database field or table
Migration file in `supabase/migrations/` WITH the Data API grants (copy `20261110210000_add_email_send_log.sql`), run it by hand in the Supabase
SQL editor BEFORE deploying, then update `supabase/schema.sql`. For a new invoice field also: `InvoiceForm.jsx`, the three renderers
(`pdfGenerator.js`, `InvoicePublic.jsx`, `InvoiceView.jsx`) and `invoice_public_v` if the client page needs it.

## Import a lead into an invoice
`src/components/LeadImport.jsx` and `importLead()` in `InvoiceForm.jsx` read the websites' `site_inquiries` and `waitlist_requests` tables (owned by the toolkit repo).

## Monthly (5 minutes)
See `RUNBOOK.md`: export a CSV backup, check the EmailJS quota card, confirm Keep-Alive is green.

## Usual services pre-fill (new invoice)
Picking a client (or a Business company) in the new-invoice form fills the service lines from that client's last 5 invoices of the same brand: only services that
appear on EVERY one of them, with their most common quantity, people and rate (a tie goes to the newest). It only runs on a new invoice whose lines are still empty, so
it never overwrites anything typed, and every line stays editable. Logic: `src/lib/usualServices.js` (tested by `scripts/check_usual_services.mjs`, run by Checks);
wiring: `prefillUsualServices()` in `InvoiceForm.jsx`. To change how many invoices count, edit `USUAL_LOOKBACK`.

## "Import a lead" list (new invoice)
`src/components/LeadImport.jsx` lists website inquiries and waitlist sign-ups, filtered against the toolkit's own leads (table `toolkit_sessions`, matched by the email in the
lead's contact): a lead deleted or archived in the toolkit is not offered; a row the toolkit has not turned into a lead yet (status new) still is. If the toolkit table cannot
be read, the list falls back to everything not archived.

### Lead to invoice handoff
The toolkit's Won lead card has "Create invoice" (`#/invoice/new?brand=..&lead_name=..&lead_email=..&lead_org=..&lead_lang=..`). `applyLeadParams()` in `InvoiceForm.jsx` reads those (run once, after the client list loads):
a returning client (same email) gets saved address and usual services; a new one gets the name, email, company and language, and a suggested service line from their latest `site_inquiries` row (`suggestServiceIds`).
Change the parameter names in both repos together (toolkit `invoiceUrl()` in index.html).

## Add the GST/QST registration numbers (when you get them)
1. Open `src/lib/taxNumbers.js` and type them between the quotes of `TAX_NUMBERS`: `gst: '123456789 RT0001'` (CRA, 9 digits + RT0001) and `qst: '1234567890 TQ0001'` (Revenu Quebec, 10 digits + TQ0001). Leave one blank if you only have the other.
2. Commit to `main`. That is all: filled numbers print by themselves in the PDF footer, on the client invoice page and in the invoice email footer (EN: "GST/HST no.", "QST no."; FR: "N° TPS/TVH", "N° TVQ"). Blank = nothing printed.
3. `node scripts/check_due_and_export.mjs` (also run weekly by Checks) fails if a number has the wrong shape.
4. Already-sent invoices do not change in the inbox, but their PDF and client link show the numbers the next time they are opened (the numbers are not stored on the invoice). Only invoice dates after you were registered should show them: if you register mid-year, tell Claude and it will add a "show from date".
Wording of the labels: `LABELS` in the same file. Where they print: `_drawFooter` in `pdfGenerator.js`, `InvoicePublic.jsx` footer, `emailService.js` footer.

## Due dates, overdue and reminders
- `invoices.due_date` (date, optional) and `invoices.reminded_at`; migration `supabase/migrations/20261127120000_add_due_date_and_reminders.sql` (run by hand first, then deploy).
- New invoices default to Net 15 (`DEFAULT_TERMS_DAYS` in `src/lib/invoiceUtils.js`); the form has a terms picker (`PAYMENT_TERMS`) and an editable date. Old invoices have no due date and never show as overdue.
- Overdue = status Sent + due date before today (Eastern): `daysOverdue()` / `isOverdue()`. Dashboard: red banner, "Overdue" status filter, red tag on the card. Invoice page: "Send reminder" button (sent invoices only) uses `sendInvoiceEmail(invoice, { reminder: true })`, wording keys `reminder*` and `amountOverdue` in `src/lib/i18n.js` (EN + FR), counts toward the EmailJS quota.
- The due date prints on the PDF, client page and email only while the invoice is unpaid.

## Accountant export
Tax Summary screen: choose year, period (full year or a quarter, by service date) and what to include, then "Accountant CSV". Logic: `src/lib/accountantExport.js` (summary per brand + both brands, then one row per invoice with GST, HST and QST split; opens in Excel with accents). Tax split per invoice: `getTaxBreakdown()` in `invoiceUtils.js` (shared with the on-screen Tax Summary). Tested by `scripts/check_due_and_export.mjs`.
