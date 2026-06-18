import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require'
import { getRazorpay, computeShipping } from '@/lib/razorpay'

const isFlagOn = (v: unknown) => v === undefined || v === null || v === true
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid, clampInt, isEmail } from '@/lib/validators'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { validateAndComputeCoupon } from '@/lib/coupons'

export async function POST(request: Request) {
    try {
        const auth = await requireUser()
        if (!auth.ok) return auth.response
        const { user, supabase } = auth

        // 10 order-creations / minute / user is plenty; protects Razorpay quota.
        const rl = await rateLimit({ key: `rp:create:${user.id}`, limit: 10, windowSec: 60 })
        if (!rl.ok) return rateLimitResponse(rl)
        const ipRl = await rateLimit({ key: `rp:create:ip:${getClientIp(request)}`, limit: 30, windowSec: 60 })
        if (!ipRl.ok) return rateLimitResponse(ipRl)

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const { address_id, buy_now, email, coupon_code } = body as {
            address_id?: string
            buy_now?: { product_id: string; quantity: number }
            email?: string
            coupon_code?: string | null
        }

        if (!isUuid(address_id)) {
            return NextResponse.json({ error: 'Invalid address_id' }, { status: 400 })
        }

        // Email is mandatory — the contact address for order communication.
        const customerEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
        if (!isEmail(customerEmail)) {
            return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
        }

        let buyNowProductId: string | null = null
        let buyNowQty = 0
        if (buy_now) {
            if (!isUuid(buy_now.product_id)) {
                return NextResponse.json({ error: 'Invalid buy_now.product_id' }, { status: 400 })
            }
            const qty = clampInt(buy_now.quantity, 1, 20)
            if (!qty) return NextResponse.json({ error: 'Invalid buy_now.quantity' }, { status: 400 })
            buyNowProductId = buy_now.product_id
            buyNowQty = qty
        }

        const { data: address, error: addressError } = await supabase
            .from('addresses')
            .select('*')
            .eq('id', address_id)
            .eq('user_id', user.id)
            .single()

        if (addressError || !address) {
            return NextResponse.json({ error: 'Address not found' }, { status: 404 })
        }

        type LineItem = { product_id: string; name: string; price: number; stock: number; quantity: number; apply_delivery_fee: boolean }
        let lineItems: LineItem[] = []

        if (buyNowProductId) {
            const { data: product, error: prodErr } = await supabase
                .from('products')
                .select('*')
                .eq('id', buyNowProductId)
                .single()
            if (prodErr || !product) {
                return NextResponse.json({ error: 'Product not found' }, { status: 404 })
            }
            lineItems = [{
                product_id: product.id,
                name: product.name,
                price: product.price,
                stock: product.stock,
                quantity: buyNowQty,
                apply_delivery_fee: isFlagOn(product.apply_delivery_fee),
            }]
        } else {
            const { data: cartItems, error: cartError } = await supabase
                .from('cart_items')
                .select('id, quantity, products (*)')
                .eq('user_id', user.id)

            if (cartError) return NextResponse.json({ error: 'Could not read cart' }, { status: 500 })
            if (!cartItems || cartItems.length === 0) {
                return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
            }
            lineItems = cartItems.map((c: any) => ({
                product_id: c.products?.id,
                name: c.products?.name,
                price: c.products?.price,
                stock: c.products?.stock,
                quantity: c.quantity,
                apply_delivery_fee: isFlagOn(c.products?.apply_delivery_fee),
            }))
        }

        let subtotal = 0
        for (const item of lineItems) {
            if (!item.product_id) {
                return NextResponse.json({ error: 'A product is no longer available' }, { status: 400 })
            }
            if (item.stock < item.quantity) {
                return NextResponse.json(
                    { error: `Not enough stock for "${item.name}". Available: ${item.stock}` },
                    { status: 400 }
                )
            }
            subtotal += item.price * item.quantity
        }

        // Per-product delivery opt-out — if every line item has apply_delivery_fee=false,
        // the order ships free regardless of subtotal threshold.
        const applyFee = lineItems.some(i => i.apply_delivery_fee)
        // Razorpay path is online payment ('prepaid' / 'razorpay'). Below
        // ₹250 threshold customers pay ₹60 shipping — the cheaper rate.
        const shippingFee = computeShipping(subtotal, 'razorpay', applyFee)

        // Coupon — re-validated server-side so the discount can't be faked.
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
        }

        const total = Math.max(subtotal - couponDiscount + shippingFee, 0)

        const razorpay = getRazorpay()
        const rpOrder = await razorpay.orders.create({
            amount: Math.round(total * 100), // paise
            currency: 'INR',
            receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
            notes: {
                user_id: user.id,
                address_id,
            },
        })

        // razorpay-node types `id` as `string | number`; coerce so the text PK
        // doesn't silently get a JS number in some SDK builds.
        const rpOrderId = String(rpOrder.id)

        // Persist a snapshot that /verify (and the webhook) will load — this is
        // the ONLY trusted source of truth for what the user paid for.
        const admin = createAdminClient()

        // Save the checkout email onto the profile so the post-approval order
        // email reaches the address the customer entered at checkout.
        const { error: emailSaveError } = await admin
            .from('profiles')
            .update({ email: customerEmail })
            .eq('id', user.id)
        if (emailSaveError) {
            console.error('[razorpay] Failed to persist customer email (non-fatal):', emailSaveError.message)
        }

        const { error: snapshotError } = await admin.from('pending_orders').insert({
            razorpay_order_id: rpOrderId,
            user_id: user.id,
            address_id,
            buy_now_product_id: buyNowProductId,
            buy_now_quantity: buyNowProductId ? buyNowQty : null,
            line_items: lineItems.map(i => ({
                product_id: i.product_id, name: i.name, price: i.price, quantity: i.quantity,
            })),
            subtotal,
            shipping_fee: shippingFee,
            total,
            expected_amount_paise: Math.round(total * 100),
            currency: 'INR',
            status: 'created',
            // Only include coupon fields when a coupon was actually applied, so
            // the default insert is unchanged for stores that haven't migrated.
            ...(couponId ? { coupon_id: couponId, coupon_code: couponCode, coupon_discount: couponDiscount } : {}),
        })
        if (snapshotError) {
            // Log full Supabase error context — code/details/hint usually pinpoint
            // missing tables, FK violations, or schema drift.
            console.error('[razorpay] pending_orders insert failed', {
                code: snapshotError.code,
                message: snapshotError.message,
                details: snapshotError.details,
                hint: snapshotError.hint,
                razorpay_order_id: rpOrderId,
            })

            // We already charged a quota slot at Razorpay for an order we now
            // can't fulfil. Best-effort tag the order as abandoned so the
            // dashboard reflects reality and the user can retry cleanly.
            try {
                await razorpay.orders.edit(rpOrderId, { notes: { abandoned: 'true', reason: snapshotError.code || 'snapshot_failed' } })
            } catch (cleanupErr: any) {
                console.error('[razorpay] orphan-order cleanup failed:', cleanupErr?.message)
            }

            // Translate the most common Postgres error codes into something the
            // operator can act on without grepping logs. 42P01 = undefined_table,
            // 42703 = undefined_column, 23503 = foreign_key_violation.
            const operatorHint =
                snapshotError.code === '42P01'
                    ? 'pending_orders table is missing. Run supabase/security.sql against the database.'
                    : snapshotError.code === '42703'
                    ? `pending_orders is missing a column (${snapshotError.message}). Re-run supabase/security.sql.`
                    : snapshotError.code === '23503'
                    ? 'A referenced row was not found (foreign key violation). Confirm the address belongs to this user.'
                    : null

            return NextResponse.json(
                {
                    error: 'Could not initialise payment',
                    reason: snapshotError.message,
                    code: snapshotError.code,
                    ...(operatorHint ? { hint: operatorHint } : {}),
                },
                { status: 500 },
            )
        }

        const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        if (!publicKeyId) {
            console.error('[razorpay] NEXT_PUBLIC_RAZORPAY_KEY_ID not configured — refusing to expose any other env var to the browser')
            return NextResponse.json(
                { error: 'Payment is misconfigured. Please contact support.' },
                { status: 500 },
            )
        }

        return NextResponse.json({
            razorpay_order_id: rpOrderId,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            key_id: publicKeyId,
            subtotal,
            shipping: shippingFee,
            total,
        })
    } catch (err: any) {
        console.error('Razorpay create-order error:', err?.message)
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
    }
}
