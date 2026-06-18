import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { notifyGoogleOfChange } from '@/lib/utils/indexing'
import { upsertMerchantProduct } from '@/lib/google-sync'
import { SITE_URL } from '@/lib/seo/keywords'

// Service role client — bypasses RLS for public catalogue reads
function getServiceClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function GET(request: Request) {
    const supabase = getServiceClient()  // bypasses RLS — safe for public read-only
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const rawSearch = searchParams.get('search')
    // Cap search length and strip ilike wildcards so the regex match is bounded.
    const search = rawSearch && rawSearch.length <= 80 ? rawSearch.replace(/[%_]/g, ' ') : null
    const pageRaw = parseInt(searchParams.get('page') || '1')
    const limitRaw = parseInt(searchParams.get('limit') || '12')
    const page = Math.max(1, Math.min(pageRaw || 1, 100000))
    const limit = Math.max(1, Math.min(limitRaw || 12, 100))
    const offset = (page - 1) * limit

    let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (category) query = query.eq('category', category)
    if (featured === 'true') query = query.eq('is_featured', true)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error, count } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        products: data,
        total: count,
        page,
        totalPages: Math.ceil((count ?? 0) / limit)
    })
}

export async function POST(request: Request) {
    const supabase = await createClient()

    // 1. Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check admin role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError || profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    // 3. Parse and validate body
    const body = await request.json()
    const { name, price, mrp, description, images, category, stock, is_featured,
        meta_title, meta_description, meta_keywords, scent_profile, technical_specs,
        apply_delivery_fee } = body

    if (!name || !price) {
        return NextResponse.json({ error: 'name and price are required' }, { status: 400 })
    }

    // 4. Auto-generate slug from name
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')

    // 5. Check slug uniqueness
    const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .single()

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    // 6. Insert product
    const { data, error } = await supabase
        .from('products')
        .insert({
            name,
            slug: finalSlug,
            price,
            mrp: mrp ?? null,
            description: description ?? null,
            images: images ?? [],
            category: category ?? null,
            stock: stock ?? 0,
            is_featured: is_featured ?? false,
            meta_title: meta_title ?? name,
            meta_description: meta_description ?? description ?? null,
            meta_keywords: meta_keywords ?? null,
            scent_profile: scent_profile ?? null,
            technical_specs: technical_specs ?? null,
            apply_delivery_fee: apply_delivery_fee ?? true,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 7. Notify Google Indexing API + push to Merchant Center (both best-effort)
    try {
        await notifyGoogleOfChange(`${SITE_URL}/products/${data.slug}`);
    } catch (err) {
        console.error('Failed to notify Google Indexing API:', err);
    }
    upsertMerchantProduct(data).catch((err) =>
        console.error('Failed to sync product to Merchant Center:', err)
    );

    return NextResponse.json(data, { status: 201 })
}