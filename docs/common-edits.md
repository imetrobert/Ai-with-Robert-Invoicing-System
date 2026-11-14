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
