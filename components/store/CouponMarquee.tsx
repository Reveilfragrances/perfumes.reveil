'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

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

const chipStyle: CSSProperties = {
    padding: '0 40px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: '#d4af37',
    flexShrink: 0,
}

// Constant scroll speed (px/sec) — duration is derived from content width so a
// short list and a long list scroll at the same comfortable pace.
const SPEED_PX_PER_SEC = 60

export function CouponMarquee() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    // How many times to repeat the full label set per "half" of the track. We
    // need one half to be at least as wide as the viewport so the -50% loop
    // never reveals empty space. Start at 3 so there's no blank flash before
    // the first measurement runs.
    const [copies, setCopies] = useState(3)
    const [durationSec, setDurationSec] = useState(35)

    const containerRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)

    // Fetch active coupons and refresh every minute so newly-added ones appear.
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

    // Recompute repeat count + duration whenever the coupon set changes or the
    // window resizes, so the strip always overflows the width (no blank) and
    // keeps a steady speed.
    useEffect(() => {
        if (coupons.length === 0) return
        function compute() {
            const containerW = containerRef.current?.offsetWidth || 0
            const oneSetW = measureRef.current?.offsetWidth || 0
            if (containerW > 0 && oneSetW > 0) {
                // +1 guarantees a half-track strictly wider than the viewport.
                const needed = Math.max(1, Math.ceil(containerW / oneSetW) + 1)
                setCopies(needed)
                const halfWidth = oneSetW * needed
                setDurationSec(Math.max(15, Math.round(halfWidth / SPEED_PX_PER_SEC)))
            }
        }
        compute()
        window.addEventListener('resize', compute)
        return () => window.removeEventListener('resize', compute)
    }, [coupons])

    if (coupons.length === 0) return null

    const labels = coupons.map(couponLabel)
    // Two identical halves of `copies` label-sets each → animating to -50%
    // lands exactly on the start of the second half = seamless infinite loop.
    const totalSets = copies * 2

    return (
        <div ref={containerRef} style={{ overflow: 'hidden', background: '#1a1a1a', padding: '8px 0' }}>
            {/* Hidden single set used only to measure one set's width. */}
            <div
                ref={measureRef}
                aria-hidden
                style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', display: 'inline-flex', pointerEvents: 'none' }}
            >
                {labels.map((label, i) => (
                    <span key={`m-${i}`} style={chipStyle}>🏷️ {label}</span>
                ))}
            </div>

            <div
                style={{
                    display: 'flex',
                    width: 'max-content',
                    whiteSpace: 'nowrap',
                    animation: `reveilMarqueeScroll ${durationSec}s linear infinite`,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = 'paused')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = 'running')}
            >
                {Array.from({ length: totalSets }).flatMap((_, setIdx) =>
                    labels.map((label, i) => (
                        <span key={`${setIdx}-${i}`} style={chipStyle}>🏷️ {label}</span>
                    ))
                )}
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
