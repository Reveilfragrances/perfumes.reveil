'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type Category = { id: string; name: string; slug: string; image_url?: string | null }

// ─── Icon library ───────────────────────────────────────────────────────────
// Premium thin-line SVGs that match Reveil's gold-on-cream aesthetic. Each
// icon is selected by keyword-matching the category slug so categories the
// admin adds later (e.g. "candle", "musk") still resolve to a sensible icon
// instead of a generic placeholder.

const GOLD = '#d4af37'

const Icons = {
    all: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 18v-4h6v4M22 18h6l1 6h-8z" />
            <path d="M22 24l-1.5 22a3 3 0 003 3.2h5a3 3 0 003-3.2L30 24" />
            <path d="M40 22v-3h5v3M40 22h5l.8 4.5h-6.6z" />
            <path d="M40 26.5l-1.2 18a2.5 2.5 0 002.5 2.7h4a2.5 2.5 0 002.5-2.7L46.6 26.5" />
            <circle cx="13" cy="14" r="1.2" fill={GOLD} stroke="none" />
            <circle cx="54" cy="20" r="1" fill={GOLD} stroke="none" opacity="0.7" />
            <circle cx="16" cy="50" r="0.9" fill={GOLD} stroke="none" opacity="0.6" />
        </svg>
    ),

    perfume: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="22" y="22" width="20" height="28" rx="3" />
            <path d="M22 30h20" opacity="0.5" />
            <rect x="27" y="14" width="10" height="8" rx="1" />
            <path d="M37 16h6a3 3 0 010 6h-2" />
            <circle cx="46" cy="14" r="3" />
            <path d="M44.5 11.5l-1-1M47.5 11.5l1-1M44.5 16.5l-1 1" opacity="0.6" />
            <path d="M27 34h10M27 40h10" opacity="0.3" />
        </svg>
    ),

    attar: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="26" y="22" width="12" height="30" rx="2" />
            <path d="M28 18h8v4h-8z" />
            <circle cx="32" cy="14" r="3" />
            <path d="M26 32h12M26 42h12" opacity="0.35" />
            <path d="M30 22v30M34 22v30" opacity="0.15" />
        </svg>
    ),

    reedDiffuser: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 34l-1 16a2 2 0 002 2.2h18a2 2 0 002-2.2l-1-16z" />
            <path d="M26 34v-5h12v5" />
            <line x1="28" y1="29" x2="22" y2="10" />
            <line x1="32" y1="29" x2="32" y2="8" />
            <line x1="36" y1="29" x2="42" y2="10" />
            <line x1="24" y1="29" x2="14" y2="14" opacity="0.7" />
            <line x1="40" y1="29" x2="50" y2="14" opacity="0.7" />
            <path d="M16 11c1-1 1-3 0-4M48 11c-1-1-1-3 0-4" opacity="0.5" />
        </svg>
    ),

    miniDiffuser: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="24" y="26" width="16" height="24" rx="3" />
            <rect x="28" y="20" width="8" height="6" rx="1" />
            <path d="M32 20v-4" />
            <path d="M28 14h8" />
            <path d="M32 12c-2-2-1-5 1-5M32 12c2-2 1-5-1-5" opacity="0.55" />
            <path d="M24 34h16M24 42h16" opacity="0.35" />
            <circle cx="32" cy="46" r="1.2" fill={GOLD} stroke="none" opacity="0.7" />
        </svg>
    ),

    oudh: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="32" cy="40" rx="14" ry="10" />
            <ellipse cx="32" cy="40" rx="8" ry="5" opacity="0.6" />
            <path d="M30 30c1-3-1-5 0-8 1 2 3 2 4 0 1 3-1 5 0 8" />
            <path d="M28 24c0-2 1-3 0-5M36 24c0-2-1-3 0-5" opacity="0.6" />
        </svg>
    ),

    musk: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="32" cy="32" r="4" />
            <path d="M32 16a8 8 0 010 16M32 48a8 8 0 010-16" />
            <path d="M16 32a8 8 0 0116 0M48 32a8 8 0 01-16 0" />
            <path d="M20 20a8 8 0 0011.3 11.3M43.9 43.9A8 8 0 0032.7 32.7" opacity="0.6" />
            <path d="M20 44a8 8 0 0111.3-11.3M43.9 20.1A8 8 0 0132.7 31.4" opacity="0.6" />
        </svg>
    ),

    candle: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="24" y="28" width="16" height="24" rx="2" />
            <path d="M24 34h16" opacity="0.4" />
            <line x1="32" y1="28" x2="32" y2="22" />
            <path d="M32 22c0-3-3-4-3-7 0 0 3 1 3 3 0-2 3-3 3-3 0 3-3 4-3 7z" />
        </svg>
    ),

    bottleSimple: (
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="24" y="22" width="16" height="28" rx="2" />
            <path d="M28 22v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
            <path d="M24 32h16" opacity="0.4" />
        </svg>
    ),
}

function pickIcon(category: { name: string; slug: string }): React.ReactNode {
    const haystack = `${category.slug} ${category.name}`.toLowerCase()
    if (/(reed)/.test(haystack)) return Icons.reedDiffuser
    if (/(mini).*(diff)|mini-diff/.test(haystack)) return Icons.miniDiffuser
    if (/diffuser/.test(haystack)) return Icons.reedDiffuser
    if (/(roll[- ]?on)|attar/.test(haystack)) return Icons.attar
    if (/oudh|oud\b|agarwood/.test(haystack)) return Icons.oudh
    if (/musk|floral|rose|jasmine/.test(haystack)) return Icons.musk
    if (/candle/.test(haystack)) return Icons.candle
    if (/perfume|eau|parfum|spray|cologne|deod/.test(haystack)) return Icons.perfume
    return Icons.bottleSimple
}

// ─── Section ────────────────────────────────────────────────────────────────

export default function CategoryStrip({ categories }: { categories: Category[] }) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    if (!categories || categories.length === 0) return null

    return (
        <section style={{
            background: '#f8f7f2',
            padding: isMobile ? '36px 0 28px' : 'clamp(48px, 7vw, 88px) 0 clamp(40px, 6vw, 72px)',
            position: 'relative',
            borderTop: '1px solid rgba(212,175,55,0.18)'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 clamp(20px, 4vw, 60px)' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: isMobile ? '10px' : '16px',
                    marginBottom: isMobile ? '20px' : 'clamp(28px, 4vw, 48px)'
                }}>
                    <div style={{ width: isMobile ? '24px' : '40px', height: '1px', background: 'rgba(212,175,55,0.4)' }} />
                    <span style={{
                        fontSize: isMobile ? '10px' : '11px',
                        letterSpacing: isMobile ? '0.3em' : '0.4em',
                        color: GOLD, textTransform: 'uppercase', fontWeight: 500
                    }}>
                        Shop by Category
                    </span>
                    <div style={{ width: isMobile ? '24px' : '40px', height: '1px', background: 'rgba(212,175,55,0.4)' }} />
                </div>

                {isMobile ? (
                    // Mobile: horizontal scroll carousel with snap, similar to
                    // the reference "Shop by Category" pattern. Cards keep the
                    // full premium size — only the layout changes.
                    <div
                        className="reveil-cat-scroll"
                        style={{
                            display: 'flex',
                            gap: '14px',
                            overflowX: 'auto',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            // Bleed the strip to the page edges so cards
                            // start flush-left and trail off the right edge
                            // as a swipe hint.
                            margin: '0 -16px',
                            padding: '4px 16px 14px',
                        }}
                    >
                        <style>{`.reveil-cat-scroll::-webkit-scrollbar { display: none; }`}</style>

                        <div style={{ flex: '0 0 auto', scrollSnapAlign: 'start', width: '160px' }}>
                            <CategoryCard
                                href="/products"
                                label="All Fragrances"
                                hint="View entire archive"
                                icon={Icons.all}
                                isMobile={isMobile}
                            />
                        </div>
                        {categories.map((cat) => (
                            <div key={cat.id} style={{ flex: '0 0 auto', scrollSnapAlign: 'start', width: '160px' }}>
                                <CategoryCard
                                    href={`/products?category=${cat.slug}`}
                                    label={cat.name}
                                    image={cat.image_url || undefined}
                                    icon={pickIcon(cat)}
                                    isMobile={isMobile}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 'clamp(14px, 1.8vw, 22px)',
                        maxWidth: '1200px',
                        margin: '0 auto'
                    }}>
                        <CategoryCard
                            href="/products"
                            label="All Fragrances"
                            hint="View entire archive"
                            icon={Icons.all}
                            isMobile={isMobile}
                        />
                        {categories.map((cat) => (
                            <CategoryCard
                                key={cat.id}
                                href={`/products?category=${cat.slug}`}
                                label={cat.name}
                                image={cat.image_url || undefined}
                                icon={pickIcon(cat)}
                                isMobile={isMobile}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

function CategoryCard({ href, label, hint, image, icon, isMobile }: {
    href: string
    label: string
    hint?: string
    image?: string
    icon: React.ReactNode
    isMobile: boolean
}) {
    return (
        <Link href={href} style={{ textDecoration: 'none' }}>
            <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    background: 'linear-gradient(180deg, #ffffff 0%, #faf6ec 100%)',
                    border: '1px solid rgba(212,175,55,0.22)',
                    borderRadius: '20px',
                    padding: '26px 18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(26,26,26,0.04)',
                    transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
                    cursor: 'pointer',
                    minHeight: '180px',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Soft halo behind icon */}
                <div style={{
                    position: 'absolute',
                    top: '14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '110px',
                    height: '110px',
                    background: 'radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />

                <div style={{
                    width: '88px',
                    height: '88px',
                    borderRadius: '50%',
                    background: image
                        ? `center/cover url(${image})`
                        : 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f6ecd0 60%, #efe2bb 100%)',
                    border: '1px solid rgba(212,175,55,0.35)',
                    boxShadow: 'inset 0 -8px 18px rgba(212,175,55,0.08), inset 0 4px 10px rgba(255,255,255,0.6), 0 4px 12px rgba(26,26,26,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    flexShrink: 0
                }}>
                    {!image && (
                        <div style={{ width: '52px', height: '52px' }}>
                            {icon}
                        </div>
                    )}
                </div>

                <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1a1a1a',
                    fontFamily: 'var(--font-baskerville)',
                    letterSpacing: '0.02em',
                    lineHeight: 1.25,
                    position: 'relative',
                    zIndex: 1
                }}>
                    {label}
                </div>

                {hint && (
                    <div style={{
                        fontSize: '9px',
                        color: GOLD,
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1
                    }}>
                        {hint}
                    </div>
                )}
            </motion.div>
        </Link>
    )
}
