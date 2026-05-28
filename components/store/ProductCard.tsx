'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Heart, Loader2, ShoppingCart, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/types/store'

export default function ProductCard({ product }: { product: Product }) {
    const [hovered, setHovered] = useState(false)
    const [imgError, setImgError] = useState(false)
    const [user, setUser] = useState<any>(null)
    const router = useRouter()
    const supabase = createClient()

    const [adding, setAdding] = useState(false)
    const [wishlisting, setWishlisting] = useState(false)
    const [wishlisted, setWishlisted] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [imageIndex, setImageIndex] = useState(0)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                // Check if wishlisted
                const { data } = await supabase
                    .from('wishlists')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .single()
                if (data) setWishlisted(true)
            }
        }
        checkUser()
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleAction = async (e: React.MouseEvent, type: 'cart' | 'buy' | 'view') => {
        e.preventDefault()
        e.stopPropagation()

        if (!user) {
            router.push('/auth')
            return
        }

        if (type === 'view') {
            router.push(`/products/${product.slug}`)
            return
        }

        setAdding(true)
        try {
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: product.id, quantity: 1 })
            })

            if (res.ok) {
                window.dispatchEvent(new Event('cart-updated'))
                if (type === 'buy') {
                    router.push('/cart')
                } else {
                    // Success feedback
                }
            }
        } catch (error) {
            console.error('Cart error:', error)
        } finally {
            setAdding(false)
        }
    }

    const toggleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!user) {
            router.push('/auth')
            return
        }

        setWishlisting(true)
        try {
            if (wishlisted) {
                const res = await fetch(`/api/wishlist?product_id=${product.id}`, { method: 'DELETE' })
                if (res.ok) setWishlisted(false)
            } else {
                const res = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: product.id })
                })
                if (res.ok) setWishlisted(true)
            }
        } catch (error) {
            console.error('Wishlist error:', error)
        } finally {
            setWishlisting(false)
        }
    }

    const images = product.images?.filter(Boolean) || []
    const mainImage = images[imageIndex] ?? images[0]
    const hasMultiple = images.length > 1

    const goPrev = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setImageIndex((i) => (i - 1 + images.length) % images.length)
    }
    const goNext = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setImageIndex((i) => (i + 1) % images.length)
    }

    // Disable all hover-driven animations on mobile so taps don't leave one
    // card in a "lifted" state while siblings stay flat, which makes cards
    // look unequal in size. Mobile also doesn't have a hover concept, so the
    // motion adds nothing but inconsistency.
    const interactiveHover = !isMobile

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={interactiveHover ? 'cardHover' : undefined}
            style={{
                background: 'linear-gradient(180deg, #ffffff 0%, rgba(212,175,55,0.05) 100%)',
                position: 'relative',
                cursor: 'pointer',
                borderRadius: isMobile ? '20px' : '28px',
                padding: isMobile ? '8px' : '18px',
                border: '1px solid rgba(0,0,0,0.06)',
                transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                boxSizing: 'border-box'
            }}
        >
            {/* Atmospheric Chassis Glow (Animated on Hover, desktop only) */}
            {interactiveHover && (
                <motion.div
                    variants={{
                        cardHover: { opacity: 1, scale: 1.1 }
                    }}
                    initial={{ opacity: 0, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    style={{
                        position: 'absolute',
                        bottom: '-40px',
                        left: '10%',
                        right: '10%',
                        height: '100px',
                        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
                        filter: 'blur(30px)',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                />
            )}
            {/* Visual Media Container */}
            <motion.div
                onClick={() => router.push(`/products/${product.slug}`)}
                onMouseEnter={interactiveHover ? () => setHovered(true) : undefined}
                onMouseLeave={interactiveHover ? () => setHovered(false) : undefined}
                animate={interactiveHover ? {
                    y: hovered ? -10 : 0,
                    boxShadow: hovered ? '0 30px 60px rgba(0,0,0,0.15)' : '0 0 0 rgba(0,0,0,0)'
                } : { y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    ...(isMobile
                        ? { aspectRatio: '1 / 1', flexShrink: 0 }
                        : { paddingBottom: '140%' }
                    ),
                    background: '#f3eee2',
                    borderRadius: '20px',
                    border: '1px solid rgba(0,0,0,0.06)'
                }}
            >
                {/* Background Image with Cinematic Focus (desktop hover only) */}
                <motion.div
                    animate={interactiveHover ? {
                        scale: hovered ? 1.05 : 1,
                        filter: hovered ? 'brightness(1) blur(0.5px)' : 'brightness(1) blur(0px)'
                    } : { scale: 1, filter: 'brightness(1) blur(0px)' }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                >
                    {mainImage && !imgError ? (
                        <Image
                            src={mainImage}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            onError={() => setImgError(true)}
                            style={{ objectFit: 'contain', padding: isMobile ? '8px' : '12px' }}
                        />
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'rgba(0,0,0,0.2)', fontSize: '8px',
                            letterSpacing: '0.4em', textTransform: 'uppercase'
                        }}>
                            Fragrance <br /> Archive
                        </div>
                    )}
                </motion.div>

                {/* Image Slider Controls */}
                {hasMultiple && (
                    <>
                        <button
                            type="button"
                            onClick={goPrev}
                            aria-label="Previous image"
                            style={{
                                position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)',
                                zIndex: 5, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px',
                                borderRadius: '50%', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: isMobile ? 0.85 : (hovered ? 1 : 0),
                                transition: 'opacity 0.3s ease'
                            }}
                        >
                            <ChevronLeft size={isMobile ? 14 : 16} />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            aria-label="Next image"
                            style={{
                                position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)',
                                zIndex: 5, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px',
                                borderRadius: '50%', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: isMobile ? 0.85 : (hovered ? 1 : 0),
                                transition: 'opacity 0.3s ease'
                            }}
                        >
                            <ChevronRight size={isMobile ? 14 : 16} />
                        </button>
                        <div style={{
                            position: 'absolute', bottom: '8px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'center', gap: '6px', zIndex: 5
                        }}>
                            {images.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageIndex(i) }}
                                    aria-label={`Show image ${i + 1}`}
                                    style={{
                                        width: i === imageIndex ? '16px' : '6px',
                                        height: '6px', borderRadius: '3px',
                                        background: i === imageIndex ? '#d4af37' : 'rgba(255,255,255,0.4)',
                                        border: 'none', cursor: 'pointer',
                                        transition: 'all 0.3s ease', padding: 0
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Subtle Grain Overlay for Texture */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    background: 'url("/noise.svg")',
                    opacity: 0.05, pointerEvents: 'none'
                }} />

                {/* Wishlist Toggle Overlay */}
                <motion.button
                    onClick={toggleWishlist}
                    disabled={wishlisting}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: isMobile ? '4px' : '8px',
                        zIndex: 10,
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: isMobile ? '32px' : '40px',
                        height: isMobile ? '32px' : '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        color: wishlisted ? '#d4af37' : '#fff',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {wishlisting ? (
                        <Loader2 size={isMobile ? 14 : 18} className="animate-spin" />
                    ) : (
                        <Heart
                            size={isMobile ? 16 : 20}
                            fill={wishlisted ? '#d4af37' : 'transparent'}
                            strokeWidth={wishlisted ? 0 : 1.5}
                        />
                    )}
                </motion.button>
            </motion.div>

            {/* Typography Section */}
            <div style={{ padding: isMobile ? '12px 0' : '24px 0', textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Link href={`/products/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                        fontSize: isMobile ? '7px' : '8px', color: '#888',
                        letterSpacing: isMobile ? '0.2em' : '0.4em', marginBottom: '8px',
                        fontWeight: 400, textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontFamily: 'var(--font-tenor)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        height: '14px', lineHeight: '14px'
                    }}>
                        <div style={{
                            width: (hovered && !isMobile) ? '30px' : '0px',
                            height: '1px',
                            background: '#d4af37',
                            transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                            flexShrink: 0
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.category}</span>
                    </div>
                    <h3 style={{
                        margin: '0 0 8px', fontSize: isMobile ? '12px' : '15px', fontWeight: 400,
                        color: '#1a1a1a', fontFamily: 'var(--font-cormorant)',
                        letterSpacing: '0.02em', textTransform: 'none', lineHeight: 1.2,
                        ...(isMobile && {
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: '29px'
                        })
                    }}>
                        {product.name}
                    </h3>

                    {/* Price Tag */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '8px' : '12px',
                        marginBottom: isMobile ? '12px' : '20px',
                        fontFamily: 'var(--font-tenor)'
                    }}>
                        <span style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 500, color: '#d4af37' }}>
                            ₹ {product.price}
                        </span>
                    </div>
                </Link>

                {/* Integrated Static Controls for Accessibility - Theme Focused */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'row', // Side by side for both
                    gap: isMobile ? '6px' : '12px',
                    marginTop: 'auto',
                    paddingTop: isMobile ? '12px' : '20px',
                    background: 'transparent'
                }}>
                    <div onClick={(e) => handleAction(e, 'buy')} style={{ flex: 1 }}>
                        <motion.button
                            disabled={adding}
                            whileTap={isMobile ? { scale: 0.95 } : {}}
                            whileHover={!isMobile ? "hover" : ""}
                            initial="initial"
                            style={{
                                width: '100%',
                                background: isMobile ? '#d4af37' : 'rgba(0,0,0,0.02)',
                                color: isMobile ? '#000' : '#1a1a1a',
                                border: isMobile ? 'none' : '1px solid rgba(212,175,55,0.4)',
                                padding: isMobile ? '10px 8px' : '14px 0',
                                fontSize: isMobile ? '9px' : '8px',
                                fontWeight: 900,
                                letterSpacing: isMobile ? '0.1em' : '0.3em',
                                textTransform: 'uppercase',
                                cursor: adding ? 'not-allowed' : 'pointer',
                                fontFamily: 'var(--font-tenor)',
                                position: 'relative',
                                overflow: 'hidden',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1
                            }}
                        >
                            {!isMobile && (
                                <motion.div
                                    variants={{
                                        initial: { y: '100%' },
                                        hover: { y: 0 }
                                    }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ position: 'absolute', inset: 0, background: '#d4af37', zIndex: 0 }}
                                />
                            )}

                            <motion.div
                                variants={!isMobile ? {
                                    initial: { color: '#1a1a1a' },
                                    hover: { color: '#000' }
                                } : {}}
                                style={{ position: 'relative', zIndex: 1, color: isMobile ? '#000' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                            >
                                <motion.span
                                    variants={!isMobile ? {
                                        initial: { y: 0, opacity: 1 },
                                        hover: { y: -20, opacity: 0 }
                                    } : {}}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '4px' : '8px', color: isMobile ? '#000' : 'inherit', whiteSpace: 'nowrap' }}
                                >
                                    {adding ? <span style={{ paddingTop: '2px' }}>...</span> : <><ShoppingBag size={isMobile ? 12 : 14} /> <span style={{ paddingTop: '2px' }}>{isMobile ? 'BUY' : 'BUY'}</span></>}
                                </motion.span>
                                {!isMobile && (
                                    <motion.span
                                        variants={{
                                            initial: { y: 20, opacity: 0 },
                                            hover: { y: 0, opacity: 1 }
                                        }}
                                        style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        {adding ? <span style={{ paddingTop: '2px' }}>...</span> : <><ShoppingBag size={14} /> <span style={{ paddingTop: '2px' }}>BUY</span></>}
                                    </motion.span>
                                )}
                            </motion.div>
                        </motion.button>
                    </div>

                    <motion.button
                        disabled={adding}
                        onClick={(e) => handleAction(e, 'cart')}
                        whileTap={isMobile ? { scale: 0.95 } : {}}
                        whileHover={!isMobile ? "hover" : ""}
                        initial="initial"
                        style={{
                            flex: 1,
                            background: isMobile ? '#1a1a1a' : 'rgba(0,0,0,0.02)',
                            color: isMobile ? '#fff' : '#1a1a1a',
                            border: isMobile ? 'none' : '1px solid rgba(212,175,55,0.4)',
                            padding: isMobile ? '10px 8px' : '14px 0',
                            fontSize: isMobile ? '9px' : '8px',
                            fontWeight: 900,
                            letterSpacing: isMobile ? '0.1em' : '0.3em',
                            textTransform: 'uppercase',
                            cursor: adding ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-tenor)',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1
                        }}
                    >
                        {!isMobile && (
                            <motion.div
                                variants={{
                                    initial: { y: '100%' },
                                    hover: { y: 0 }
                                }}
                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                style={{ position: 'absolute', inset: 0, background: '#d4af37', zIndex: 0 }}
                            />
                        )}

                        <motion.div
                            variants={!isMobile ? {
                                initial: { color: '#1a1a1a' },
                                hover: { color: '#000' }
                            } : {}}
                            style={{ position: 'relative', zIndex: 1, color: isMobile ? '#fff' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                        >
                            <motion.span
                                variants={!isMobile ? {
                                    initial: { y: 0, opacity: 1 },
                                    hover: { y: -20, opacity: 0 }
                                } : {}}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '4px' : '8px', color: isMobile ? '#fff' : 'inherit', whiteSpace: 'nowrap' }}
                            >
                                {adding ? <span style={{ paddingTop: '2px' }}>...</span> : <><ShoppingCart size={isMobile ? 12 : 14} /> <span style={{ paddingTop: '2px' }}>CART</span></>}
                            </motion.span>
                            {!isMobile && (
                                <motion.span
                                    variants={{
                                        initial: { y: 20, opacity: 0 },
                                        hover: { y: 0, opacity: 1 }
                                    }}
                                    style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {adding ? <span style={{ paddingTop: '2px' }}>...</span> : <><ShoppingCart size={14} /> <span style={{ paddingTop: '2px' }}>CART</span></>}
                                </motion.span>
                            )}
                        </motion.div>
                    </motion.button>
                </div>
            </div>
        </motion.div>
    )
}
