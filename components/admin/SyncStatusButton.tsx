'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Force-refresh an order's status from Shiprocket.
 *
 * Polls Shiprocket /courier/track/awb/{awb} for the freshest status, maps it
 * to our internal vocabulary, and updates the DB. Admin can hit this if they
 * don't want to wait for the webhook (or if the webhook missed an event).
 */
export default function SyncStatusButton({
    orderId,
    awbCode,
}: {
    orderId: string
    awbCode?: string | null
}) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const router = useRouter()

    // Without an AWB, sync is pointless — Shiprocket has nothing to report.
    if (!awbCode) return null

    async function handleSync() {
        if (status === 'loading') return
        setStatus('loading')
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/sync-status`, {
                method: 'POST',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.ok) {
                throw new Error(data.reason || data.error || 'Sync failed')
            }
            setStatus('success')
            // Refresh server-rendered table so the new status shows up.
            router.refresh()
            setTimeout(() => setStatus('idle'), 2000)
        } catch (err: any) {
            console.error('[SyncStatusButton]', err)
            setStatus('error')
            setTimeout(() => setStatus('idle'), 3000)
        }
    }

    return (
        <button
            onClick={handleSync}
            disabled={status === 'loading'}
            title="Refresh status from Shiprocket"
            className={cn(
                'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-all',
                status === 'idle' && 'text-gray-500 bg-white border-gray-200 hover:text-[#8a6d18] hover:bg-[#d4af37]/10 hover:border-[#d4af37]/40',
                status === 'loading' && 'text-blue-600 bg-blue-50 border-blue-100 cursor-wait',
                status === 'success' && 'text-emerald-600 bg-emerald-50 border-emerald-100',
                status === 'error' && 'text-red-600 bg-red-50 border-red-200',
            )}
        >
            {status === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : status === 'success' ? (
                <Check className="w-3.5 h-3.5" />
            ) : status === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5" />
            ) : (
                <RefreshCw className="w-3.5 h-3.5" />
            )}
        </button>
    )
}
