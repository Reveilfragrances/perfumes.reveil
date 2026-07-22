'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product } from '@/types/store'
import { ShoppingBag, ArrowLeft, Star, Loader2, Check, MapPin, X as XIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ReviewsSection } from '@/components/store/ReviewsSection'
import { ReviewInvitation } from '@/components/store/ReviewInvitation'
import ProductCard from '@/components/store/ProductCard'
import { createClient } from '@/lib/supabase/client'
import { isOdishaPincode } from '@/lib/validators'

interface ProductContentProps {
    product: Product
    initialReviews: any[]
    relatedProducts?: Product[]
}

// Renders an admin-authored description while preserving its formatting:
// blank lines split paragraphs, lines beginning with •/-/* become a bullet
// list, and single newlines stay as line breaks. Emojis render as-is.
function FormattedDescription({ text }: { text: string }) {
    // Put each "•" bullet on its own line so copy that uses inline bullets
    // (e.g. "… fragrance • Best white oud …") still lists cleanly.
    const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\s*•\s*/g, '\n• ')
        .split('\n')

    const pStyle = {
        fontSize: '14px', lineHeight: 1.7, color: '#888',
        fontFamily: 'var(--font-tenor)', maxWidth: '480px',
        margin: '0 0 14px', fontWeight: 300,
    } as const

    const blocks: any[] = []
    let para: string[] = []
    let bullets: string[] = []

    const flushPara = () => {
        if (!para.length) return
        const content = para.flatMap((l, i) => (i === 0 ? [l] : [<br key={`br-${i}`} />, l]))
        blocks.push(<p key={`p-${blocks.length}`} style={pStyle}>{content}</p>)
        para = []
    }
    const flushBullets = () => {
        if (!bullets.length) return
        blocks.push(
            <ul key={`u-${blocks.length}`} style={{ ...pStyle, paddingLeft: '20px', listStyle: 'disc' }}>
                {bullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: '6px', lineHeight: 1.6 }}>{b}</li>
                ))}
            </ul>
        )
        bullets = []
    }

    for (const raw of lines) {
        const t = raw.trim()
        if (t === '') { flushPara(); flushBullets(); continue }
        const m = t.match(/^[•\-*▪◦·]\s+(.*)$/)
        if (m) { flushPara(); bullets.push(m[1]) }
        else { flushBullets(); para.push(t) }
    }
    flushPara()
    flushBullets()

    return <div>{blocks}</div>
}

export function ProductContent({ product, initialReviews, relatedProducts = [] }: ProductContentProps) {
    const router = useRouter()
    const supabase = createClient()
    const [isMobile, setIsMobile] = useState(false)
    const [reviews, setReviews] = useState(initialReviews)
    // Keep the displayed list in sync after router.refresh() (e.g. once a new
    // review is submitted) — otherwise the state stays frozen at its seed value.
    useEffect(() => {
        setReviews(initialReviews)
    }, [initialReviews])
    // Admin-managed list of available sizes. Falls back to the legacy
     // [50ML, 100ML] when a product hasn't had sizes configured yet.
    const availableSizes: string[] = (() => {
        const raw = product.technical_specs?.sizes
        if (Array.isArray(raw) && raw.length > 0) return raw.map((s: any) => String(s).trim()).filter(Boolean)
        return ['50ML', '100ML']
    })()
    const [selectedVolume, setSelectedVolume] = useState(
        product.technical_specs?.volume || availableSizes[0] || '100ML'
    )
    const [adding, setAdding] = useState(false)
    const [added, setAdded] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    // Image carousel state — supports multiple images uploaded from admin panel.
    const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&q=80&w=1200'
    const galleryImages: string[] = (product.images && product.images.length > 0) ? product.images : [FALLBACK_IMAGE]
    const [currentImage, setCurrentImage] = useState(0)
    const touchStartX = useRef<number | null>(null)

    const goNext = () => setCurrentImage((i) => (i + 1) % galleryImages.length)
    const goPrev = () => setCurrentImage((i) => (i - 1 + galleryImages.length) % galleryImages.length)

    const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current == null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        if (Math.abs(dx) > 50) { dx < 0 ? goNext() : goPrev() }
        touchStartX.current = null
    }

    // Pincode delivery check — Reveil ships pan-India. Any valid 6-digit
    // Indian pincode is accepted. India Post API enriches with the area name
    // and state when reachable; network failures fall back to "deliverable".
    const [pincode, setPincode] = useState('')
    const [pinChecking, setPinChecking] = useState(false)
    const [pinResult, setPinResult] = useState<
        | { ok: true; area: string; district: string }
        | { ok: false; reason: string }
        | null
    >(null)

    const checkPincode = async () => {
        const pin = pincode.trim()
        setPinResult(null)
        if (!isOdishaPincode(pin)) {
            setPinResult({ ok: false, reason: 'Enter a valid 6-digit Indian pincode.' })
            return
        }

        setPinChecking(true)
        try {
            const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
            const data = await res.json()
            const entry = Array.isArray(data) ? data[0] : null
            const office = entry?.PostOffice?.[0]
            if (entry?.Status === 'Success' && office) {
                setPinResult({
                    ok: true,
                    area: office.Name || office.Block || pin,
                    district: [office.District || office.Division, office.State].filter(Boolean).join(', '),
                })
            } else {
                // API didn't find it — accept based on valid prefix check
                setPinResult({ ok: true, area: '', district: '' })
            }
        } catch {
            // Network failure — trust the prefix check we already did
            setPinResult({ ok: true, area: '', district: '' })
        } finally {
            setPinChecking(false)
        }
    }

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleAction = async (type: 'cart' | 'buy') => {
        if (adding) return
        setActionError(null)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            const next = type === 'buy'
                ? `/checkout?buyNow=${product.id}&qty=1`
                : `/products/${product.slug}`
            router.push(`/auth?next=${encodeURIComponent(next)}`)
            return
        }

        // BUY NOW — bypass the cart entirely so the existing cart isn't touched
        if (type === 'buy') {
            router.push(`/checkout?buyNow=${product.id}&qty=1`)
            return
        }

        setAdding(true)
        try {
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: product.id, quantity: 1 }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Could not add to cart')
            }
            window.dispatchEvent(new Event('cart-updated'))
            setAdded(true)
            setTimeout(() => setAdded(false), 1800)
        } catch (err: any) {
            setActionError(err.message || 'Something went wrong')
        } finally {
            setAdding(false)
        }
    }

    return (
        <main style={{
            background: '#f8f7f2',
            minHeight: '100vh',
            color: '#1a1a1a',
            position: 'relative',
            padding: isMobile ? '120px 24px 60px' : '140px 80px 60px',
            overflowX: 'hidden',
            maxWidth: '100vw',
            boxSizing: 'border-box'
        }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '32px' : '64px',
                alignItems: 'flex-start',
                maxWidth: '1280px',
                margin: '0 auto'
            }}>
                {/* Left: Balanced Image Container */}
                <div style={{ position: 'relative', width: isMobile ? '100%' : '44%', flex: 'none' }}>
                    {/* Background Glow Effect */}
                    {!isMobile && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '120%', height: '120%',
                            background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
                            zIndex: 0, pointerEvents: 'none'
                        }} />
                    )}

                    <motion.section
                        initial={{ opacity: 0, x: isMobile ? 0 : -20, y: isMobile ? 20 : 0 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 1.2 }}
                        onTouchStart={onTouchStart}
                        onTouchEnd={onTouchEnd}
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '24px',
                            boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            background: '#ffffff',
                            width: '100%',
                            height: isMobile ? '400px' : 'clamp(420px, 40vw, 540px)',
                            zIndex: 1
                        }}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.img
                                key={galleryImages[currentImage]}
                                src={galleryImages[currentImage]}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: isMobile ? '16px' : '24px', position: 'absolute', inset: 0 }}
                                alt={product.name}
                            />
                        </AnimatePresence>

                        {/* Carousel arrows — only show if there's more than one image */}
                        {galleryImages.length > 1 && (
                            <>
                                <button
                                    onClick={goPrev}
                                    aria-label="Previous image"
                                    style={{
                                        position: 'absolute', top: '50%', left: isMobile ? '12px' : '16px', transform: 'translateY(-50%)',
                                        width: isMobile ? '36px' : '42px', height: isMobile ? '36px' : '42px',
                                        borderRadius: '999px',
                                        background: 'rgba(255,255,255,0.85)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#1a1a1a', zIndex: 2,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                                    }}
                                >
                                    <ChevronLeft size={isMobile ? 16 : 18} strokeWidth={2} />
                                </button>
                                <button
                                    onClick={goNext}
                                    aria-label="Next image"
                                    style={{
                                        position: 'absolute', top: '50%', right: isMobile ? '12px' : '16px', transform: 'translateY(-50%)',
                                        width: isMobile ? '36px' : '42px', height: isMobile ? '36px' : '42px',
                                        borderRadius: '999px',
                                        background: 'rgba(255,255,255,0.85)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#1a1a1a', zIndex: 2,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                                    }}
                                >
                                    <ChevronRight size={isMobile ? 16 : 18} strokeWidth={2} />
                                </button>

                                {/* Dots indicator */}
                                <div style={{
                                    position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                                    display: 'flex', gap: '8px', zIndex: 2,
                                    padding: '8px 14px',
                                    background: 'rgba(5,5,5,0.5)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '999px'
                                }}>
                                    {galleryImages.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentImage(i)}
                                            aria-label={`Go to image ${i + 1}`}
                                            style={{
                                                width: i === currentImage ? '22px' : '6px',
                                                height: '6px',
                                                borderRadius: '999px',
                                                background: i === currentImage ? '#d4af37' : 'rgba(255,255,255,0.5)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                padding: 0
                                            }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.section>

                    {/* Thumbnail strip — desktop only, hidden if single image */}
                    {!isMobile && galleryImages.length > 1 && (
                        <div style={{
                            marginTop: '16px',
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap'
                        }}>
                            {galleryImages.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentImage(i)}
                                    style={{
                                        width: '64px', height: '64px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: i === currentImage ? '2px solid #d4af37' : '1px solid rgba(0,0,0,0.08)',
                                        padding: 0,
                                        cursor: 'pointer',
                                        background: '#fff',
                                        transition: 'border-color 0.2s ease'
                                    }}
                                >
                                    <img
                                        src={img}
                                        alt={`${product.name} ${i + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Olfactory Notes Grid — sits below the image so the two columns balance */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        style={{
                            marginTop: isMobile ? '24px' : '32px',
                            padding: isMobile ? '24px' : '28px 32px',
                            background: '#ffffff',
                            border: '1px solid rgba(0,0,0,0.06)',
                            borderRadius: '24px',
                            boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: isMobile ? '16px' : '24px'
                        }}
                    >
                        {[
                            { l: 'TOP', v: product.scent_profile?.top || '-' },
                            { l: 'HEART', v: product.scent_profile?.heart || '-' },
                            { l: 'BASE', v: product.scent_profile?.base || '-' }
                        ].map((note, i) => (
                            <div key={i}>
                                <div style={{ fontSize: '9px', color: '#d4af37', letterSpacing: '0.3em', marginBottom: '10px', fontWeight: 600 }}>{note.l}</div>
                                <div style={{ fontSize: '13px', color: '#1a1a1a', fontFamily: 'var(--font-tenor)', lineHeight: 1.35 }}>{note.v}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Right: Theme-Based Content */}
                <section style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: isMobile ? '0' : '20px 0',
                    flex: 1
                }}>
                    <motion.div
                        initial={{ opacity: 0, x: isMobile ? 0 : 20, y: isMobile ? 20 : 0 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.2 }}
                    >
                        <div style={{ marginBottom: isMobile ? '24px' : '40px' }}>
                            <Link href="/products" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37', textDecoration: 'none', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: 'var(--font-tenor)', opacity: 0.8, transition: 'opacity 0.3s' }}>
                                <ArrowLeft size={14} /> Back to Shop
                            </Link>
                        </div>

                        <div style={{ fontSize: '11px', color: '#d4af37', letterSpacing: '0.5em', textTransform: 'uppercase', marginBottom: isMobile ? '12px' : '20px', fontFamily: 'var(--font-tenor)', fontWeight: 600 }}>
                            {product.category || 'PARFUM'}
                        </div>

                        <h1 style={{
                            fontSize: isMobile ? 'clamp(24px, 7vw, 30px)' : 'clamp(26px, 2.6vw, 40px)',
                            fontFamily: 'var(--font-baskerville)',
                            fontWeight: 400,
                            lineHeight: 1.15,
                            margin: isMobile ? '0 0 16px' : '0 0 12px',
                            letterSpacing: '-0.01em',
                            wordBreak: 'break-word'
                        }}>
                            {product.name}
                        </h1>

                        {/* Rating Display */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                        key={s}
                                        size={10}
                                        fill={product.rating >= s ? '#d4af37' : 'transparent'}
                                        color={product.rating >= s ? '#d4af37' : 'rgba(0,0,0,0.2)'}
                                    />
                                ))}
                            </div>
                            <span style={{ fontSize: '10px', color: '#666', letterSpacing: '0.1em' }}>
                                {product.rating || '0.0'} ({reviews.length} REVIEWS)
                            </span>
                        </div>

                        {(() => {
                            const mrp = (product as any).mrp
                            const hasDiscount = typeof mrp === 'number' && mrp > product.price
                            const pct = hasDiscount ? Math.round(((mrp - product.price) / mrp) * 100) : 0
                            return (
                                <div style={{
                                    display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
                                    gap: isMobile ? '10px' : '14px',
                                    marginBottom: isMobile ? '24px' : '32px',
                                    fontFamily: 'var(--font-tenor)'
                                }}>
                                    <span style={{ fontSize: isMobile ? '22px' : '26px', color: '#1a1a1a', fontWeight: 500 }}>
                                        ₹{product.price.toLocaleString('en-IN')}
                                    </span>
                                    {hasDiscount && (
                                        <>
                                            <span style={{
                                                fontSize: isMobile ? '14px' : '16px',
                                                color: 'rgba(0,0,0,0.4)',
                                                textDecoration: 'line-through',
                                                textDecorationThickness: '1px'
                                            }}>
                                                ₹{mrp.toLocaleString('en-IN')}
                                            </span>
                                            <span style={{
                                                fontSize: isMobile ? '11px' : '12px',
                                                color: '#16a34a',
                                                fontWeight: 700,
                                                letterSpacing: '0.08em',
                                                textTransform: 'uppercase'
                                            }}>
                                                {pct}% Off
                                            </span>
                                        </>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Actions — placed directly under the price, above the description */}
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch', paddingRight: isMobile ? '12px' : '0', marginBottom: isMobile ? '32px' : '40px' }}>
                            <motion.button
                                type="button"
                                onClick={() => handleAction('buy')}
                                disabled={adding}
                                whileHover={!adding ? { backgroundColor: '#d4af37', color: '#1a1a1a' } : {}}
                                whileTap={!adding ? { scale: 0.98 } : {}}
                                style={{
                                    flex: 1,
                                    background: '#1a1a1a',
                                    border: '1px solid #1a1a1a',
                                    color: '#ffffff',
                                    padding: '20px',
                                    fontSize: isMobile ? '11px' : '14px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.4em',
                                    cursor: adding ? 'not-allowed' : 'pointer',
                                    borderRadius: '999px',
                                    boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {adding ? <><Loader2 size={14} className="animate-spin" /> Processing</> : 'BUY NOW'}
                            </motion.button>
                            <motion.button
                                type="button"
                                onClick={() => handleAction('cart')}
                                disabled={adding}
                                whileHover={!adding ? { scale: 1.05, backgroundColor: '#1a1a1a', color: '#d4af37' } : {}}
                                whileTap={!adding ? { scale: 0.95 } : {}}
                                aria-label="Add to cart"
                                style={{
                                    width: '64px', height: '64px',
                                    background: added ? '#10b981' : '#d4af37',
                                    border: 'none',
                                    color: added ? '#fff' : '#1a1a1a',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: adding ? 'not-allowed' : 'pointer',
                                    borderRadius: '50%',
                                    boxShadow: '0 12px 24px rgba(212,175,55,0.35)',
                                    flexShrink: 0,
                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                            >
                                {adding ? <Loader2 size={18} className="animate-spin" /> : added ? <Check size={20} strokeWidth={2} /> : <ShoppingBag size={20} strokeWidth={1.6} />}
                            </motion.button>
                        </div>
                        {actionError && (
                            <p style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '-20px', marginBottom: isMobile ? '32px' : '40px' }}>{actionError}</p>
                        )}

                        <div style={{ marginBottom: isMobile ? '32px' : '40px' }}>
                            <FormattedDescription text={product.description || 'Accessing encrypted olfactory data. This composition is part of the REVEIL Laboratory Archive, designed for high-end olfactory resonance.'} />
                        </div>

                        {/* Technical Meta */}
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '32px' : '64px', marginBottom: isMobile ? '32px' : '44px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: isMobile ? '24px' : '32px' }}>
                            <div>
                                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#d4af37', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.2em', fontWeight: 600 }}>Select Size</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {availableSizes.map((v) => (
                                        <motion.button
                                            key={v}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setSelectedVolume(v)}
                                            style={{
                                                padding: isMobile ? '8px 16px' : '10px 20px',
                                                fontSize: isMobile ? '11px' : '13px',
                                                background: selectedVolume === v ? '#d4af37' : 'transparent',
                                                border: `1px solid ${selectedVolume === v ? '#d4af37' : 'rgba(212,175,55,0.5)'}`,
                                                color: selectedVolume === v ? '#000' : '#1a1a1a',
                                                cursor: 'pointer',
                                                letterSpacing: '0.1em',
                                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                fontWeight: selectedVolume === v ? 700 : 400
                                            }}
                                        >
                                            {v}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#d4af37', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.2em', fontWeight: 600 }}>Lasts for</div>
                                <div style={{ fontSize: isMobile ? '12px' : '15px', color: '#1a1a1a', padding: '8px 0' }}>{product.technical_specs?.longevity || '12 HRS+'}</div>
                            </div>
                        </div>

                        {/* Delivery Pincode Check — Pan-India */}
                        <div style={{ marginBottom: isMobile ? '28px' : '36px' }}>
                            <div style={{
                                fontSize: isMobile ? '10px' : '12px', color: '#d4af37', textTransform: 'uppercase',
                                marginBottom: '12px', letterSpacing: '0.2em', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <MapPin size={11} strokeWidth={1.8} /> Check Delivery
                            </div>
                            <form
                                onSubmit={(e) => { e.preventDefault(); checkPincode() }}
                                style={{
                                    display: 'flex', alignItems: 'stretch', gap: '0',
                                    maxWidth: '360px',
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    borderRadius: '999px',
                                    overflow: 'hidden',
                                    background: '#ffffff'
                                }}
                            >
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="Enter 6-digit pincode"
                                    value={pincode}
                                    onChange={(e) => {
                                        setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                                        if (pinResult) setPinResult(null)
                                    }}
                                    style={{
                                        flex: 1, padding: '12px 20px',
                                        border: 'none', outline: 'none',
                                        background: 'transparent',
                                        fontSize: '13px', color: '#1a1a1a',
                                        letterSpacing: '0.1em',
                                        fontFamily: 'var(--font-tenor)'
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={pinChecking || pincode.length !== 6}
                                    style={{
                                        padding: '0 22px',
                                        background: pincode.length === 6 ? '#1a1a1a' : 'rgba(0,0,0,0.08)',
                                        color: pincode.length === 6 ? '#fff' : 'rgba(0,0,0,0.4)',
                                        border: 'none',
                                        fontSize: '10px', fontWeight: 700,
                                        letterSpacing: '0.3em',
                                        textTransform: 'uppercase',
                                        cursor: pincode.length === 6 && !pinChecking ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    {pinChecking ? <Loader2 size={14} className="animate-spin" /> : 'Check'}
                                </button>
                            </form>

                            {pinResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        marginTop: '12px',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontSize: '12px',
                                        color: pinResult.ok ? '#0d7a3f' : '#b91c1c',
                                        fontFamily: 'var(--font-tenor)'
                                    }}
                                >
                                    {pinResult.ok ? <Check size={14} strokeWidth={2.2} /> : <XIcon size={14} strokeWidth={2.2} />}
                                    {pinResult.ok ? (
                                        <span>
                                            Delivery available
                                            {pinResult.area && (
                                                <> to <strong style={{ fontWeight: 600 }}>{pinResult.area}</strong>{pinResult.district ? `, ${pinResult.district}` : ''}</>
                                            )}
                                            . Free shipping on orders above ₹250.
                                        </span>
                                    ) : (
                                        <span>{pinResult.reason}</span>
                                    )}
                                </motion.div>
                            )}
                        </div>

                    </motion.div>
                </section>
            </div>

            {/* New Review Invitation Section (Visible to logged in users) */}
            <div style={{ marginTop: '80px', padding: '0 24px' }}>
                <ReviewInvitation product={{ id: product.id, name: product.name }} />
            </div>

            {/* Reviews Section */}
            <div style={{
                marginTop: '100px',
                borderTop: '1px solid rgba(0,0,0,0.03)',
                paddingTop: '60px',
                background: 'linear-gradient(to bottom, rgba(212,175,55,0.02), transparent)'
            }}>
                <ReviewsSection reviews={reviews} product={{ id: product.id, name: product.name }} />
            </div>

            {/* You May Also Like — related products at the bottom of the page */}
            {relatedProducts.length > 0 && (
                <section style={{
                    maxWidth: '1400px',
                    margin: isMobile ? '60px auto 0' : '120px auto 0',
                    padding: isMobile ? '0 4px' : '0'
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'baseline',
                        gap: isMobile ? '8px' : '20px',
                        marginBottom: isMobile ? '24px' : '48px',
                        paddingLeft: isMobile ? '16px' : '0',
                        paddingRight: isMobile ? '16px' : '0'
                    }}>
                        <div>
                            <div style={{
                                fontSize: '10px', color: '#d4af37',
                                letterSpacing: '0.4em', textTransform: 'uppercase',
                                fontWeight: 600, marginBottom: '10px',
                                fontFamily: 'var(--font-tenor)'
                            }}>
                                Curated For You
                            </div>
                            <h2 style={{
                                fontSize: isMobile ? '22px' : 'clamp(24px, 2.4vw, 36px)',
                                fontFamily: 'var(--font-baskerville)',
                                fontWeight: 400,
                                color: '#1a1a1a',
                                margin: 0,
                                letterSpacing: '-0.01em'
                            }}>
                                You May Also Like
                            </h2>
                        </div>
                        <Link href="/products" style={{
                            fontSize: '10px',
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            color: '#1a1a1a',
                            textDecoration: 'none',
                            borderBottom: '1px solid #d4af37',
                            paddingBottom: '4px',
                            fontFamily: 'var(--font-tenor)',
                            fontWeight: 600
                        }}>
                            View All →
                        </Link>
                    </div>

                    <div style={{
                        display: isMobile ? 'flex' : 'grid',
                        gridTemplateColumns: !isMobile ? 'repeat(4, 1fr)' : 'none',
                        gap: isMobile ? '14px' : '24px',
                        overflowX: isMobile ? 'auto' : 'visible',
                        scrollSnapType: isMobile ? 'x mandatory' : 'none',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        padding: isMobile ? '0 16px 16px' : '0',
                        margin: isMobile ? '0 -4px' : '0'
                    }}>
                        <style>{`section > div::-webkit-scrollbar { display: none; }`}</style>
                        {relatedProducts.slice(0, 4).map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.1 }}
                                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                    minWidth: isMobile ? '70%' : 'auto',
                                    flex: isMobile ? '0 0 auto' : 'auto',
                                    scrollSnapAlign: isMobile ? 'start' : 'none',
                                    display: 'flex'
                                }}
                            >
                                <ProductCard product={p} />
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    )
}
