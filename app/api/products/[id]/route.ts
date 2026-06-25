import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require'
import { NextResponse } from 'next/server'
import { notifyGoogleOfChange } from '@/lib/utils/indexing'
import { upsertMerchantProduct, deleteMerchantProduct } from '@/lib/google-sync'
import { SITE_URL } from '@/lib/seo/keywords'

type Params = Promise<{ id: string }>

const ALLOWED_FIELDS = [
    'name', 'slug', 'price', 'mrp', 'description', 'images', 'category',
    'stock', 'is_featured', 'meta_title', 'meta_description', 'meta_keywords',
    'scent_profile', 'rating', 'technical_specs', 'apply_delivery_fee',
    // Google Merchant Center fields
    'unit', 'unit_pricing_base_measure', 'shipping_weight',
] as const

function pickAllowedFields(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const f of ALLOWED_FIELDS) {
        if (f in body) out[f] = body[f]
    }
    return out
}

export async function GET(_req: Request, { params }: { params: Params }) {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

    if (error) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const updates = pickAllowedFields(body)
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
        await notifyGoogleOfChange(`${SITE_URL}/products/${data.slug}`, 'URL_UPDATED')
    } catch (err) {
        console.error('Indexing API Error:', err)
    }
    upsertMerchantProduct(data).catch((err) =>
        console.error('Failed to sync product to Merchant Center:', err)
    )

    return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    // Read the row before deleting so we can de-list it from Merchant Center
    // and tell Google to drop the URL afterwards.
    const { data: existing } = await auth.supabase
        .from('products')
        .select('id, slug')
        .eq('id', id)
        .single()

    const { error } = await auth.supabase
        .from('products')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existing) {
        deleteMerchantProduct(existing).catch((err) =>
            console.error('Failed to remove product from Merchant Center:', err)
        )
        notifyGoogleOfChange(`${SITE_URL}/products/${existing.slug}`, 'URL_DELETED').catch((err) =>
            console.error('Indexing API Error:', err)
        )
    }

    return NextResponse.json({ success: true })
}
