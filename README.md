# AI with Robert — Invoicing App

A private, secure invoicing web app for [AIWithRobert.com](https://aiwithrobert.com), built with React, Vite, Supabase, and deployed to GitHub Pages.

---

## ✅ Features

- 🔐 Secure login (Supabase Auth — only you can access)
- 📋 Create invoices with pre-loaded services from AIWithRobert.com
- 💸 CAD pricing with discount support (% or fixed $)
- 🧾 GST-ready toggle (off by default — enable when registered)
- 📄 Branded PDF invoice download — email-ready
- 📊 Invoice history with status tracking (Draft / Sent / Paid)
- 🗑️ Delete invoices with confirmation
- 📱 iOS-friendly mobile layout

---

## 🚀 Setup Guide

### Step 1 — Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name (e.g. `aiwithrobert-invoicing`) and a strong DB password
3. Create the schema — see **Database schema** below
4. Go to **Authentication → Users → Add User** → create your login email + password
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **publishable** key (formerly labelled **anon public**)

#### Database schema

Earlier revisions of this README told you to run a `supabase-setup.sql`. **That
file has never existed in this repo** — `git log --all --diff-filter=A` confirms
it was never committed. The `invoices` and `survey_responses` tables, their RLS
policies, and the `increment_invoice_*` functions were all created by hand in the
Supabase SQL editor, so there is currently **no baseline schema in version
control** and a new project cannot be built from this repo alone.

`supabase/migrations/` holds only changes made since 2026-08-03, which assume the
tables already exist. To capture the real baseline, dump it from the live project
and commit the result as the first migration:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public -f supabase/migrations/00000000000000_baseline.sql
```

Note that the project is shared with other apps, so a `public` dump includes
tables this app does not use (`etf_*`, `job_*`). Trim it, or dump only the tables
this app owns.

### Step 2 — Configure the Vite base path

Open `vite.config.js` and change `YOUR_REPO_NAME` to your actual GitHub repo name:

```js
base: '/your-repo-name/',
```

For example, if your repo is `github.com/robertsimon/invoicing`, use:
```js
base: '/invoicing/',
```

### Step 3 — Add GitHub Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

### Step 4 — Enable GitHub Pages

In your GitHub repo → **Settings → Pages**:
- Source: **GitHub Actions**

### Step 5 — Push to GitHub

```bash
# In the project folder
git init
git add .
git commit -m "Initial commit — AI with Robert Invoicing App"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

The GitHub Action will auto-build and deploy. Your app will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

### Step 6 — Local development (optional)

```bash
# Create .env.local with your Supabase credentials
cp .env.example .env.local
# Edit .env.local and fill in your values

npm install
npm run dev
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Login.jsx          # Auth screen
│   ├── Navbar.jsx         # Top navigation
│   ├── Dashboard.jsx      # Invoice list + stats
│   ├── InvoiceForm.jsx    # Create / edit invoice
│   ├── InvoiceView.jsx    # View + PDF download + delete
│   └── InvoicePublic.jsx  # Tokenized client view — see SECURITY.md
├── lib/
│   ├── supabase.js        # Supabase client
│   ├── services.js        # Pre-loaded services from your site
│   ├── invoiceUtils.js    # Number generation, calculations, formatting
│   └── pdfGenerator.js   # Branded PDF output using jsPDF
├── App.jsx                # Router + auth guard
├── main.jsx               # Entry point
└── index.css              # Global styles

supabase/
└── migrations/            # Schema changes since 2026-08-03 (no baseline — see above)

SECURITY.md                # Public viewer data access + open items
```

---

## 💡 Adding Future Features

- **GST registration**: Enable the toggle in the invoice form when you're registered. The GST number field can be added to the PDF footer in `pdfGenerator.js`.
- **Custom services**: Use the "Custom Service" option in the form.
- **Email integration**: Consider adding a Supabase Edge Function to auto-email PDFs.

---

## 🔒 Security Notes

See **[SECURITY.md](SECURITY.md)** for how the public invoice viewer reads data
and for the current open items.

- Row Level Security (RLS) is enabled on Supabase. Every table read by the
  logged-in app requires authentication.
- **The public invoice viewer is the one unauthenticated read**, and it does
  **not** query the `invoices` table with a `view_token` filter. It calls
  `invoice_by_token(token text)`, a `security definer` function that takes the
  token as an argument. RLS can only see the row, never the request's filter, so
  a policy cannot check that the caller supplied the right token — scoping
  expressed as a request filter is scoping the caller can simply remove. If you
  add another public read, follow the same pattern; the reasoning is in
  [SECURITY.md](SECURITY.md) and in
  `supabase/migrations/20260803120000_invoice_by_token_rpc.sql`.
- The public viewer returns a whitelisted column set. `view_token`, `email_log`,
  `emailed_at` and the view/download counters are never sent to the client.
- The app is not indexed by search engines (`<meta name="robots" content="noindex, nofollow" />`).
- Your Supabase credentials are stored as GitHub Secrets and never committed to the repo.
