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
        if (!confirm('Cancel this order? This cannot be undone.')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to cancel')
            }
            router.refresh()
        } catch (err: any) {
            alert(err.message)
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
