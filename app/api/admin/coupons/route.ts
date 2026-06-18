import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickCouponFields, VALID_COUPON_TYPES } from '@/lib/coupons'

// GET — list all coupons (admin only)
export async function GET() {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST — create a new coupon (admin only)
export async function POST(req: Request) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let raw: Record<string, unknown>
    try {
        raw = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const body = pickCouponFields(raw)
    body.code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : ''

    if (!body.code || !body.type || body.value === undefined || body.value === null) {
        return NextResponse.json({ error: 'code, type, and value are required' }, { status: 400 })
    }
    if (!VALID_COUPON_TYPES.includes(String(body.type) as typeof VALID_COUPON_TYPES[number])) {
        return NextResponse.json({ error: 'Invalid coupon type' }, { status: 400 })
    }
    if (!isFinite(Number(body.value)) || Number(body.value) < 0) {
        return NextResponse.json({ error: 'value must be a non-negative number' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.from('coupons').insert(body).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
