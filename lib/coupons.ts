/**
 * COUPON VALIDATION + DISCOUNT (server-side, authoritative)
 *
 * Shared by /api/coupons/apply (UI preview) and the order-creation routes
 * (COD + Razorpay). Order routes MUST re-validate here rather than trusting a
 * client-sent discount — this is the single source of truth for the amount.
 *
 * Degrades gracefully: if the coupons table doesn't exist yet (migration not
 * run) or anything errors, it returns { ok:false } so checkout proceeds at full
 * price instead of breaking.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export const VALID_COUPON_TYPES = ['flat', 'percentage', 'flat_on_minimum', 'percentage_on_minimum'] as const

// Only these fields may be set by an admin — prevents mass-assignment of
// server-managed columns (id, usage_count, created_at, updated_at).
const ALLOWED_COUPON_FIELDS = [
    'code', 'description', 'type', 'value', 'minimum_order_amount',
    'maximum_discount', 'is_active', 'usage_limit', 'per_user_limit',
    'expires_at', 'applicable_categories',
] as const

export function pickCouponFields(body: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const f of ALLOWED_COUPON_FIELDS) {
        if (f in body) out[f] = body[f]
    }
    return out
}

export type CouponResult =
    | { ok: true; couponId: string; code: string; discount: number; message: string }
    | { ok: false; error: string }

export async function validateAndComputeCoupon(input: {
    code: string
    subtotal: number
    userId?: string | null
}): Promise<CouponResult> {
    const code = String(input.code || '').toUpperCase().trim()
    const subtotal = Number(input.subtotal)

    if (!code) return { ok: false, error: 'Coupon code is required' }
    if (!isFinite(subtotal) || subtotal <= 0) return { ok: false, error: 'Invalid order amount' }

    try {
        const admin = createAdminClient()

        const { data: coupon, error } = await admin
            .from('coupons')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .maybeSingle()

        if (error || !coupon) {
            return { ok: false, error: 'Invalid or inactive coupon code' }
        }

        if (coupon.expires_at && new Date() > new Date(coupon.expires_at)) {
            return { ok: false, error: 'This coupon has expired' }
        }

        if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
            return { ok: false, error: 'This coupon has reached its usage limit' }
        }

        if (coupon.minimum_order_amount > 0 && subtotal < coupon.minimum_order_amount) {
            return { ok: false, error: `Minimum order of ₹${coupon.minimum_order_amount} required for this coupon` }
        }

        if (input.userId && coupon.per_user_limit != null) {
            const { count } = await admin
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', input.userId)
                .eq('coupon_code', coupon.code)
            if ((count || 0) >= coupon.per_user_limit) {
                return { ok: false, error: 'You have already used this coupon the maximum number of times' }
            }
        }

        // Compute discount.
        let discount = 0
        if (coupon.type === 'flat' || coupon.type === 'flat_on_minimum') {
            discount = Number(coupon.value)
        } else if (coupon.type === 'percentage' || coupon.type === 'percentage_on_minimum') {
            discount = (subtotal * Number(coupon.value)) / 100
            if (coupon.maximum_discount) {
                discount = Math.min(discount, Number(coupon.maximum_discount))
            }
        }

        // Never let the discount exceed the subtotal.
        discount = Math.min(Math.round(discount), subtotal)
        if (discount <= 0) return { ok: false, error: 'This coupon does not apply to your order' }

        return {
            ok: true,
            couponId: coupon.id,
            code: coupon.code,
            discount,
            message: `Coupon applied! You save ₹${discount}`,
        }
    } catch (err: any) {
        console.error('[validateAndComputeCoupon] error:', err?.message)
        return { ok: false, error: 'Could not validate coupon' }
    }
}

/** Best-effort usage increment. Never throws. */
export async function incrementCouponUsage(couponId: string | null | undefined) {
    if (!couponId) return
    try {
        const admin = createAdminClient()
        await admin.rpc('increment_coupon_usage', { coupon_id: couponId })
    } catch (err: any) {
        console.error('[incrementCouponUsage] error:', err?.message)
    }
}
