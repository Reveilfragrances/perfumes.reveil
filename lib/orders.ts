import { createAdminClient } from '@/lib/supabase/admin'
import { triggerOrderReceivedEmail } from '@/lib/utils/email'
import { getRazorpay } from '@/lib/razorpay'

export type FinalizeInput = {
  razorpayOrderId: string
  razorpayPaymentId: string
  paidAmountPaise: number
  capturedCurrency: string
}

export type FinalizeResult =
  | { ok: true; orderId: string; idempotent?: boolean }
  | { ok: false; status: number; error: string; refunded?: boolean }

/**
 * Attempt a full refund on Razorpay. Returns true if refund was initiated.
 * Best-effort — if Razorpay refund itself fails, we log loudly so the
 * operator can manually refund from the dashboard.
 */
async function refundRazorpayPayment(paymentId: string, amountPaise: number, reason: string): Promise<boolean> {
  try {
    const rp = getRazorpay()
    // `payments.refund` returns a refund object on success; throws on failure.
    await (rp.payments as any).refund(paymentId, {
      amount: amountPaise,
      notes: { reason },
    })
    console.warn(`[finaliseRazorpayOrder] Refunded ${paymentId} (${amountPaise} paise). Reason: ${reason}`)
    return true
  } catch (err: any) {
    console.error(`[finaliseRazorpayOrder] AUTO-REFUND FAILED for ${paymentId}:`, err?.message || err)
    return false
  }
}

/**
 * Finalises a paid Razorpay order by reading the pending_orders snapshot,
 * confirming the captured amount matches, and inserting orders + order_items
 * atomically via a Postgres RPC. Idempotent on razorpay_payment_id (UNIQUE in
 * the orders.payment_id column).
 *
 * Callable from both /api/payment/razorpay/verify (after HMAC check) and the
 * Razorpay webhook (after webhook HMAC check). Whoever calls first wins; the
 * other call returns idempotent: true.
 *
 * If the RPC throws OUT_OF_STOCK (stock went to zero between create-order and
 * payment-captured), we auto-initiate a refund on Razorpay so the customer
 * doesn't have to ask. The refund is also logged loudly so the operator
 * notices and can update inventory.
 */
export async function finaliseRazorpayOrder(input: FinalizeInput): Promise<FinalizeResult> {
  const admin = createAdminClient()

  // Idempotency #1: if we already have an order with this payment_id, return it.
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
    // Pending says fulfilled, but the orders idempotency check above missed —
    // resolve to the actual order via fulfilled_order_id (set inside the RPC).
    if (pending.fulfilled_order_id) {
      return { ok: true, orderId: String(pending.fulfilled_order_id), idempotent: true }
    }
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
    const msg = String(error?.message || '').toLowerCase()
    console.error('[finaliseRazorpayOrder] RPC error:', error?.message)

    // Idempotency #2: if the unique index fired (because /verify and webhook
    // raced), re-read the now-existing order and return success.
    if (msg.includes('orders_payment_id_unique_idx') || msg.includes('duplicate key')) {
      const { data: nowExists } = await admin
        .from('orders').select('id').eq('payment_id', input.razorpayPaymentId).maybeSingle()
      if (nowExists) return { ok: true, orderId: nowExists.id, idempotent: true }
    }

    // Stock went to zero between create-order and payment-captured. Refund
    // the customer automatically so they don't have to chase support.
    if (msg.includes('out_of_stock')) {
      const refunded = await refundRazorpayPayment(
        input.razorpayPaymentId,
        input.paidAmountPaise,
        `out_of_stock razorpay_order=${input.razorpayOrderId}`,
      )
      // Mark the pending row failed so a webhook retry won't refund twice.
      await admin
        .from('pending_orders')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', input.razorpayOrderId)
      return {
        ok: false,
        status: 409,
        error: refunded
          ? 'One of the items just went out of stock. Your payment has been refunded — please allow 5–7 business days.'
          : 'One of the items just went out of stock. Refund could not be initiated automatically — contact support.',
        refunded,
      }
    }

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

  // Clear the cart for cart-checkout flows. Buy-now flows shouldn't touch
  // the cart (the customer hadn't added the item there). We detect buy-now
  // via the snapshot column that create-order populated.
  if (!pending.buy_now_product_id) {
    const { error: cartErr } = await admin
      .from('cart_items')
      .delete()
      .eq('user_id', pending.user_id)
    if (cartErr) {
      console.error('[finaliseRazorpayOrder] Cart clear failed (non-fatal):', cartErr.message)
    }
  }

  // No confirmation email here — that is sent only after an admin reviews and
  // confirms the order. We DO send the "order received — under review" email so
  // the customer knows their paid order landed. This runs once per order (this
  // is the non-idempotent path; idempotent re-entries returned earlier).
  triggerOrderReceivedEmail(orderId).catch(err => {
    console.error('[finaliseRazorpayOrder] Order received email failed (non-fatal):', err)
  })

  return { ok: true, orderId }
}
