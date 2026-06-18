'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Order = {
    id: string
    shipping_provider?: string | null
    shipping_status?: string | null
    shipping_awb?: string | null
    manual_delivery_note?: string | null
}

// iCarry + Manual delivery actions for the admin order detail page. Shiprocket
// continues to be handled by the existing "Confirm Order" button above — this
// panel adds the two new providers without touching that flow.
export default function ShippingActionPanel({ order }: { order: Order }) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [manualNote, setManualNote] = useState('')
    const [result, setResult] = useState<string | null>(null)

    async function handleShip(provider: 'icarry' | 'manual') {
        setLoading(provider)
        setResult(null)
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, manualNote }),
            })
            const data = await res.json()
            if (res.ok) {
                setResult(`✓ Shipped via ${provider}${data.awb ? ` — AWB: ${data.awb}` : ''}`)
                router.refresh()
            } else {
                setResult(`✗ Error: ${data.error || 'Request failed'}`)
            }
        } catch {
            setResult('✗ Request failed. Please try again.')
        }
        setLoading(null)
    }

    // Already shipped via iCarry/Manual → show a read-only summary.
    if (order.shipping_provider && order.shipping_provider !== 'pending' && order.shipping_provider !== 'shiprocket') {
        return (
            <div style={{ marginTop: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>Shipping</h2>
                <div style={{ fontSize: '14px', color: '#475569' }}>
                    Shipped via <strong style={{ textTransform: 'capitalize' }}>{order.shipping_provider}</strong>
                    {order.shipping_awb ? ` — AWB: ${order.shipping_awb}` : ''}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Status: {order.shipping_status || 'processing'}</div>
                {order.manual_delivery_note && (
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>Note: {order.manual_delivery_note}</div>
                )}
            </div>
        )
    }

    const btn: React.CSSProperties = {
        flex: 1,
        borderRadius: '10px',
        padding: '14px 16px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        background: '#fff',
        transition: 'background 0.2s',
    }

    return (
        <div style={{ marginTop: '24px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Alternate Shipping</h2>
            <p style={{ fontSize: '13px', color: '#92400e', marginTop: 0, marginBottom: '18px' }}>
                Use the “Confirm Order” button above to ship via Shiprocket. Or pick an alternate provider here:
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => handleShip('icarry')}
                    disabled={!!loading}
                    style={{ ...btn, border: '1px solid #c4b5fd', color: '#6d28d9', opacity: loading ? 0.5 : 1 }}
                >
                    {loading === 'icarry' ? 'Booking…' : '📦 Ship via iCarry'}
                </button>
                <button
                    onClick={() => handleShip('manual')}
                    disabled={!!loading}
                    style={{ ...btn, border: '1px solid #86efac', color: '#15803d', opacity: loading ? 0.5 : 1 }}
                >
                    {loading === 'manual' ? 'Saving…' : '🚚 Manual Delivery'}
                </button>
            </div>

            <textarea
                rows={2}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Optional manual delivery note (e.g. dispatched via local courier, call 9XXXXXXXXX)"
                style={{ width: '100%', marginTop: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
            />

            {result && (
                <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600, color: result.startsWith('✓') ? '#15803d' : '#dc2626' }}>{result}</p>
            )}
        </div>
    )
}
