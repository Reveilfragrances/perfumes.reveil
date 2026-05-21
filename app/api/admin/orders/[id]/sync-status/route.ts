import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validators'
import { shiprocketFetch } from '@/lib/shiprocket'

/**
 * Pull live tracking data for a single order from Shiprocket and update the
 * local DB row. Lets the admin force-refresh an order's status without
 * waiting for the webhook (useful when the webhook misfires or a fresh
 * pickup scan needs to be reflected immediately).
 *
 * Maps Shiprocket "current_status" → our internal status, same vocabulary
 * the delivery webhook uses.
 */
const STATUS_MAP: Record<string, string> = {
    'Picked Up':          'shipped',
    'In Transit':         'shipped',
    'Out For Delivery':   'out_for_delivery',
    'Delivered':          'delivered',
    'Undelivered':        'failed_delivery',
    'Cancelled':          'cancelled',
    'RTO Initiated':      'return_initiated',
    'RTO Delivered':      'returned',
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!isUuid(id)) {
        return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: order } = await admin
        .from('orders')
        .select('id, status, awb_code, courier_name, shiprocket_order_id')
        .eq('id', id)
        .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Without an AWB we can't query Shiprocket for tracking. Return early
    // with a clear reason so the admin knows what to do.
    if (!order.awb_code) {
        return NextResponse.json({
            ok: false,
            reason: order.shiprocket_order_id
                ? 'Order is in Shiprocket but has no AWB yet. Assign a courier first.'
                : 'Order has not been shipped yet — nothing to sync from Shiprocket.',
        })
    }

    try {
        const tracking = await shiprocketFetch(`/courier/track/awb/${order.awb_code}`)
        // Shiprocket nests the real payload under different keys depending on
        // the AWB state. Walk the common shapes.
        const trackingData = tracking?.tracking_data || tracking
        const shipmentStatus =
            trackingData?.shipment_track?.[0]?.current_status ||
            trackingData?.track_status_label ||
            trackingData?.current_status ||
            null

        const mapped = shipmentStatus ? STATUS_MAP[shipmentStatus] : null

        const updates: Record<string, any> = {}
        if (mapped && mapped !== order.status) updates.status = mapped
        // Some accounts only return courier name in the tracking response —
        // backfill it if we don't have it yet locally.
        const remoteCourier =
            trackingData?.shipment_track?.[0]?.courier_name ||
            trackingData?.courier_name
        if (remoteCourier && !order.courier_name) updates.courier_name = remoteCourier

        if (Object.keys(updates).length > 0) {
            const { error: updErr } = await admin.from('orders').update(updates).eq('id', id)
            if (updErr) {
                return NextResponse.json(
                    { ok: false, reason: updErr.message },
                    { status: 500 },
                )
            }
        }

        return NextResponse.json({
            ok: true,
            shiprocketStatus: shipmentStatus,
            mappedStatus: mapped || order.status,
            updated: Object.keys(updates),
            tracking: trackingData,
        })
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, reason: err?.message || 'Shiprocket lookup failed' },
            { status: 500 },
        )
    }
}
