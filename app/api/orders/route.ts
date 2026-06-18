import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth/require'
import { isUuid, clampInt, isEmail } from '@/lib/validators'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { computeShipping } from '@/lib/razorpay'
import { triggerOrderReceivedEmail, triggerAdminOrderNotification } from '@/lib/utils/email'
import { validateAndComputeCoupon, incrementCouponUsage } from '@/lib/coupons'
import { NextResponse } from 'next/server'

const COD_MAX_TOTAL_INR = 5000
const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

export async function GET(request: Request) {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const statusFilter = searchParams.get('status')
    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    const page = clampInt(searchParams.get('page') || '1', 1, 100000) || 1
    const limit = clampInt(searchParams.get('limit') || '20', 1, 100) || 20
    const offset = (page - 1) * limit

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role === 'admin'

    let query = supabase
        .from('orders')
        .select(`
      id,
      total,
      status,
      payment_method,
      shipping_address,
      created_at,
      profiles ( id, full_name, phone ),
      order_items (
        id,
        quantity,
        price,
        products ( id, name, images, slug )
      )
    `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (!isAdmin) query = query.eq('user_id', user.id)
    if (statusFilter) query = query.eq('status', statusFilter)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        orders: data,
        total: count,
        page,
        totalPages: Math.ceil((count ?? 0) / limit),
    })
}

export async function POST(request: Request) {
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const rl = await rateLimit({ key: `orders:post:${user.id}`, limit: 10, windowSec: 60 })
    if (!rl.ok) return rateLimitResponse(rl)
    const ipRl = await rateLimit({ key: `orders:post:ip:${getClientIp(request)}`, limit: 30, windowSec: 60 })
    if (!ipRl.ok) return rateLimitResponse(ipRl)

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { items, shipping_address, payment_method = 'cod', buy_now = false, email, coupon_code } = body || {}

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }
    // Email is mandatory — it's the contact address for order confirmation and
    // communication. Validated here so the API can't be called without one.
    const customerEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!isEmail(customerEmail)) {
        return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }
    if (!shipping_address || typeof shipping_address !== 'object') {
        return NextResponse.json({ error: 'shipping_address is required' }, { status: 400 })
    }
    if (payment_method !== 'cod' && payment_method !== 'razorpay') {
        return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
    }
    // Only allow direct creation for COD here — Razorpay must go through
    // /api/payment/razorpay/verify so the payment is bound to the order.
    if (payment_method !== 'cod') {
        return NextResponse.json(
            { error: 'Use /api/payment/razorpay/verify for online payments' },
            { status: 400 }
        )
    }

    // Normalise + validate every line item
    const normalisedItems: { product_id: string; quantity: number }[] = []
    for (const it of items) {
        if (!isUuid(it?.product_id)) return NextResponse.json({ error: 'Invalid product_id' }, { status: 400 })
        const qty = clampInt(it?.quantity, 1, 20)
        if (!qty) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
        normalisedItems.push({ product_id: it.product_id, quantity: qty })
    }

    // Use * so the query keeps working before the migration adds the
    // apply_delivery_fee column. Missing column → undefined → defaults to true.
    const { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .in('id', normalisedItems.map(i => i.product_id))

    if (productError) {
        return NextResponse.json({ error: 'Could not load products' }, { status: 500 })
    }

    for (const item of normalisedItems) {
        const product = products?.find(p => p.id === item.product_id)
        if (!product) {
            return NextResponse.json({ error: `Product ${item.product_id} not found` }, { status: 404 })
        }
        if (product.stock < item.quantity) {
            return NextResponse.json(
                { error: `Not enough stock for "${product.name}". Available: ${product.stock}` },
                { status: 400 }
            )
        }
    }

    const subtotal = normalisedItems.reduce((sum, item) => {
        const product = products!.find(p => p.id === item.product_id)!
        return sum + product.price * item.quantity
    }, 0)
    // Per-product opt-out: if every product in the order has apply_delivery_fee=false,
    // shipping is free regardless of subtotal.
    const applyFee = products!.some(p => (p.apply_delivery_fee ?? true) === true && normalisedItems.some(i => i.product_id === p.id))
    // This route only creates COD orders (Razorpay goes through the verify
    // endpoint), so hardcode 'cod' here — Reveil's policy: ₹80 shipping when
    // subtotal < ₹250, free above.
    const shippingFee = computeShipping(subtotal, 'cod', applyFee)

    // Coupon — re-validated server-side (never trust a client-sent discount).
    let couponId: string | null = null
    let couponCode: string | null = null
    let couponDiscount = 0
    if (coupon_code) {
        const couponResult = await validateAndComputeCoupon({ code: coupon_code, subtotal, userId: user.id })
        if (couponResult.ok) {
            couponId = couponResult.couponId
            couponCode = couponResult.code
            couponDiscount = couponResult.discount
        }
        // Invalid coupon → silently ignore and charge full price; the UI already
        // validated it, so this only fires on a stale/expired code at submit time.
    }

    const total = Math.max(subtotal - couponDiscount + shippingFee, 0)

    if (total > COD_MAX_TOTAL_INR) {
        return NextResponse.json(
            { error: `COD is unavailable for orders above ₹${COD_MAX_TOTAL_INR}. Please pay online.` },
            { status: 400 }
        )
    }

    // Atomic create-order + decrement stock via RPC (see security.sql).
    const admin = createAdminClient()

    // Persist the checkout email onto the profile — this is the address every
    // order email (confirmation/shipment/cancellation) reads from, so the
    // customer is reachable for this and future orders.
    const { error: emailSaveError } = await admin
        .from('profiles')
        .update({ email: customerEmail })
        .eq('id', user.id)
    if (emailSaveError) {
        console.error('[orders] Failed to persist customer email (non-fatal):', emailSaveError.message)
    }

    const { data: orderId, error: rpcError } = await admin.rpc('create_cod_order', {
        p_user_id: user.id,
        p_shipping_address: shipping_address,
        p_items: normalisedItems,
        p_total: total,
    })
    if (rpcError || !orderId) {
        // Surface the real reason so the operator can fix it — generic
        // "Could not place order" makes this impossible to debug from the UI.
        console.error('[orders] create_cod_order RPC error:', {
            code: rpcError?.code,
            message: rpcError?.message,
            details: rpcError?.details,
            hint: rpcError?.hint,
        })

        const msg = (rpcError?.message || '').toLowerCase()

        // Stock conflict surfaced by the RPC — show the friendly variant.
        if (msg.includes('out_of_stock')) {
            return NextResponse.json(
                { error: 'One of the items just went out of stock. Please refresh your cart and try again.' },
                { status: 409 },
            )
        }
        if (msg.includes('product_not_found')) {
            return NextResponse.json(
                { error: 'A product in your cart no longer exists. Please refresh and try again.' },
                { status: 404 },
            )
        }

        // Common operator-level misconfigurations.
        const operatorHint =
            msg.includes('does not exist') && msg.includes('function')
                ? 'create_cod_order RPC is missing. Run supabase/security.sql against the database.'
                : msg.includes('permission denied')
                ? 'service_role does not have execute permission on create_cod_order. Re-run the grant in supabase/security.sql.'
                : rpcError?.code === '42703'
                ? 'A column referenced by create_cod_order is missing on the orders table. Check the schema matches security.sql.'
                : null

        return NextResponse.json(
            {
                error: 'Could not place order',
                reason: rpcError?.message || 'Unknown RPC error',
                code: rpcError?.code,
                ...(operatorHint ? { hint: operatorHint } : {}),
            },
            { status: 500 },
        )
    }

    // Persist the actual shipping fee on the order row. The create_cod_order
    // RPC only stores the total — we set shipping_cost separately so the
    // invoice (and any downstream report) shows the real ₹0 / ₹60 / ₹80 line.
    if (shippingFee > 0) {
        await admin
            .from('orders')
            .update({ shipping_cost: shippingFee })
            .eq('id', orderId as string)
    }

    // Persist coupon info on the order + bump usage. Best-effort: wrapped so a
    // missing coupon column (pre-migration) never fails an otherwise-valid order.
    if (couponId && couponDiscount > 0) {
        const { error: couponSaveError } = await admin
            .from('orders')
            .update({ coupon_id: couponId, coupon_code: couponCode, coupon_discount: couponDiscount })
            .eq('id', orderId as string)
        if (couponSaveError) {
            console.error('[orders] Failed to persist coupon (non-fatal):', couponSaveError.message)
        } else {
            await incrementCouponUsage(couponId)
        }
    }

    if (!buy_now) {
        await supabase.from('cart_items').delete().eq('user_id', user.id)
    }

    const { data: fullOrder } = await supabase
        .from('orders')
        .select(`
      *,
      order_items (
        id, quantity, price,
        products ( name, images )
      )
    `)
        .eq('id', orderId as string)
        .single()

    // NOTE: The order is intentionally left in "pending approval" — we do NOT
    // push to Shiprocket or send a confirmation email here. That happens only
    // after an admin reviews and confirms the order from the admin panel
    // (see /api/shiprocket/create-order). We DO send the "order received —
    // under review" email so the customer knows it landed.
    triggerOrderReceivedEmail(orderId as string).catch((err) => {
        console.error('[orders] Order received email failed (non-fatal):', err?.message)
    })
    // Notify the store owner so they can review/process the new order.
    triggerAdminOrderNotification(orderId as string).catch((err) => {
        console.error('[orders] Admin order notification failed (non-fatal):', err?.message)
    })

    return NextResponse.json(fullOrder, { status: 201 })
}
