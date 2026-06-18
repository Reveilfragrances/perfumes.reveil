-- ============================================================================
-- SHIPPING PROVIDERS (iCarry + Manual) — Section 5
-- Adds per-order shipping provider fields. Shiprocket continues to use the
-- existing awb_code / shiprocket_order_id columns; these new columns let the
-- admin pick iCarry or Manual delivery per order without touching that flow.
-- Safe to run multiple times (IF NOT EXISTS guards).
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT DEFAULT 'pending';
-- Values: 'pending' | 'shiprocket' | 'icarry' | 'manual'

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_awb TEXT;
-- AWB / tracking number from the chosen provider.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
-- PDF label URL (when the provider returns one).

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'pending';
-- e.g. 'pending','processing','shipped','out_for_delivery','delivered','cancelled','ndr'

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manual_delivery_note TEXT;
-- Only used when shipping_provider = 'manual'.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS icarry_awb TEXT;
-- iCarry-specific AWB for fast webhook lookups.

CREATE INDEX IF NOT EXISTS orders_icarry_awb_idx ON public.orders (icarry_awb) WHERE icarry_awb IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_shipping_awb_idx ON public.orders (shipping_awb) WHERE shipping_awb IS NOT NULL;
