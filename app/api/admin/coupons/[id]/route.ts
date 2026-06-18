import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickCouponFields } from '@/lib/coupons'

type Params = Promise<{ id: string }>

// PUT — update a coupon
export async function PUT(req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let raw: Record<string, unknown>
    try {
        raw = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    // Whitelist fields (drops id, usage_count, created_at, etc.) to block
    // mass-assignment of server-managed columns.
    const body = pickCouponFields(raw)
    if (typeof body.code === 'string') body.code = body.code.toUpperCase().trim()

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('coupons')
        .update(body)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// DELETE — remove a coupon
export async function DELETE(_req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { error } = await admin.from('coupons').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// PATCH — toggle active / inactive
export async function PATCH(req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('coupons')
        .update({ is_active: !!body.is_active })
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
