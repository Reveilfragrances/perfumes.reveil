'use client'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Slide = {
    id: string
    title: string | null
    image_url: string
    video_url?: string
    link: string | null
    display_order: number
    button_label?: string
}

export default function HeroCarousel({ slides }: { slides: Slide[] }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 40,
        startIndex: 0
    })
    const [current, setCurrent] = useState(0)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        if (!emblaApi) return

        let intervalId: NodeJS.Timeout
        const activeSlide = slides[current]

        // Snappy pacing for navigation
        if (!activeSlide?.video_url) {
            intervalId = setInterval(() => emblaApi.scrollNext(), 8000)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [emblaApi, current, slides])

    useEffect(() => {
        if (!emblaApi) return
        const onSelect = () => {
            setCurrent(emblaApi.selectedScrollSnap())
        }
        emblaApi.on('select', onSelect)
        return () => {
            emblaApi.off('select', onSelect)
        }
    }, [emblaApi])

    const scrollTo = useCallback(
        (i: number) => emblaApi?.scrollTo(i),
        [emblaApi]
    )

    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

    if (slides.length === 0) return null

    return (
        <div style={{ position: 'relative', overflow: 'hidden' }} ref={emblaRef}>
            <div style={{ display: 'flex' }}>
                {slides.map((slide, i) => (
                    <div key={slide.id} style={{ flex: '0 0 100%', minWidth: 0, position: 'relative' }}>
                        <SlideMedia
                            slide={slide}
                            isActive={current === i}
                            emblaApi={emblaApi}
                            isMobile={isMobile}
                        />
                    </div>
                ))}
            </div>

            {/* Premium Dash Indicators & Navigation */}
            {slides.length > 1 && (
                <div style={{
                    position: 'absolute',
                    bottom: isMobile ? '40px' : '60px',
                    left: isMobile ? '24px' : '120px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '20px' : '32px',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => scrollTo(i)}
                                style={{
                                    width: i === current ? (isMobile ? '40px' : '60px') : '15px',
                                    height: '3px',
                                    background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                                    border: 'none', cursor: 'pointer', padding: 0,
                                    borderRadius: '10px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                            />
                        ))}
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: isMobile ? '8px' : '16px',
                        borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.25)',
                        paddingLeft: isMobile ? '0' : '32px'
                    }}>
                        <button
                            onClick={scrollPrev}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: '#fff', opacity: 0.75, padding: '8px',
                                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
                                transition: 'all 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
                        >
                            <ChevronLeft size={isMobile ? 18 : 20} strokeWidth={1.5} />
                        </button>
                        <button
                            onClick={scrollNext}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: '#fff', opacity: 0.75, padding: '8px',
                                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
                                transition: 'all 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
                        >
                            <ChevronRight size={isMobile ? 18 : 20} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function SlideMedia({ slide, isActive, emblaApi, isMobile }: { slide: Slide, isActive: boolean, emblaApi: any, isMobile: boolean }) {
    const [isLoaded, setIsLoaded] = useState(false)

    // Multi-layered loading strategy for maximum reliability
    useEffect(() => {
        setIsLoaded(false)
        // Always show content — don't gate on media loading
        const timer = setTimeout(() => setIsLoaded(true), 100)
        return () => clearTimeout(timer)
    }, [slide.id])

    return (
        <div style={{ position: 'relative', height: isMobile ? '90vh' : '100vh', width: '100%', overflow: 'hidden', background: '#f8f7f2' }}>

            {/* Premium Placeholder State */}
            {!isLoaded && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at center, #f3eee2 0%, #f8f7f2 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0
                }}>
                    <div style={{
                        width: '40px', height: '40px', border: '1px solid rgba(212,175,55,0.2)',
                        borderTop: '1px solid #d4af37', borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    `}</style>
                </div>
            )}

            {/* Background Media */}
            <motion.div
                animate={{
                    opacity: isActive ? 1 : 0,
                    scale: isActive ? 1.05 : 1.1
                }}
                transition={{
                    opacity: { duration: 0.8, ease: "easeOut" },
                    scale: { duration: 25, ease: "linear" }
                }}
                style={{ height: '100%', width: '100%', position: 'relative' }}
            >
                {/* Visual Placeholder (Poster) - Always there for instant reveal */}
                {slide.image_url && (
                    <Image
                        src={slide.image_url}
                        alt={slide.title || ''}
                        fill
                        priority={isActive}
                        sizes="100vw"
                        style={{
                            objectFit: 'cover',
                            objectPosition: isMobile ? '18% center' : 'center',
                            filter: 'brightness(0.45) contrast(1.08) saturate(0.88)',
                            opacity: (slide.video_url && isLoaded) ? 0 : 1,
                            transition: 'opacity 1s ease'
                        }}
                    />
                )}

                {slide.video_url && (
                    <video
                        src={slide.video_url}
                        autoPlay={isActive}
                        muted
                        playsInline
                        preload="auto"
                        onLoadedData={() => setIsLoaded(true)}
                        onPlaying={() => setIsLoaded(true)}
                        onEnded={() => {
                            setTimeout(() => emblaApi?.scrollNext(), 3000)
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'brightness(0.5) contrast(1.1)',
                            opacity: isLoaded ? 1 : 0,
                            transition: 'opacity 0.8s ease'
                        }}
                    />
                )}
            </motion.div>



            {/* Side Light Sweep Effect */}
            <motion.div
                initial={{ x: '-100%', opacity: 0 }}
                animate={isActive ? { x: '100%', opacity: [0, 0.25, 0] } : {}}
                transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 }}
                style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
                    zIndex: 1, pointerEvents: 'none'
                }}
            />

            {/* Content Overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                padding: isMobile ? '0 16px 0 12px' : '0 80px 0 60px',
                textAlign: 'left', zIndex: 2,
                pointerEvents: isActive ? 'auto' : 'none'
            }}>
                <div style={{ maxWidth: isMobile ? '100%' : '900px' }}>
                    <motion.div
                        initial="initial"
                        animate={isActive ? "animate" : "initial"}
                        variants={{
                            animate: {
                                transition: {
                                    staggerChildren: 0.1,
                                    delayChildren: 0.2
                                }
                            }
                        }}
                    >
                        <div style={{ overflow: 'hidden', marginBottom: isMobile ? '16px' : '24px' }}>
                            <motion.div
                                variants={{
                                    initial: { clipPath: 'inset(100% 0% 0% 0%)', y: '100%' },
                                    animate: { clipPath: 'inset(0% 0% 0% 0%)', y: 0 }
                                }}
                                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                    fontSize: isMobile ? '10px' : '11px',
                                    fontWeight: 400,
                                    letterSpacing: isMobile ? '0.5em' : '0.8em',
                                    color: '#d4af37',
                                    textTransform: 'uppercase',
                                    fontFamily: 'var(--font-baskerville)'
                                }}
                            >
                                Reveil Collection
                            </motion.div>
                        </div>

                        {slide.title && (
                            <h2 style={{
                                color: '#fff',
                                // Dynamic scaling based on title length
                                fontSize: isMobile
                                    ? 'clamp(32px, 10vw, 48px)'
                                    : (slide.title.length > 20
                                        ? 'clamp(24px, 4.5vw, 72px)'
                                        : 'clamp(32px, 6vw, 100px)'),
                                fontWeight: 900,
                                margin: isMobile ? '0 0 24px' : '0 0 40px',
                                lineHeight: 1.1,
                                fontFamily: 'var(--font-baskerville)',
                                letterSpacing: '-0.03em',
                                overflow: 'hidden',
                                maxWidth: isMobile ? '100%' : '1100px',
                                textShadow: '0 4px 24px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.35)'
                            }}>
                                <motion.div
                                    variants={{
                                        initial: { clipPath: 'inset(100% 0% 0% 0%)', y: '100%' },
                                        animate: { clipPath: 'inset(0% 0% 0% 0%)', y: 0 }
                                    }}
                                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ display: 'flex', flexWrap: 'wrap' }}
                                >
                                    {slide.title?.split(' ').map((word, i) => {
                                        const lowerWord = word.toLowerCase()
                                        const isAccent = lowerWord.includes('meena') || lowerWord.includes('stones') || lowerWord.includes('scent') || lowerWord.includes('collection') || lowerWord.includes('wildstone') || lowerWord.includes('feel') || lowerWord.includes('premium')
                                        return (
                                            <span key={i} style={{
                                                color: isAccent ? '#d4af37' : '#fff',
                                                fontStyle: isAccent ? 'italic' : 'normal',
                                                fontWeight: isAccent ? 600 : 900,
                                                marginRight: '0.25em'
                                            }}>
                                                {word}
                                            </span>
                                        )
                                    })}
                                </motion.div>
                            </h2>
                        )}

                        <div style={{ marginTop: '20px' }}>
                            <motion.div
                                variants={{
                                    initial: { clipPath: 'inset(100% 0% 0% 0%)', y: '100%' },
                                    animate: { clipPath: 'inset(0% 0% 0% 0%)', y: 0 }
                                }}
                                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <motion.a
                                    href={slide.link || "/products"}
                                    whileHover={!isMobile ? {
                                        backgroundColor: '#d4af37',
                                        color: '#000',
                                        borderRadius: '0px',
                                        scale: 1.05,
                                        letterSpacing: '0.4em'
                                    } : {}}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    style={{
                                        display: 'inline-block',
                                        padding: isMobile ? '14px 32px' : 'clamp(14px, 1.5vw, 20px) clamp(32px, 3.5vw, 60px)',
                                        background: '#1a1a1a', color: '#fff',
                                        borderRadius: '100px', fontWeight: 700,
                                        fontSize: isMobile ? '10px' : 'clamp(10px, 0.8vw, 13px)',
                                        textTransform: 'uppercase',
                                        letterSpacing: isMobile ? '0.2em' : '0.3em',
                                        textDecoration: 'none',
                                        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                                        border: '1px solid transparent'
                                    }}
                                >
                                    {slide.button_label || 'Shop Now'}
                                </motion.a>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
