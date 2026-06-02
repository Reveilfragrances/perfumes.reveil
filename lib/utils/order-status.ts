/**
 * Derives the display status of an order from REAL signals only:
 *   - DB status (set by /api/payment/razorpay/verify, /api/orders, the
 *     Shiprocket trigger, and the delivery webhook)
 *   - payment_status
 *   - shiprocket_order_id (set when the order has been pushed to Shiprocket)
 *   - awb_code (set when a courier has been assigned and the order is shipped)
 *
 * Never advances based on wall-clock time — an order will not show "shipped"
 * unless an actual shipping signal exists.
 */
export type OrderForStatus = {
    status?: string | null
    payment_status?: string | null
    payment_method?: string | null
    shiprocket_order_id?: string | null
    awb_code?: string | null
}

export function getDisplayStatus(order: OrderForStatus | null | undefined): string {
    if (!order) return 'pending'
    const raw = (order.status || '').toLowerCase()

    // Terminal states from delivery webhook / admin cancel — always win.
    if (raw === 'delivered') return 'delivered'
    if (raw === 'cancelled') return 'cancelled'
    if (raw === 'returned') return 'returned'
    if (raw === 'return_initiated') return 'return initiated'
    if (raw === 'failed_delivery') return 'delivery failed'
    if (raw === 'out_for_delivery') return 'out for delivery'

    // Shipped: an AWB exists (courier picked up the parcel).
    if (order.awb_code) return 'shipped'

    // Processing: pushed to Shiprocket but courier not assigned yet.
    if (order.shiprocket_order_id) return 'processing'

    // Not yet pushed to Shiprocket → the order is awaiting admin review. This
    // covers both COD ('pending') and paid Razorpay ('confirmed') orders: they
    // only move forward once an admin reviews and confirms them in the panel.
    return 'pending approval'
}

// Backwards-compatible alias for any caller still using the old name.
export const getAutomaticStatus = (status: string, _createdAt?: string) =>
    getDisplayStatus({ status })
