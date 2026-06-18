'use client'

import { useEffect, useState } from 'react'

interface Coupon {
    code: string
    type: string
    value: number
    minimum_order_amount: number
}

function couponLabel(c: Coupon): string {
    if (c.type === 'flat') return `Use ${c.code} — ₹${c.value} OFF`
    if (c.type === 'percentage') return `Use ${c.code} — ${c.value}% OFF`
    if (c.type === 'flat_on_minimum')
        return `Use ${c.code} — ₹${c.value} OFF on orders above ₹${c.minimum_order_amount}`
    if (c.type === 'percentage_on_minimum')
        return `Use ${c.code} — ${c.value}% OFF on orders above ₹${c.minimum_order_amount}`
    return `Code: ${c.code}`
}

export function CouponMarquee() {
    const [coupons, setCoupons] = useState<Coupon[]>([])

    useEffect(() => {
        let active = true
        async function fetchCoupons() {
            try {
                const res = await fetch('/api/coupons/active')
                const data = await res.json()
                if (active) setCoupons(Array.isArray(data) ? data : [])
            } catch {
                // silent — marquee is non-critical
            }
        }
        fetchCoupons()
        const interval = setInterval(fetchCoupons, 60_000)
        return () => { active = false; clearInterval(interval) }
    }, [])

    if (coupons.length === 0) return null

    const labels = [...coupons, ...coupons].map(couponLabel)

    return (
        <div style={{ overflow: 'hidden', background: '#1a1a1a', padding: '8px 0' }}>
            <div
                style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'reveilMarqueeScroll 35s linear infinite' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = 'paused')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = 'running')}
            >
                {labels.map((label, i) => (
                    <span
                        key={i}
                        style={{ padding: '0 40px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: '#d4af37' }}
                    >
                        🏷️ {label}
                    </span>
                ))}
            </div>

            <style>{`
                @keyframes reveilMarqueeScroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    )
}
