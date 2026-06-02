import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require'
import { getRazorpay, verifyRazorpaySignature } from '@/lib/razorpay'
import { finaliseRazorpayOrder } from '@/lib/orders'

export async function POST(request: Request) {
    try {
        const auth = await requireUser()
        if (!auth.ok) return auth.response
        const { user } = auth

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {}
        if (
            typeof razorpay_order_id !== 'string' ||
            typeof razorpay_payment_id !== 'string' ||
            typeof razorpay_signature !== 'string'
        ) {
            return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 })
        }

        // 1. HMAC verify (constant-time)
        const sigValid = verifyRazorpaySignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        })
        if (!sigValid) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
        }

        // 2. Authoritatively fetch the payment from Razorpay — never trust the
        //    client's reported amount or status.
        const razorpay = getRazorpay()
        const payment = await razorpay.payments.fetch(razorpay_payment_id)
        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 400 })
        }
        if (payment.order_id !== razorpay_order_id) {
            return NextResponse.json({ error: 'Payment does not belong to this order' }, { status: 400 })
        }
        // Only accept fully-captured payments. `authorized` means Razorpay has
        // a hold on the customer's funds but they're NOT in our merchant
        // account yet — if our merchant ever flips on manual-capture, we'd
        // be creating orders for money we can't actually withdraw. Auto-
        // capture is on by default, so for the vast majority of payments
        // this is a no-op; we just refuse the edge case.
        if (payment.status !== 'captured') {
            return NextResponse.json(
                { error: `Payment is in status: ${payment.status}. Please wait for capture or contact support.` },
                { status: 400 },
            )
        }

        // 3. Confirm the Razorpay order's notes link to this user — protects
        //    against a captured payment being claimed by a different cookie.
        const rpOrder = await razorpay.orders.fetch(razorpay_order_id)
        const notesUser = (rpOrder?.notes as any)?.user_id
        if (notesUser && notesUser !== user.id) {
            return NextResponse.json({ error: 'Order does not belong to this user' }, { status: 403 })
        }

        // 4. Finalise via shared helper — idempotent on payment_id, uses the
        //    pending_orders snapshot for line items, validates amount, runs
        //    the atomic stock RPC.
        const result = await finaliseRazorpayOrder({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            paidAmountPaise: Number(payment.amount),
            capturedCurrency: String(payment.currency),
        })
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status })
        }

        // Payment is captured and the order recorded, but we do NOT push to
        // Shiprocket here. The order waits in "pending approval" until an admin
        // reviews and confirms it from the admin panel.

        return NextResponse.json({ success: true, order_id: result.orderId }, { status: 201 })
    } catch (err: any) {
        console.error('Razorpay verify error:', err?.message)
        return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
    }
}
