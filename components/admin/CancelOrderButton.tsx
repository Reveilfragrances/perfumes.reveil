'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Cancel is the only manual status transition left. All other transitions
 * (confirmed → processing → shipped → delivered) are driven by real signals
 * (payment capture, Shiprocket push, AWB assignment, delivery webhook), so
 * there is no dropdown to overwrite them.
 */
export default function CancelOrderButton({
    orderId,
    currentStatus,
}: {
    orderId: string
    currentStatus: string
}) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const status = (currentStatus || '').toLowerCase()
    const isTerminal = ['cancelled', 'delivered', 'returned'].includes(status)
    if (isTerminal) return null

    async function cancel() {
        if (!confirm('Cancel this order? This will also cancel the shipment in Shiprocket. This cannot be undone.')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.error || 'Failed to cancel')
            }
            // Shiprocket couldn't cancel (already picked up, etc.) but local
            // DB was cancelled. Show the admin so they can reconcile manually.
            if (data.warning) {
                alert(`Order cancelled locally, but Shiprocket warned: ${data.warning}`)
            }
            router.refresh()
        } catch (err: any) {
            alert(err.message || 'Could not cancel order')
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            disabled={loading}
            onClick={cancel}
            className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider text-red-600 border border-red-200 hover:text-white hover:bg-red-600 hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all"
        >
            {loading ? 'Cancelling…' : 'Cancel'}
        </button>
    )
}
