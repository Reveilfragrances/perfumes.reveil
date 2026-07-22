import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser, requireAdmin } from '@/lib/auth/require'
import { NextResponse } from 'next/server'
import { clampInt, clampString, isUuid } from '@/lib/validators'

const REVIEW_ALLOWED_UPDATE_FIELDS = [
    'rating', 'comment', 'is_featured', 'reviewer_name', 'reviewer_avatar', 'heading', 'media_urls'
] as const

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const product_id = searchParams.get('product_id')
    const admin = searchParams.get('admin') === 'true'
    const featured = searchParams.get('featured') === 'true'

    const supabase = await createClient()

    if (admin) {
        const auth = await requireAdmin()
        if (!auth.ok) return auth.response
    }

    const adminClient = createAdminClient()
    let query = adminClient
        .from('reviews')
        .select(`
            id,
            rating,
            heading,
            comment,
            media_urls,
            created_at,
            reviewer_name,
            reviewer_avatar,
            is_featured,
            product_id,
            products ( name ),
            profiles ( full_name )
        `)
        .order('created_at', { ascending: false })

    if (product_id) {
        if (!isUuid(product_id)) return NextResponse.json({ error: 'Bad product_id' }, { status: 400 })
        query = query.eq('product_id', product_id)
    }
    if (featured) query = query.eq('is_featured', true)
    if (!admin && !product_id && !featured) query = query.limit(10)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ reviews: data ?? [] })
}

export async function POST(request: Request) {
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const rating = clampInt(body?.rating, 1, 5)
    if (!rating) return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 })

    const comment = body?.comment != null ? clampString(body.comment, 2000) : null
    if (body?.comment != null && !comment) {
        return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }

    const productId = body?.product_id
    if (productId && !isUuid(productId)) {
        return NextResponse.json({ error: 'Invalid product_id' }, { status: 400 })
    }
    const orderId = body?.order_id
    if (orderId && !isUuid(orderId)) {
        return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    const isAdmin = profile?.role === 'admin'

    // All review reads/writes below go through the service-role client. The
    // user is already authenticated (requireUser) and user_id is set from the
    // verified session — never from client input — so this is safe. It also
    // makes the flow independent of the reviews table's RLS policies, which in
    // production were blocking customer inserts (the row silently never landed,
    // so the review appeared nowhere — site or admin panel).
    const adminDb = createAdminClient()

    if (!isAdmin && productId) {
        const { data: existing } = await adminDb
            .from('reviews')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .maybeSingle()
        if (existing) {
            return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 400 })
        }
    }

    const insertData: Record<string, unknown> = {
        rating,
        heading: body?.heading != null ? clampString(body.heading, 200) : null,
        comment,
        media_urls: Array.isArray(body?.media_urls) ? body.media_urls : [],
        is_featured: isAdmin ? !!body?.is_featured : false,
    }

    if (isAdmin) {
        // Admin may create reviews under a synthetic reviewer (e.g. seeded
        // reviews) but the user_id is ALWAYS the admin's own — never trust
        // body.user_id (used to allow arbitrary impersonation).
        const reviewerName = clampString(body?.reviewer_name, 80)
        if (reviewerName) insertData.reviewer_name = reviewerName
        const reviewerAvatar = clampString(body?.reviewer_avatar, 500)
        if (reviewerAvatar) insertData.reviewer_avatar = reviewerAvatar
        insertData.product_id = productId || null
        insertData.user_id = user.id
    } else {
        insertData.user_id = user.id
        insertData.product_id = productId
        insertData.order_id = orderId
        // Honour the "Post review as anonymous" checkbox. Non-admins may ONLY
        // set the reviewer name to the literal "Anonymous" — never an arbitrary
        // name (that would allow impersonation). When not anonymous, reviewer_name
        // stays null and the display falls back to the customer's profile name.
        if (body?.reviewer_name === 'Anonymous') {
            insertData.reviewer_name = 'Anonymous'
        }
    }

    const { data: review, error: reviewError } = await adminDb
        .from('reviews')
        .insert(insertData)
        .select()
        .single()

    if (reviewError) {
        // Log the full Postgres error context so a schema/constraint problem is
        // diagnosable from the server logs, and return the reason so the client
        // (customer modal / admin form) can show something actionable instead of
        // a silent failure. 42703 = undefined_column, 23502 = not_null_violation,
        // 23503 = foreign_key_violation, 23505 = unique_violation.
        console.error('[reviews] insert failed', {
            code: reviewError.code,
            message: reviewError.message,
            details: reviewError.details,
            hint: reviewError.hint,
        })
        return NextResponse.json(
            { error: 'Could not submit review', reason: reviewError.message, code: reviewError.code },
            { status: 500 },
        )
    }

    if (productId) {
        try {
            const { data: allRatings } = await adminDb
                .from('reviews')
                .select('rating')
                .eq('product_id', productId)
            if (allRatings && allRatings.length > 0) {
                const avg = allRatings.reduce((s: number, r: any) => s + r.rating, 0) / allRatings.length
                await adminDb
                    .from('products')
                    .update({ rating: parseFloat(avg.toFixed(1)) })
                    .eq('id', productId)
            }
        } catch {
            // best-effort
        }
    }

    return NextResponse.json({ review, action: 'submitted' }, { status: 201 })
}

export async function PATCH(request: Request) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { id, ...rest } = body || {}
    if (!isUuid(id)) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    for (const f of REVIEW_ALLOWED_UPDATE_FIELDS) {
        if (f in rest) updates[f] = rest[f]
    }
    if (typeof updates.comment === 'string') {
        const c = clampString(updates.comment, 2000)
        if (!c) return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
        updates.comment = c
    }
    if ('rating' in updates) {
        const r = clampInt(updates.rating, 1, 5)
        if (!r) return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
        updates.rating = r
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('reviews')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(request: Request) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id || !isUuid(id)) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const adminClient = createAdminClient()
    const { error } = await adminClient
        .from('reviews')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
