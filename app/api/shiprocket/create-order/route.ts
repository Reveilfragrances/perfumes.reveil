import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { isUuid } from '@/lib/validators'
import { createShiprocketOrderForOrderId, assignBestCourier } from '@/lib/fulfillment'
import { triggerOrderFulfilledEmail } from '@/lib/utils/email'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: { order_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isUuid(body.order_id)) {
    return NextResponse.json({ error: 'order_id must be a UUID' }, { status: 400 })
  }

  const orderId = body.order_id as string

  try {
    const result = await createShiprocketOrderForOrderId(orderId)

    // Idempotency: the order was already confirmed/pushed to Shiprocket (e.g.
    // the admin clicked twice or refreshed). Do NOT re-assign a courier or
    // re-send the confirmation email — just acknowledge.
    if (result.already_exists) {
      return NextResponse.json({ success: true, ...result, alreadyConfirmed: true })
    }

    // After Shiprocket order creation, auto-assign the cheapest serviceable
    // courier so the customer's email contains a real AWB + tracking link
    // instead of "Being assigned…". This is the same logic an admin would
    // trigger manually from the order detail page — we just do it here so
    // a single click handles the whole flow.
    let courierAssignmentNote: string | null = null
    try {
      if (result.shipment_id) {
        const admin = createAdminClient()
        const { data: orderRow } = await admin
          .from('orders')
          .select('shipping_address, payment_method')
          .eq('id', orderId)
          .single()
        const addr = (orderRow?.shipping_address as any) || {}
        const pincode = addr.pincode || addr.postal_code
        if (pincode) {
          const courier = await assignBestCourier({
            orderId,
            shipmentId: String(result.shipment_id),
            deliveryPincode: String(pincode),
            cod: orderRow?.payment_method === 'cod',
          })
          if (!courier) {
            courierAssignmentNote = 'Shipment created but no courier was serviceable for this pincode. Assign manually from the order detail page.'
          }
        } else {
          courierAssignmentNote = 'Shipment created but no delivery pincode found on the order.'
        }
      }
    } catch (courierErr: any) {
      console.error('[fulfill] Courier auto-assignment failed (non-fatal):', courierErr?.message)
      courierAssignmentNote = `Shipment created but courier auto-assignment failed: ${courierErr?.message}. You can retry from the order detail page.`
    }

    // Send the customer "your order has shipped" email. Now that the AWB is
    // assigned (if courier was serviceable), the email will include the real
    // tracking number and courier name.
    const emailResult = await triggerOrderFulfilledEmail(orderId)

    if (!emailResult.ok) {
      const hint =
        emailResult.reason === 'resend_not_configured'
          ? 'Add RESEND_API_KEY in Vercel env vars and redeploy.'
          : emailResult.reason === 'no_customer_email'
          ? 'Customer has no email on profile and none in auth.users. Add an email manually.'
          : 'See server logs for the upstream Resend error.'
      return NextResponse.json({
        success: true,
        ...result,
        emailWarning: `Fulfilled — but customer email was not sent (${emailResult.reason}).`,
        emailHint: hint,
        ...(courierAssignmentNote ? { courierWarning: courierAssignmentNote } : {}),
      })
    }

    return NextResponse.json({
      success: true,
      ...result,
      emailSent: true,
      ...(courierAssignmentNote ? { courierWarning: courierAssignmentNote } : {}),
    })
  } catch (err: any) {
    const reason = err?.message || 'Failed to create Shiprocket order'
    console.error('Shiprocket API Error:', reason)
    // Admin-only endpoint — safe to surface the real upstream reason.
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}
