'use client'

import { useState } from 'react'
import { Truck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FulfillButtonProps {
    orderId: string
    isFulfilled: boolean
}

export default function FulfillButton({ orderId, isFulfilled }: FulfillButtonProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(isFulfilled ? 'success' : 'idle')
    const [error, setError] = useState<string | null>(null)

    async function handleFulfill() {
        if (status === 'loading' || status === 'success') return

        setStatus('loading')
        setError(null)

        try {
            const res = await fetch('/api/shiprocket/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Fulfillment failed')
            }

            setStatus('success')
            setTimeout(() => window.location.reload(), 1200)
        } catch (err: any) {
            console.error('Shiprocket Error:', err)
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
                onClick={handleFulfill}
                disabled={status === 'loading' || status === 'success'}
                title={error || 'Fulfill via Shiprocket'}
                className={cn(
                    "flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 whitespace-nowrap border",
                    status === 'idle' && "text-gray-700 bg-gray-50 border-gray-200 hover:text-white hover:bg-black hover:border-black cursor-pointer",
                    status === 'loading' && "text-blue-600 bg-blue-50 border-blue-100 cursor-wait",
                    status === 'success' && "text-emerald-600 bg-emerald-50 border-emerald-100 cursor-default",
                    status === 'error' && "text-red-600 bg-red-50 border-red-200 cursor-pointer",
                )}
            >
                {status === 'loading' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : status === 'success' ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-3 h-3 shrink-0" />
                ) : (
                    <Truck className="w-3 h-3 shrink-0" />
                )}
                <span>
                    {status === 'loading'
                        ? 'Sending'
                        : status === 'success'
                        ? 'Fulfilled'
                        : status === 'error'
                        ? 'Retry'
                        : 'Fulfill'}
                </span>
            </button>

            {/* Compact error tooltip — absolute so it doesn't push table layout around */}
            {error && status === 'error' && (
                <div
                    className="absolute top-full left-0 mt-1 z-20 max-w-[240px] rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-medium leading-snug text-red-700 shadow-md"
                >
                    {error}
                </div>
            )}
        </div>
    )
}
