import { createAdminClient } from '@/lib/supabase/admin'
import { shiprocketFetch } from '@/lib/shiprocket'

/**
 * Pick the cheapest serviceable courier for a destination and assign AWB.
 * Returns null if no courier is serviceable. Called after order creation so
 * the customer's "your order has shipped" email can include the AWB +
 * courier name (instead of "Being assigned…").
 */
export async function assignBestCourier(opts: {
  orderId: string
  shipmentId: string
  deliveryPincode: string
  cod: boolean
}): Promise<{ awb: string; courier_name: string } | null> {
  const admin = createAdminClient()
  const pickup = process.env.SHIPROCKET_PICKUP_PINCODE || '760009'

  const serviceRes = await shiprocketFetch(
    `/courier/serviceability/?pickup_postcode=${encodeURIComponent(pickup)}&delivery_postcode=${encodeURIComponent(opts.deliveryPincode)}&weight=0.5&cod=${opts.cod ? 1 : 0}`
  )

  const couriers = serviceRes?.data?.available_courier_companies ?? []
  if (couriers.length === 0) {
    console.warn('[assignBestCourier] No couriers serviceable for pincode', opts.deliveryPincode)
    return null
  }
  const best = couriers.sort((a: any, b: any) => Number(a.rate) - Number(b.rate))[0]

  const assignRes = await shiprocketFetch('/courier/assign/awb', {
    method: 'POST',
    body: JSON.stringify({
      shipment_id: opts.shipmentId,
      courier_id: String(best.courier_company_id),
    }),
  })

  const awbData = assignRes?.response?.data
  const awb = (assignRes?.awb_assign_status === 1 || assignRes?.status === 1)
    ? (awbData?.awb_code || assignRes?.awb_code)
    : null

  if (!awb) {
    console.error('[assignBestCourier] AWB assignment failed:', assignRes?.message)
    return null
  }

  await admin
    .from('orders')
    .update({
      awb_code: awb,
      courier_name: best.courier_name,
      status: 'shipped',
    })
    .eq('id', opts.orderId)

  return { awb, courier_name: best.courier_name }
}

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

  // Shiprocket is strict about state names — it expects the exact official
  // Indian state name with proper title case (e.g. "Andhra Pradesh", not
  // "andhra pradesh" or "AP"). Anything else returns "Invalid Data".
  const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
    'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
    'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
  ]
  const STATE_ALIASES: Record<string, string> = {
    ap: 'Andhra Pradesh', ar: 'Arunachal Pradesh', as: 'Assam', br: 'Bihar',
    cg: 'Chhattisgarh', ga: 'Goa', gj: 'Gujarat', hr: 'Haryana', hp: 'Himachal Pradesh',
    jh: 'Jharkhand', ka: 'Karnataka', kl: 'Kerala', mp: 'Madhya Pradesh', mh: 'Maharashtra',
    mn: 'Manipur', ml: 'Meghalaya', mz: 'Mizoram', nl: 'Nagaland', od: 'Odisha', or: 'Odisha',
    pb: 'Punjab', rj: 'Rajasthan', sk: 'Sikkim', tn: 'Tamil Nadu', tg: 'Telangana', ts: 'Telangana',
    tr: 'Tripura', up: 'Uttar Pradesh', uk: 'Uttarakhand', ut: 'Uttarakhand', wb: 'West Bengal',
    dl: 'Delhi', jk: 'Jammu and Kashmir', la: 'Ladakh', ch: 'Chandigarh', py: 'Puducherry',
    pondicherry: 'Puducherry', orissa: 'Odisha', 'jammu & kashmir': 'Jammu and Kashmir',
  }
  const normalizeState = (raw: unknown): string => {
    const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ')
    if (!cleaned) return ''
    const key = cleaned.toLowerCase()
    if (STATE_ALIASES[key]) return STATE_ALIASES[key]
    const match = INDIAN_STATES.find(s => s.toLowerCase() === key)
    if (match) return match
    // Last resort: title-case it so "andhra pradesh" → "Andhra Pradesh".
    return cleaned.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ')
  }
  const cleanStr = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ')

  const payload = {
    order_id: String(order.id).slice(0, 12).toUpperCase(),
    order_date: orderDate,
    pickup_location: process.env.SHIPROCKET_PICKUP_NAME || 'Primary',

    billing_customer_name: cleanStr(address.full_name || address.name || order.profiles?.full_name) || 'Customer',
    billing_address: cleanStr(address.address_line1 || address.line1 || address.address) || 'Address line missing',
    billing_address_2: cleanStr(address.address_line2 || address.line2),
    billing_city: cleanStr(address.city) || 'City missing',
    billing_pincode: cleanStr(address.pincode || address.postal_code) || '000000',
    billing_state: normalizeState(address.state) || 'State missing',
    billing_country: 'India',
    billing_email: cleanStr(order.profiles?.email) || 'email@missing.com',
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
    // Shiprocket's `errors` is usually { field_name: ["reason", ...], ... }.
    // Flatten it into a human-readable list so the admin sees exactly which
    // field is failing ("billing_phone: must be 10 digits") instead of a
    // useless "Invalid Data".
    let fieldDetail = ''
    if (data?.errors && typeof data.errors === 'object') {
      const parts: string[] = []
      for (const [field, msgs] of Object.entries(data.errors as Record<string, unknown>)) {
        const list = Array.isArray(msgs) ? msgs : [msgs]
        parts.push(`${field}: ${list.join(', ')}`)
      }
      if (parts.length) fieldDetail = ` — ${parts.join(' | ')}`
    }
    const baseMsg = data?.message || 'Failed to create Shiprocket order'
    // Also log the payload we sent (with phone masked) so we can see which
    // input Shiprocket disliked.
    console.error('[fulfillment] Shiprocket rejected payload:', JSON.stringify({
      ...payload,
      billing_phone: payload.billing_phone ? `***${String(payload.billing_phone).slice(-4)}` : payload.billing_phone,
    }, null, 2))
    throw new Error(`${baseMsg}${fieldDetail}`)
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
