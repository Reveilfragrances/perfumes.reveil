'use client'

import { useState } from 'react'
import { Truck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Admin "Confirm & Ship Order" action — the approval step of the review flow.
 *
 * Clicking it pushes the order to Shiprocket (creates the shipment, assigns the
 * cheapest serviceable courier) and sends the customer their order confirmation
 * email. This is the ONLY place a shipment is created — orders are never
 * auto-confirmed at placement.
 *
 * Rendered only while the order is awaiting approval (not yet in Shiprocket and
 * not in a terminal state).
 */
export default function ConfirmOrderButton({
    orderId,
    currentStatus,
    shiprocketOrderId,
}: {
    orderId: string
    currentStatus: string
    shiprocketOrderId: string | null
}) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)

    const s = (currentStatus || '').toLowerCase()
    // Already confirmed (in Shiprocket) or terminal → nothing to confirm.
    if (shiprocketOrderId || ['cancelled', 'delivered', 'returned'].includes(s)) return null

    async function confirm() {
        if (status === 'loading' || status === 'success') return
        if (!window.confirm('Confirm this order? This will create the shipment in Shiprocket and email the customer their order confirmation.')) return

        setStatus('loading')
        setError(null)
        try {
            const res = await fetch('/api/shiprocket/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to confirm order')

            const warnings: string[] = []
            if (data.courierWarning) warnings.push(`Courier: ${data.courierWarning}`)
            if (data.emailWarning) warnings.push(`Email: ${data.emailWarning}\n${data.emailHint || ''}`)
            if (warnings.length > 0) alert(warnings.join('\n\n'))

            setStatus('success')
            setTimeout(() => window.location.reload(), 1000)
        } catch (err: any) {
            console.error('[ConfirmOrderButton] Error:', err)
            setError(err.message || 'Unknown error')
            setStatus('error')
            setTimeout(() => { setStatus('idle'); setError(null) }, 5000)
        }
    }

    return (
        <button
            onClick={confirm}
            disabled={status === 'loading' || status === 'success'}
            title={error || 'Confirm and ship this order'}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: status === 'loading' || status === 'success' ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                color: '#fff',
                background:
                    status === 'success' ? '#059669'
                    : status === 'error' ? '#dc2626'
                    : '#16a34a',
            }}
        >
            {status === 'loading' ? <Loader2 className="animate-spin" size={15} />
                : status === 'success' ? <CheckCircle2 size={15} />
                : status === 'error' ? <AlertCircle size={15} />
                : <Truck size={15} />}
            {status === 'loading' ? 'Confirming…'
                : status === 'success' ? 'Confirmed'
                : status === 'error' ? (error || 'Retry')
                : 'Confirm & Ship Order'}
        </button>
    )
}
