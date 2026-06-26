-- ============================================================================
-- SEO + GOOGLE MERCHANT CENTER FIELDS  (reveil modifications v2 — Section A)
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS guards).
--
-- This migration is the ADDITIVE, non-breaking subset of the v2 Section A block.
-- See the two clearly-marked "REVIEW BEFORE RUNNING" sections at the bottom for
-- the parts that could conflict with this project's existing review system and
-- RLS setup — they are intentionally left commented out.
-- ============================================================================

-- ─── products: columns needed for SEO + Merchant Center ──────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Google Merchant Center (India) unit pricing — for liquid/weighted products.
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'ml';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_pricing_base_measure TEXT DEFAULT '100ml';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_weight NUMERIC DEFAULT 0.5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS google_product_category TEXT DEFAULT '2915';

-- Backfill existing NULLs so the new columns are populated. is_active defaults
-- to true above, but make sure any pre-existing NULL rows are flipped on so the
-- shop / sitemap / merchant sync don't silently drop them.
UPDATE products SET is_active = true WHERE is_active IS NULL;

-- ─── unique index on slug (created only if no duplicate slugs exist) ──────────
-- A plain UNIQUE constraint would fail if duplicates exist; this is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'products_slug_unique_idx'
  ) AND NOT EXISTS (
    SELECT slug FROM products WHERE slug IS NOT NULL AND slug <> '' GROUP BY slug HAVING count(*) > 1 LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX products_slug_unique_idx ON products (slug) WHERE slug IS NOT NULL;
  END IF;
END$$;

-- ─── auto-update updated_at on every product change ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ─── backfill slug from name where missing ───────────────────────────────────
UPDATE products
SET slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- ─── backfill SKU (max 40 chars, auto-generate from id if missing) ───────────
UPDATE products
SET sku = 'REVEIL-' || upper(substring(id::text, 1, 8))
WHERE sku IS NULL OR sku = '';

UPDATE products
SET sku = substring(sku, 1, 40)
WHERE length(sku) > 40;

-- ─── categories: slug + flags ────────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE categories SET is_active = true WHERE is_active IS NULL;

UPDATE categories
SET slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';


-- ============================================================================
-- REVIEW BEFORE RUNNING #1 — REVIEWS TABLE + RATING TRIGGER
-- ----------------------------------------------------------------------------
-- This project ALREADY has a `reviews` table with a different shape
-- (reviewer_name, heading, media_urls, role-based filtering) and the product
-- page computes ratings from the live review rows, NOT from average_rating /
-- review_count columns. The v2 spec's reviews table (author_name, is_approved)
-- + sync_product_rating trigger would conflict with that. Only run the block
-- below if you intend to migrate to the is_approved review model.
--
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
-- CREATE OR REPLACE FUNCTION sync_product_rating() RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE products SET
--     average_rating = (SELECT COALESCE(ROUND(AVG(rating)::NUMERIC,2),0) FROM reviews
--                        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true),
--     review_count   = (SELECT COUNT(*) FROM reviews
--                        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true)
--   WHERE id = COALESCE(NEW.product_id, OLD.product_id);
--   RETURN NEW;
-- END; $$ LANGUAGE 'plpgsql';
-- DROP TRIGGER IF EXISTS sync_rating_on_review ON reviews;
-- CREATE TRIGGER sync_rating_on_review AFTER INSERT OR UPDATE OR DELETE ON reviews
--   FOR EACH ROW EXECUTE PROCEDURE sync_product_rating();
-- ============================================================================


-- ============================================================================
-- REVIEW BEFORE RUNNING #2 — ROW LEVEL SECURITY ON products
-- ----------------------------------------------------------------------------
-- The v2 spec enables RLS with ONLY a public SELECT policy. Admin product
-- create/update in this app go through API routes that use the AUTHENTICATED
-- USER's Supabase session (not the service role) for the write. Enabling RLS
-- with no INSERT/UPDATE/DELETE policy for admins would BREAK product management.
-- Before enabling RLS, add matching admin write policies (or switch the admin
-- write routes to the service-role client). Left disabled here on purpose.
--
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Public read active products" ON products;
-- CREATE POLICY "Public read active products" ON products FOR SELECT USING (is_active = true);
-- CREATE POLICY "Admins manage products" ON products FOR ALL
--   USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
-- ============================================================================
