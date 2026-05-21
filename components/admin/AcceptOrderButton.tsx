'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Two-factor-style approval gate for admin orders.
 *
 * Pending → click Accept → status becomes 'confirmed' → Fulfill button
 * appears in the next render. Reload triggered after success so the table
 * re-fetches the new status.
 */
export default function AcceptOrderButton({ orderId }: { orderId: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)

    async function handleAccept() {
        if (status === 'loading' || status === 'success') return

        const ok = window.confirm('Accept this order? It will move to "Confirmed" and the Fulfill button will become available.')
        if (!ok) return

        setStatus('loading')
        setError(null)

        try {
            const res = await fetch(`/api/admin/orders/${orderId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.error || 'Accept failed')
            }
            setStatus('success')
            setTimeout(() => window.location.reload(), 800)
        } catch (err: any) {
            console.error('[AcceptOrderButton] Error:', err)
            setError(err.message || 'Unknown error')
            setStatus('error')
            setTimeout(() => {
                setStatus('idle')
                setError(null)
            }, 5000)
        }
    }

    return (
        <div className="relative w-full">
            <button
                onClick={handleAccept}
                disabled={status === 'loading' || status === 'success'}
                title={error || 'Accept this order'}
                className={cn(
                    'flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 whitespace-nowrap border',
                    status === 'idle' && 'text-amber-800 bg-amber-50 border-amber-300 hover:text-white hover:bg-amber-600 hover:border-amber-600 cursor-pointer',
                    status === 'loading' && 'text-blue-600 bg-blue-50 border-blue-100 cursor-wait',
                    status === 'success' && 'text-emerald-600 bg-emerald-50 border-emerald-100 cursor-default',
                    status === 'error' && 'text-red-600 bg-red-50 border-red-200 cursor-pointer',
                )}
            >
                {status === 'loading' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : status === 'success' ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-3 h-3 shrink-0" />
                ) : (
                    <Check className="w-3 h-3 shrink-0" />
                )}
                <span>
                    {status === 'loading'
                        ? 'Accepting'
                        : status === 'success'
                        ? 'Accepted'
                        : status === 'error'
                        ? 'Retry'
                        : 'Accept'}
                </span>
            </button>

            {error && status === 'error' && (
                <div className="absolute top-full left-0 mt-1 z-20 max-w-[240px] rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-medium leading-snug text-red-700 shadow-md">
                    {error}
                </div>
            )}
        </div>
    )
}
