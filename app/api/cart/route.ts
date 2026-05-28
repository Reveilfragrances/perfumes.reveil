import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeShipping, cartAppliesDeliveryFee, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE_COD, SHIPPING_FEE_PREPAID } from '@/lib/razorpay'

// ── GET — fetch current user's cart ─────────────────────────────────────────
export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use products(*) instead of an explicit column list so the query
    // succeeds even if apply_delivery_fee column has not been added yet.
    // The flag falls back to true (legacy behaviour) until the migration
    // is applied.
    const { data, error } = await supabase
        .from('cart_items')
        .select(`
      id,
      quantity,
      products (*)
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate totals server-side
    const subtotal = data?.reduce((sum, item) => {
        return sum + ((item.products as any)?.price ?? 0) * item.quantity
    }, 0) ?? 0

    // Shipping rules (Reveil, May 2026):
    //   - Subtotal >= ₹250                   → Free
    //   - Subtotal < ₹250 + Online payment   → ₹60
    //   - Subtotal < ₹250 + Cash on delivery → ₹80
    // On the cart page (before checkout) we show the cheaper "prepaid" rate
    // as the default — the customer's actual payment method is locked in on
    // the checkout page, where the total recomputes if they pick COD.
    // Supabase types nested relations as arrays even for 1:1; cast for the helper.
    const applyFee = cartAppliesDeliveryFee((data ?? []) as any[])
    const shipping = computeShipping(subtotal, 'prepaid', applyFee)
    const shippingCod = computeShipping(subtotal, 'cod', applyFee)
    const total = subtotal + shipping

    return NextResponse.json({
        items: data ?? [],
        subtotal,
        shipping,
        shippingPrepaid: shipping,
        shippingCod,
        total,
        applyDeliveryFee: applyFee,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        shippingRates: { cod: SHIPPING_FEE_COD, prepaid: SHIPPING_FEE_PREPAID },
        itemCount: data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    })
}

// ── POST — add item or increase quantity ─────────────────────────────────────
export async function POST(request: Request) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { product_id, quantity = 1 } = body

    if (!product_id) {
        return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }
    if (quantity < 1) {
        return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 })
    }

    // 1. Check product exists and has enough stock
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, stock, price')
        .eq('id', product_id)
        .single()

    if (productError || !product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (product.stock < 1) {
        return NextResponse.json({ error: 'Product is out of stock' }, { status: 400 })
    }

    // 2. Check if item already in cart
    const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product_id)
        .single()

    if (existing) {
        // Item already in cart — increase quantity
        const newQty = existing.quantity + quantity

        // Don't exceed available stock
        if (newQty > product.stock) {
            return NextResponse.json(
                { error: `Only ${product.stock} units available. You already have ${existing.quantity} in cart.` },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('cart_items')
            .update({ quantity: newQty })
            .eq('id', existing.id)
            .select(`
        id, quantity,
        products ( id, name, slug, price, images, stock )
      `)
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ item: data, action: 'updated' })
    }

    // 3. New item — insert
    if (quantity > product.stock) {
        return NextResponse.json(
            { error: `Only ${product.stock} units available` },
            { status: 400 }
        )
    }

    const { data, error } = await supabase
        .from('cart_items')
        .insert({
            user_id: user.id,
            product_id,
            quantity,
        })
        .select(`
      id, quantity,
      products ( id, name, slug, price, images, stock )
    `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item: data, action: 'added' }, { status: 201 })
}

// ── DELETE — clear entire cart ───────────────────────────────────────────────
export async function DELETE() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Cart cleared' })
}