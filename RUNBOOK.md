# Runbook: keeping the invoicing app running with minimal effort (iPhone-friendly)

## Monthly (5 minutes)
1. **Back up your invoices.** Open the app > Dashboard > Export CSV (all invoices, no filters). Save the file to iCloud Drive/Files. Supabase's free tier keeps no long-term backups, so this is your safety copy.
2. Check the EmailJS quota card on the Dashboard (200 emails per cycle, resets on the 10th).
3. Confirm the "Supabase Keep-Alive" workflow is green (GitHub > Actions). It stops the free database from pausing after a week of inactivity.

## If something breaks
| Symptom | Do this |
|---|---|
| Site shows an old version | Close the app fully and reopen; a cached phone keeps the old code and old email layout. |
| Deploy failed | GitHub > Actions > Deploy to GitHub Pages > read the red step. Re-run once. |
| Can't log in / data won't load | Supabase may be paused: open the project at supabase.com and press Restore. |
| Emails stop sending | EmailJS quota used up or key changed. Check the quota card and the EmailJS dashboard. |
| The weekly "Checks" run is red | Read its red step: a price differs from the website, or a tax/numbering rule changed. Fix it using `docs/common-edits.md`. |

## Changing things
Step-by-step recipes for the usual edits (prices, wording, services, tax, database) are in `docs/common-edits.md`.
- Wording on invoices: `src/lib/i18n.js` (EN and FR together).
- Brand colours or logos: `src/lib/brands.js`, then re-run `scripts/build_email_banners.py` (needs a computer; otherwise leave email banners as they are).
- Any change to the database: add a migration file with the Data API grants (copy `supabase/migrations/20261110210000_add_email_send_log.sql`), run it in the Supabase SQL editor BEFORE deploying, and update `supabase/schema.sql`.
- Paste only the one file or function you are changing into a free chat AI, never the whole repo. `CLAUDE.md` lists which file does what.
