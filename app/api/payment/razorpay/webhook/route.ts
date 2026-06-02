import { NextResponse } from 'next/server'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'
import { finaliseRazorpayOrder } from '@/lib/orders'

/**
 * Razorpay webhook receiver.
 *
 * Configure the webhook URL in the Razorpay dashboard to
 *   https://<your-domain>/api/payment/razorpay/webhook
 * and set the webhook secret as RAZORPAY_WEBHOOK_SECRET in env.
 *
 * Subscribe to at least `payment.captured` and `payment.authorized`. This
 * route is idempotent — if /verify already finalised the order, we silently
 * succeed.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('x-razorpay-signature')
  const rawBody = await request.text()

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = String(event?.event || '')
  // We only finalize on `payment.captured` — `authorized` means funds are
  // held but not yet in our account, so creating an order then would be
  // premature. Razorpay account default is auto-capture, so captured fires
  // immediately after the customer's checkout completes.
  if (eventType !== 'payment.captured') {
    // Acknowledge — Razorpay treats any non-2xx as a retry.
    return NextResponse.json({ ok: true, ignored: eventType })
  }

  const payment = event?.payload?.payment?.entity
  if (!payment?.order_id || !payment?.id) {
    return NextResponse.json({ ok: true, warning: 'no payment entity' })
  }

  const result = await finaliseRazorpayOrder({
    razorpayOrderId: String(payment.order_id),
    razorpayPaymentId: String(payment.id),
    paidAmountPaise: Number(payment.amount),
    capturedCurrency: String(payment.currency),
  })

  if (!result.ok) {
    // 4xx so Razorpay surfaces the failure in its dashboard but doesn't keep
    // hammering us forever — unless this was a 5xx, which it will retry.
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // The order is recorded as paid, but Shiprocket is NOT triggered here — an
  // admin must review and confirm the order first (see the admin panel).

  return NextResponse.json({ ok: true, order_id: result.orderId })
}
