import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { bookIcarryShipment } from '@/lib/shipping/icarry'

type Params = Promise<{ id: string }>

// POST — book a shipment via the chosen provider.
// provider: 'icarry' | 'manual' (Shiprocket continues to use the existing
// Confirm Order flow and is intentionally not duplicated here).
export async function POST(req: Request, { params }: { params: Params }) {
    const { id } = await params
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { provider, manualNote } = body || {}

    const admin = createAdminClient()
    const { data: order } = await admin
        .from('orders')
        .select(`
            *,
            order_items ( quantity, price, products ( name ) )
        `)
        .eq('id', id)
        .single()

    if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const addr = (order.shipping_address as any) || {}

    if (provider === 'icarry') {
        try {
            const result = await bookIcarryShipment({
                orderId: order.id,
                customerName: addr.full_name || 'Customer',
                customerPhone: addr.phone || '',
                shippingAddress: {
                    line1: [addr.address_line1, addr.address_line2].filter(Boolean).join(', '),
                    city: addr.city || '',
                    state: addr.state || '',
                    pincode: addr.pincode || '',
                },
                items: (order.order_items || []).map((it: any) => ({
                    name: it.products?.name || 'Item',
                    quantity: it.quantity,
                    price: it.price,
                })),
                totalAmount: order.total,
                paymentMethod: order.payment_method,
                weight: order.weight || 0.5,
            })

            const awb = result.awb || result.tracking_number || result.shipment_id || null
            const labelUrl = result.label_url || result.label || null

            await admin
                .from('orders')
                .update({
                    shipping_provider: 'icarry',
                    icarry_awb: awb,
                    shipping_awb: awb,
                    shipping_label_url: labelUrl,
                    shipping_status: 'processing',
                })
                .eq('id', id)

            return NextResponse.json({ success: true, awb, provider: 'icarry' })
        } catch (err: any) {
            console.error('[ship/icarry]', err?.message)
            return NextResponse.json({ error: err?.message || 'iCarry booking failed' }, { status: 502 })
        }
    }

    if (provider === 'manual') {
        await admin
            .from('orders')
            .update({
                shipping_provider: 'manual',
                shipping_status: 'processing',
                manual_delivery_note: manualNote || 'Order dispatched manually',
            })
            .eq('id', id)

        return NextResponse.json({ success: true, provider: 'manual' })
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
}
