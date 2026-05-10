-- ============================================================
-- AI with Robert — Invoicing App
-- Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Create the invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number  TEXT NOT NULL UNIQUE,
  client_name     TEXT NOT NULL,
  client_email    TEXT,
  service_date    DATE NOT NULL,
  services        JSONB NOT NULL DEFAULT '[]',
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_type   TEXT DEFAULT 'none',    -- 'none' | 'percent' | 'fixed'
  discount_value  DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  gst_enabled     BOOLEAN DEFAULT false,
  gst_amount      DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT DEFAULT 'draft',   -- 'draft' | 'sent' | 'paid'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────
-- Only authenticated users (you!) can access any data
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users only"
  ON invoices
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Auto-update updated_at timestamp ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes for performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_created_at  ON invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON invoices (client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices (status);

-- ── Done! ─────────────────────────────────────────────────────
-- Your invoices table is ready.
-- The services JSONB column stores line items like:
-- [
--   {
--     "service_id": "online-session",
--     "service_name": "One-on-One Online Session",
--     "description": "...",
--     "quantity": 2,
--     "rate": 60.00
--   }
-- ]
