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
3. Once created, go to **SQL Editor** and paste the contents of `supabase-setup.sql` → **Run**
4. Go to **Authentication → Users → Add User** → create your login email + password
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public** key

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
│   └── InvoiceView.jsx    # View + PDF download + delete
├── lib/
│   ├── supabase.js        # Supabase client
│   ├── services.js        # Pre-loaded services from your site
│   ├── invoiceUtils.js    # Number generation, calculations, formatting
│   └── pdfGenerator.js   # Branded PDF output using jsPDF
├── App.jsx                # Router + auth guard
├── main.jsx               # Entry point
└── index.css              # Global styles
```

---

## 💡 Adding Future Features

- **GST registration**: Enable the toggle in the invoice form when you're registered. The GST number field can be added to the PDF footer in `pdfGenerator.js`.
- **Custom services**: Use the "Custom Service" option in the form.
- **Email integration**: Consider adding a Supabase Edge Function to auto-email PDFs.

---

## 🔒 Security Notes

- Row Level Security (RLS) is enabled on Supabase — only authenticated users can read/write data.
- The app is not indexed by search engines (`<meta name="robots" content="noindex, nofollow" />`).
- Your Supabase credentials are stored as GitHub Secrets and never committed to the repo.
