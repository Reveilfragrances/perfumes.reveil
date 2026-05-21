import { createAdminClient } from '@/lib/supabase/admin'
import { triggerOrderConfirmationEmail } from '@/lib/utils/email'

export type FinalizeInput = {
  razorpayOrderId: string
  razorpayPaymentId: string
  paidAmountPaise: number
  capturedCurrency: string
}

export type FinalizeResult =
  | { ok: true; orderId: string; idempotent?: boolean }
  | { ok: false; status: number; error: string }

/**
 * Finalises a paid Razorpay order by reading the pending_orders snapshot,
 * confirming the captured amount matches, and inserting orders + order_items
 * atomically via a Postgres RPC. Idempotent on razorpay_payment_id (UNIQUE in
 * the orders.payment_id column).
 *
 * Callable from both /api/payment/razorpay/verify (after HMAC check) and the
 * Razorpay webhook (after webhook HMAC check). Whoever calls first wins; the
 * other call returns idempotent: true.
 */
export async function finaliseRazorpayOrder(input: FinalizeInput): Promise<FinalizeResult> {
  const admin = createAdminClient()

  // Idempotency: if we already have an order with this payment_id, return it.
  const { data: existing } = await admin
    .from('orders')
    .select('id')
    .eq('payment_id', input.razorpayPaymentId)
    .maybeSingle()
  if (existing) return { ok: true, orderId: existing.id, idempotent: true }

  // Load the snapshot. It is the only trusted source of line items + total.
  const { data: pending, error: pendingErr } = await admin
    .from('pending_orders')
    .select('*')
    .eq('razorpay_order_id', input.razorpayOrderId)
    .maybeSingle()
  if (pendingErr || !pending) {
    return { ok: false, status: 404, error: 'No matching pending order' }
  }

  if (pending.status === 'fulfilled') {
    return { ok: false, status: 409, error: 'Pending order already fulfilled' }
  }

  if (input.capturedCurrency !== pending.currency) {
    return { ok: false, status: 400, error: 'Currency mismatch' }
  }
  if (input.paidAmountPaise !== pending.expected_amount_paise) {
    return { ok: false, status: 400, error: 'Amount mismatch' }
  }

  // Atomic create-order + decrement stock via RPC (see supabase/security.sql).
  const { data, error } = await admin.rpc('finalise_paid_order', {
    p_razorpay_order_id: input.razorpayOrderId,
    p_razorpay_payment_id: input.razorpayPaymentId,
  })
  if (error || !data) {
    console.error('[finaliseRazorpayOrder] RPC error:', error?.message)
    return { ok: false, status: 500, error: 'Order finalisation failed' }
  }

  // RPC returns the inserted order id (uuid).
  const orderId = String(data)

  // Mirror the snapshot's shipping_fee onto the orders row so the invoice and
  // any reports show the real fee the customer paid. finalise_paid_order only
  // copies the total — we set this column separately.
  if (pending.shipping_fee && Number(pending.shipping_fee) > 0) {
    await admin
      .from('orders')
      .update({ shipping_cost: Number(pending.shipping_fee) })
      .eq('id', orderId)
  }

  // Trigger confirmation email in the background
  triggerOrderConfirmationEmail(orderId).catch(err => {
    console.error('[finaliseRazorpayOrder] Email trigger failed:', err)
  })

  return { ok: true, orderId }
}
