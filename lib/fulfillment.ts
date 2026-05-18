import { createAdminClient } from '@/lib/supabase/admin'
import { shiprocketFetch } from '@/lib/shiprocket'

/**
 * Build the Shiprocket order payload from an order_id, call Shiprocket,
 * and update the order row with the resulting shiprocket_order_id /
 * shipment_id. This is internal — only call from server code that has
 * already authorised the caller (e.g. payment verify, /api/fulfillment).
 *
 * Uses the service-role client because we trust the caller; do NOT expose
 * this directly as an unauthenticated route.
 */
export async function createShiprocketOrderForOrderId(orderId: string) {
  const admin = createAdminClient()

  const { data: order, error } = await admin
    .from('orders')
    .select(`
      *,
      profiles ( full_name, email, phone ),
      order_items (
        quantity, price,
        products ( name, slug, price )
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) throw new Error('Order not found')

  // Idempotency: if this order is already in Shiprocket, return the existing
  // identifiers instead of pushing a duplicate shipment. Prevents the
  // verify ↔ webhook race from creating two Shiprocket orders for the same
  // payment.
  if (order.shiprocket_order_id) {
    return {
      shiprocket_order_id: order.shiprocket_order_id,
      shipment_id: order.shiprocket_shipment_id,
    }
  }

  const address = (order.shipping_address as any) || {}

  // Shiprocket expects "YYYY-MM-DD HH:mm" (with a space). The default
  // ISO string uses "T" which Shiprocket rejects as "Invalid Data".
  const orderDate = new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' ')

  // Shiprocket expects 10-digit Indian mobile, no +91/91 prefix or spaces.
  const normalizePhone = (raw: unknown): string => {
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
    return digits.slice(-10) // fall back to last 10 digits
  }
  const phone = normalizePhone(address.phone || order.profiles?.phone) || '0000000000'

  const payload = {
    order_id: String(order.id).slice(0, 12).toUpperCase(),
    order_date: orderDate,
    pickup_location: process.env.SHIPROCKET_PICKUP_NAME || 'Primary',

    billing_customer_name: String(address.full_name || address.name || order.profiles?.full_name || 'Customer'),
    billing_address: String(address.address_line1 || address.line1 || address.address || 'Address line missing'),
    billing_address_2: String(address.address_line2 || address.line2 || ''),
    billing_city: String(address.city || 'City missing'),
    billing_pincode: String(address.pincode || address.postal_code || '000000'),
    billing_state: String(address.state || 'State missing'),
    billing_country: 'India',
    billing_email: String(order.profiles?.email || 'email@missing.com'),
    billing_phone: phone,

    shipping_is_billing: true,

    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.total,
    length: 15,
    breadth: 15,
    height: 15,
    weight: 0.5,

    order_items: (order.order_items as any[]).map((item) => ({
      name: item.products?.name || 'Perfume',
      sku: (item.products?.slug || item.products?.name || 'rev-generic').toLowerCase().replace(/\s+/g, '-').slice(0, 50),
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: 0,
    })),
  }

  const data = await shiprocketFetch('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!data?.order_id) {
    throw new Error(data?.message || 'Failed to create Shiprocket order')
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      shiprocket_order_id: String(data.order_id),
      shiprocket_shipment_id: String(data.shipment_id),
      status: 'processing',
    })
    .eq('id', orderId)

  if (updateError) {
    // The Shiprocket order DOES exist upstream, but we failed to persist its
    // IDs locally. Surface this loudly so the operator can manually reconcile —
    // otherwise tracking breaks and the next call would create a duplicate
    // (the idempotency guard above relies on the local row being updated).
    console.error('[fulfillment] CRITICAL — Shiprocket order created but DB update failed:', {
      orderId,
      shiprocket_order_id: data.order_id,
      shipment_id: data.shipment_id,
      error: updateError.message,
    })
    throw new Error(
      `Shiprocket order ${data.order_id} created upstream but local DB update failed: ${updateError.message}. ` +
      `Manual reconciliation needed for order ${orderId}.`
    )
  }

  return { shiprocket_order_id: data.order_id, shipment_id: data.shipment_id }
}
