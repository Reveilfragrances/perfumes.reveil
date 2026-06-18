'use client'

import { useState, useEffect, useRef } from 'react'

export interface AppliedCoupon {
    code: string
    discount: number
    couponId: string
}

interface CouponInputProps {
    orderAmount: number
    userId?: string
    onApplied: (coupon: AppliedCoupon | null) => void
}

export function CouponInput({ orderAmount, userId, onApplied }: CouponInputProps) {
    const [code, setCode] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const confettiRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => { if (confettiRef.current) clearTimeout(confettiRef.current) }
    }, [])

    async function handleApply() {
        const trimmed = code.trim().toUpperCase()
        if (!trimmed) return
        setStatus('loading')
        setMessage('')

        try {
            const res = await fetch('/api/coupons/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: trimmed, orderAmount, userId }),
            })
            const data = await res.json()

            if (res.ok && data.valid) {
                const applied = { code: trimmed, discount: data.discount, couponId: data.couponId }
                setAppliedCoupon(applied)
                setStatus('success')
                setMessage(data.message)
                onApplied(applied)
                setShowConfetti(true)
                confettiRef.current = setTimeout(() => setShowConfetti(false), 3500)
            } else {
                setStatus('error')
                setMessage(data.error || 'Invalid coupon')
            }
        } catch {
            setStatus('error')
            setMessage('Could not apply coupon. Please try again.')
        }
    }

    function handleRemove() {
        setAppliedCoupon(null)
        setStatus('idle')
        setMessage('')
        setCode('')
        onApplied(null)
    }

    return (
        <div style={{ position: 'relative', marginTop: '8px' }}>
            {showConfetti && <Confetti />}

            <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#d4af37', margin: '0 0 12px' }}>
                Have a coupon code?
            </p>

            {status !== 'success' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                        placeholder="Enter code"
                        disabled={status === 'loading'}
                        style={{
                            flex: 1,
                            border: '1px solid rgba(0,0,0,0.15)',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            outline: 'none',
                            background: '#fff',
                            color: '#1a1a1a',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={status === 'loading' || !code.trim()}
                        style={{
                            background: '#1a1a1a',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 18px',
                            fontSize: '9px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em',
                            cursor: status === 'loading' || !code.trim() ? 'not-allowed' : 'pointer',
                            opacity: status === 'loading' || !code.trim() ? 0.5 : 1,
                        }}
                    >
                        {status === 'loading' ? '...' : 'Apply'}
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #16a34a', background: 'rgba(22,163,74,0.06)', padding: '12px 14px' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>🏷️ {appliedCoupon?.code}</div>
                        <div style={{ fontSize: '11px', color: '#16a34a' }}>−₹{appliedCoupon?.discount} saved</div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemove}
                        style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                        Remove
                    </button>
                </div>
            )}

            {status === 'error' && message && (
                <p style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#dc2626' }}>{message}</p>
            )}
        </div>
    )
}

// Lightweight CSS confetti — no external library.
function Confetti() {
    const colors = ['#ffd700', '#ff6b6b', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8']
    const pieces = Array.from({ length: 40 }, (_, i) => i)

    return (
        <>
            <style>{`
                @keyframes reveilConfettiFall {
                    0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                .reveil-confetti-piece {
                    position: fixed;
                    top: 0;
                    pointer-events: none;
                    z-index: 9999;
                    animation: reveilConfettiFall linear forwards;
                }
            `}</style>
            {pieces.map((i) => (
                <div
                    key={i}
                    className="reveil-confetti-piece"
                    style={{
                        left: `${(i * 2.5) % 100}vw`,
                        width: `${6 + (i % 4) * 2}px`,
                        height: `${6 + (i % 3) * 2}px`,
                        background: colors[i % colors.length],
                        borderRadius: i % 2 ? '50%' : '2px',
                        animationDelay: `${(i % 5) * 0.08}s`,
                        animationDuration: `${1 + (i % 4) * 0.4}s`,
                    }}
                />
            ))}
        </>
    )
}
