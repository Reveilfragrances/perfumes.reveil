-- ============================================================================
-- COUPON CODE SYSTEM — Section 6
-- Coupons table + per-order coupon references + usage-increment RPC.
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE guards).
-- ============================================================================

-- Shared updated_at trigger function (used by coupons and elsewhere).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TABLE IF NOT EXISTS public.coupons (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code                  TEXT UNIQUE NOT NULL,
  description           TEXT,
  type                  TEXT NOT NULL CHECK (type IN ('flat','percentage','flat_on_minimum','percentage_on_minimum')),
  value                 NUMERIC NOT NULL,
  minimum_order_amount  NUMERIC DEFAULT 0,
  maximum_discount      NUMERIC,
  is_active             BOOLEAN DEFAULT true,
  usage_limit           INTEGER,
  usage_count           INTEGER DEFAULT 0,
  per_user_limit        INTEGER,
  expires_at            TIMESTAMPTZ,
  applicable_categories TEXT[],
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (code);
CREATE INDEX IF NOT EXISTS coupons_is_active_idx ON public.coupons (is_active);

-- Auto-update updated_at on coupon edits.
DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Per-order coupon references.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;

-- Carry the coupon through the prepaid (Razorpay) snapshot so it can be copied
-- onto the order when the payment is finalised.
ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS coupon_id UUID;
ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;

-- Atomic usage increment, called once per order that used a coupon.
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_id UUID)
RETURNS void AS $$
  UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = coupon_id;
$$ LANGUAGE sql;
