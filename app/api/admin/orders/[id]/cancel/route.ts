import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validators'
import { cancelShiprocketOrder } from '@/lib/shiprocket'

/**
 * Admin "Cancel Order" endpoint.
 *
 * Cancels in both places so admin never has to touch the Shiprocket dashboard:
 *   1. If the order is in Shiprocket (has shiprocket_order_id) → call
 *      Shiprocket /orders/cancel (and /orders/cancel/shipment/awbs if an AWB
 *      was already assigned).
 *   2. Always mark the local order row as cancelled.
 *
 * If Shiprocket cancel fails (e.g. order already picked up), we still cancel
 * locally and return a warning so the admin sees why — they can then call
 * Shiprocket support to reconcile.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!isUuid(id)) {
        return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: order, error: readErr } = await admin
        .from('orders')
        .select('id, status, shiprocket_order_id, awb_code')
        .eq('id', id)
        .single()

    if (readErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const currentStatus = String(order.status).toLowerCase()
    if (currentStatus === 'cancelled') {
        return NextResponse.json({ success: true, alreadyCancelled: true })
    }
    if (currentStatus === 'delivered' || currentStatus === 'returned') {
        return NextResponse.json(
            { error: `Order is already ${currentStatus}. Use a return flow instead.` },
            { status: 409 },
        )
    }

    // Step 1 — Shiprocket cancel (only if the order ever made it there)
    let shiprocketWarning: string | null = null
    if (order.shiprocket_order_id) {
        const result = await cancelShiprocketOrder({
            shiprocketOrderId: order.shiprocket_order_id,
            awbCode: order.awb_code,
        })
        if (!result.ok) {
            // Don't abort — still cancel locally so the customer doesn't see
            // a phantom "active" order. Just warn the admin.
            shiprocketWarning =
                result.reason ||
                'Shiprocket cancellation failed. Order cancelled locally; reconcile in the Shiprocket dashboard if needed.'
            console.error('[admin cancel] Shiprocket cancel failed:', result)
        }
    }

    // Step 2 — local DB cancel
    const { error: updErr } = await admin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id)

    if (updErr) {
        return NextResponse.json(
            { error: 'Could not mark order cancelled in database', reason: updErr.message },
            { status: 500 },
        )
    }

    return NextResponse.json({
        success: true,
        ...(shiprocketWarning ? { warning: shiprocketWarning } : {}),
    })
}
