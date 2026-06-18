import { NextResponse } from 'next/server'
import { validateAndComputeCoupon } from '@/lib/coupons'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

// Validate a coupon against the cart subtotal and return the discount preview.
// This is for UI feedback only — the order routes re-validate authoritatively.
export async function POST(req: Request) {
    // Rate-limit by IP so coupon codes can't be brute-forced / enumerated.
    const rl = await rateLimit({ key: `coupon:apply:ip:${getClientIp(req)}`, limit: 15, windowSec: 60 })
    if (!rl.ok) return rateLimitResponse(rl)

    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { code, orderAmount, userId } = body || {}
    if (!code || !orderAmount) {
        return NextResponse.json({ error: 'code and orderAmount are required' }, { status: 400 })
    }

    const result = await validateAndComputeCoupon({ code, subtotal: Number(orderAmount), userId })
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
        valid: true,
        discount: result.discount,
        couponId: result.couponId,
        message: result.message,
    })
}
