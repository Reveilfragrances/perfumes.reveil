'use client'

import React, { useState } from 'react'
import { Mail, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ResendConfirmationButton({ orderId }: { orderId: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

    const handleResend = async () => {
        if (status === 'loading') return
        setStatus('loading')

        try {
            const res = await fetch('/api/admin/orders/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            })

            if (!res.ok) throw new Error('Failed to resend')
            
            setStatus('success')
            setTimeout(() => setStatus('idle'), 3000)
        } catch (err) {
            console.error(err)
            setStatus('error')
            setTimeout(() => setStatus('idle'), 3000)
        }
    }

    return (
        <button
            onClick={handleResend}
            disabled={status === 'loading'}
            className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border",
                status === 'idle' && "text-gray-600 border-gray-200 hover:text-[#a8851e] hover:bg-[#d4af37]/10 hover:border-[#d4af37]/40",
                status === 'loading' && "text-blue-600 bg-blue-50 border-blue-100",
                status === 'success' && "text-emerald-600 bg-emerald-50 border-emerald-100",
                status === 'error' && "text-red-600 bg-red-50 border-red-200"
            )}
            title="Resend Order Confirmation Email"
        >
            {status === 'loading' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : status === 'success' ? (
                <Check className="w-3 h-3" />
            ) : (
                <Mail className="w-3 h-3" />
            )}
            {status === 'loading' ? 'Sending...' : status === 'success' ? 'Sent' : status === 'error' ? 'Error' : 'Resend'}
        </button>
    )
}
