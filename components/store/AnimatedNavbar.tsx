'use client'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import Link from 'next/link'
import { ShoppingBag, User, Menu, X, Heart, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useLenis } from 'lenis/react'


export function AnimatedNavbar() {
    const pathname = usePathname()
    const isDarkPage = pathname === '/orders'
    const textColor = '#d4af37'
    const [isAccountHovered, setIsAccountHovered] = useState(false)
    const [isShopHovered, setIsShopHovered] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [userName, setUserName] = useState<string | null>(null)
    const [cartItems, setCartItems] = useState<any[]>([])
    const [cartTotals, setCartTotals] = useState({ subtotal: 0, total: 0 })
    const [isCartLoading, setIsCartLoading] = useState(false)
    const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
    const [isShopOpen, setIsShopOpen] = useState(false)
    const router = useRouter()
    const lenis = useLenis()
    const isFetchingRef = useRef(false)


    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)

        // Auth state listener — also fetch profile name on login
        const fetchProfileName = async (userId: string) => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('first_name, full_name')
                    .eq('id', userId)
                    .maybeSingle()
                if (data) {
                    setUserName(data.first_name || data.full_name?.split(' ')[0] || null)
                }
            } catch {
                // fail silently
            }
        }

        // Initialize Auth
        const initAuth = async () => {
            // First check if there's a session in the hash (implicit fallback)
            if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    setUser(session.user)
                    fetchProfileName(session.user.id)
                    // If we're on a page that needs a clean URL, we could router.replace here
                }
            } else {
                const { data: { session } } = await supabase.auth.getSession()
                setUser(session?.user ?? null)
                if (session?.user) fetchProfileName(session.user.id)
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            console.log('Auth Event:', event)
            setUser(session?.user ?? null)

            if (session?.user) {
                fetchProfileName(session.user.id)
            } else {
                setUserName(null)
            }
        })

        return () => {
            window.removeEventListener('resize', checkMobile)
            subscription.unsubscribe()
        }
    }, [])

    // Secret Admin Access via Shortcut: Shift + Alt + A
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey && e.altKey && (e.key === 'A' || e.key === 'a')) {
                router.push('/static-v2-resource-policy-handler/login')
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }
    const fetchCart = async (showLoading = true) => {
        if (!user || isFetchingRef.current) return
        if (showLoading) setIsCartLoading(true)
        isFetchingRef.current = true
        try {
            const res = await fetch('/api/cart')
            if (res.ok) {
                const data = await res.json()
                const items = data.items || []
                const subtotal = items.reduce((sum: number, item: any) => {
                    return sum + ((item.products as any)?.price ?? 0) * item.quantity
                }, 0)
                setCartItems(items)
                setCartTotals({ subtotal, total: subtotal })
            }
        } catch (error) {
            console.error('Cart fetch error:', error)
        } finally {
            if (showLoading) setIsCartLoading(false)
            isFetchingRef.current = false
        }
    }

    const handleRemoveItem = async (itemId: string) => {
        try {
            const res = await fetch(`/api/cart/${itemId}`, {
                method: 'DELETE' 
            })
            if (res.ok) {
                // Refresh cart locally for instant feedback
                setCartItems(prev => {
                    const updatedItems = prev.filter(item => item.id !== itemId)
                    const subtotal = updatedItems.reduce((sum: number, item: any) => {
                        return sum + ((item.products as any)?.price ?? 0) * item.quantity
                    }, 0)
                    setCartTotals({ subtotal, total: subtotal })
                    return updatedItems
                })
            }
        } catch (error) {
            console.error('Remove error:', error)
        }
    }

    // Initial fetch and event listener
    useEffect(() => {
        fetchCart(false) // Don't show loading on background fetch

        const handleCartUpdate = () => fetchCart(false)
        window.addEventListener('cart-updated', handleCartUpdate)
        return () => window.removeEventListener('cart-updated', handleCartUpdate)
    }, [user])

    // Fetch on open
    useEffect(() => {
        if (isCartOpen) {
            fetchCart(true)
        }
    }, [isCartOpen])

    // Fetch categories (dynamic — reflects whatever admin has configured)
    useEffect(() => {
        let cancelled = false
        fetch('/api/categories')
            .then(r => r.ok ? r.json() : [])
            .then((data) => {
                if (cancelled || !Array.isArray(data)) return
                setCategories(data.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })))
            })
            .catch(() => { })
        return () => { cancelled = true }
    }, [])

    // Collapse Shop dropdown when menu closes
    useEffect(() => {
        if (!isMobileMenuOpen) setIsShopOpen(false)
    }, [isMobileMenuOpen])


    useEffect(() => {
        if (isMobileMenuOpen || isCartOpen) {
            const scrollY = window.scrollY;
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.dataset.scrollY = String(scrollY);
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.body.style.paddingRight = `${scrollBarWidth}px`;
            if (lenis) lenis.stop()
        } else {
            const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            document.body.style.paddingRight = '';
            delete document.body.dataset.scrollY;
            if (savedY) window.scrollTo(0, savedY);
            if (lenis) lenis.start()
        }
    }, [isMobileMenuOpen, isCartOpen, lenis])

    const containerVariants: Variants = {
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
            }
        }
    }

    const itemVariants: Variants = {
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
            }
        }
    }

    const dropdownVariants: Variants = {
        hidden: { opacity: 0, y: 10, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.3,
                ease: "easeOut"
            }
        },
        exit: {
            opacity: 0,
            y: 10,
            scale: 0.95,
            transition: {
                duration: 0.2
            }
        }
    }

    const capsuleStyle: React.CSSProperties = {
        background: 'rgba(10, 10, 10, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '999px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    }

    return (
        <motion.nav
            animate="visible"
            variants={containerVariants}
            style={{
                background: isMobileMenuOpen ? '#f8f7f2' : 'transparent',
                position: 'fixed', top: isMobileMenuOpen ? 0 : (isMobile ? '10px' : '20px'), left: 0, right: 0, zIndex: 100,
                padding: isMobile ? '0 24px' : '0 75px',
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >



            <div style={{
                maxWidth: '1400px', margin: '0 auto',
                display: 'flex',
                height: isMobile ? '48px' : '68px',
                alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>



                <motion.div
                    variants={itemVariants}
                    style={{
                        ...capsuleStyle,
                        padding: isMobile ? '0 16px' : '0 24px',
                        height: '100%',
                        marginLeft: '0'
                    }}
                >



                    <Link href="/" onClick={() => setIsMobileMenuOpen(false)} style={{
                        display: 'flex', alignItems: 'center', height: '100%'
                    }}>
                        <img
                            src="https://lhnamtkpjkrawgql.public.blob.vercel-storage.com/LOGO.webp"
                            alt="Reveil Logo"
                            style={{
                                height: isMobile ? '36px' : '54px',
                                width: 'auto',
                                filter: isDarkPage ? 'brightness(1.1)' : 'none',
                                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}

                        />



                    </Link>
                </motion.div>



                {/* Desktop Navigation */}
                {!isMobile && (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{
                            ...capsuleStyle,
                            padding: '6px 32px',
                            gap: '40px'
                        }}>


                            <motion.div
                                variants={itemVariants}
                                onMouseEnter={() => setIsShopHovered(true)}
                                onMouseLeave={() => setIsShopHovered(false)}
                                style={{ position: 'relative', padding: '10px 0' }}
                            >
                                <Link href="/products" style={{ textDecoration: 'none' }}>
                                    <motion.span
                                        whileHover="hover"
                                        style={{
                                            color: textColor, display: 'block', fontSize: '13px',
                                            letterSpacing: '0.15em', fontWeight: 500,
                                            fontFamily: 'var(--font-baskerville)',
                                            position: 'relative',
                                            padding: '0'
                                        }}
                                    >
                                        Shop
                                        <motion.div
                                            variants={{
                                                hover: { scaleX: 1, opacity: 1 }
                                            }}
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                            style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                height: '1px', background: textColor, originX: 0.5
                                            }}
                                        />
                                    </motion.span>
                                </Link>

                                <AnimatePresence>
                                    {isShopHovered && (
                                        <motion.div
                                            variants={dropdownVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: '-20px',
                                                background: 'rgba(10, 10, 10, 0.85)',
                                                backdropFilter: 'blur(12px)',
                                                WebkitBackdropFilter: 'blur(12px)',
                                                border: '1px solid rgba(212,175,55,0.2)',
                                                padding: '12px 0',
                                                marginTop: '4px',
                                                minWidth: '220px',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <Link href="/products" style={{
                                                    padding: '10px 24px',
                                                    color: textColor,
                                                    textDecoration: 'none',
                                                    fontSize: '11px',
                                                    letterSpacing: '0.25em',
                                                    fontFamily: 'var(--font-baskerville)',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 600,
                                                    transition: 'all 0.3s',
                                                    display: 'block'
                                                }}
                                                    onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                                                    onMouseOut={(e) => e.currentTarget.style.color = textColor}
                                                >
                                                    All Products
                                                </Link>

                                                {categories.length > 0 && (
                                                    <div style={{ height: '1px', background: 'rgba(212,175,55,0.15)', margin: '4px 24px' }} />
                                                )}

                                                {categories.map((cat) => (
                                                    <Link
                                                        key={cat.id}
                                                        href={`/products?category=${cat.slug}`}
                                                        style={{
                                                            padding: '10px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s',
                                                            display: 'block'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                        onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                    >
                                                        {cat.name}
                                                    </Link>
                                                ))}

                                                {categories.length === 0 && (
                                                    <span style={{
                                                        padding: '10px 24px',
                                                        fontSize: '10px',
                                                        color: 'rgba(255,255,255,0.4)',
                                                        letterSpacing: '0.2em',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        Loading…
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            <motion.div variants={itemVariants}>
                                <Link href="/orders" style={{ textDecoration: 'none' }}>
                                    <motion.span
                                        whileHover="hover"
                                        style={{
                                            color: textColor, display: 'block', fontSize: '13px',
                                            letterSpacing: '0.15em', fontWeight: 500,
                                            fontFamily: 'var(--font-baskerville)',
                                            position: 'relative',
                                            padding: '0'
                                        }}

                                    >
                                        Orders
                                        <motion.div
                                            variants={{
                                                hover: { scaleX: 1, opacity: 1 }
                                            }}
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                            style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                height: '1px', background: textColor, originX: 0.5
                                            }}
                                        />
                                    </motion.span>
                                </Link>
                            </motion.div>

                            <motion.div variants={itemVariants}>
                                <Link href="/wishlist" style={{ textDecoration: 'none' }}>
                                    <motion.span
                                        whileHover="hover"
                                        style={{
                                            color: textColor, display: 'block', fontSize: '13px',
                                            letterSpacing: '0.15em', fontWeight: 500,
                                            fontFamily: 'var(--font-baskerville)',
                                            position: 'relative',
                                            padding: '0'
                                        }}

                                    >
                                        Wishlist
                                        <motion.div
                                            variants={{
                                                hover: { scaleX: 1, opacity: 1 }
                                            }}
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                            style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                height: '1px', background: textColor, originX: 0.5
                                            }}
                                        />
                                    </motion.span>
                                </Link>
                            </motion.div>

                            <motion.div variants={itemVariants}>
                                <a
                                    href="https://www.refreshub.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <motion.span
                                        whileHover="hover"
                                        style={{
                                            color: textColor, display: 'block', fontSize: '13px',
                                            letterSpacing: '0.15em', fontWeight: 500,
                                            fontFamily: 'var(--font-baskerville)',
                                            position: 'relative',
                                            padding: '0'
                                        }}
                                    >
                                        Refreshub
                                        <motion.div
                                            variants={{ hover: { scaleX: 1, opacity: 1 } }}
                                            initial={{ scaleX: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                            style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                height: '1px', background: textColor, originX: 0.5
                                            }}
                                        />
                                    </motion.span>
                                </a>
                            </motion.div>

                            <motion.div
                                variants={itemVariants}
                                onMouseEnter={() => setIsAccountHovered(true)}
                                onMouseLeave={() => setIsAccountHovered(false)}
                                style={{ position: 'relative', padding: '10px 0' }}
                            >
                                <motion.span
                                    whileHover="hover"
                                    style={{
                                        color: textColor, cursor: 'pointer', fontSize: '13px',
                                        letterSpacing: '0.15em', fontWeight: 500,
                                        fontFamily: 'var(--font-baskerville)',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        position: 'relative',
                                        padding: '4px 0'
                                    }}>
                                    {user ? (userName ? `Hi, ${userName}` : 'Profile') : 'Account'}

                                    <motion.div
                                        variants={{
                                            hover: { scaleX: 1, opacity: 1 }
                                        }}
                                        initial={{ scaleX: 0, opacity: 0 }}
                                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                        style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            height: '1px', background: textColor, originX: 0.5
                                        }}
                                    />
                                </motion.span>

                                <AnimatePresence>
                                    {isAccountHovered && (
                                        <motion.div
                                            variants={dropdownVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: '-20px',
                                                background: 'rgba(10, 10, 10, 0.85)',
                                                backdropFilter: 'blur(12px)',
                                                WebkitBackdropFilter: 'blur(12px)',
                                                border: '1px solid rgba(212,175,55,0.2)',
                                                padding: '16px 0',
                                                marginTop: '4px',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {user ? (
                                                    <>
                                                        <Link href="/profile" style={{
                                                            padding: '12px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s',
                                                            display: 'block'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            My Profile
                                                        </Link>
                                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />
                                                        <Link href="/address-book" style={{
                                                            padding: '12px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s',
                                                            display: 'block',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            My Addresses
                                                        </Link>
                                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />
                                                        <Link href="/track-order" style={{
                                                            padding: '12px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s',
                                                            display: 'block',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            Track Order
                                                        </Link>
                                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />
                                                        <button
                                                            onClick={handleLogout}
                                                            style={{
                                                                padding: '12px 24px',
                                                                color: '#fff',
                                                                background: 'none',
                                                                border: 'none',
                                                                textAlign: 'left',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                letterSpacing: '0.2em',
                                                                fontFamily: 'var(--font-baskerville)',
                                                                textTransform: 'uppercase',
                                                                transition: 'all 0.3s',
                                                                width: '100%'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = '#ff4b4b'}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            Logout
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link href="/auth?mode=login" style={{
                                                            padding: '12px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            Log In
                                                        </Link>
                                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />
                                                        <Link href="/auth?mode=signup" style={{
                                                            padding: '12px 24px',
                                                            color: '#fff',
                                                            textDecoration: 'none',
                                                            fontSize: '11px',
                                                            letterSpacing: '0.2em',
                                                            fontFamily: 'var(--font-baskerville)',
                                                            textTransform: 'uppercase',
                                                            transition: 'all 0.3s'
                                                        }}
                                                            onMouseOver={(e) => e.currentTarget.style.color = textColor}
                                                            onMouseOut={(e) => e.currentTarget.style.color = '#fff'}
                                                        >
                                                            Sign Up
                                                        </Link>
                                                    </>
                                                )}
                                            </div>

                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>

                        <motion.div
                            variants={itemVariants}
                            style={{
                                ...capsuleStyle,
                                padding: '18px 18px'
                            }}
                        >

                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setIsCartOpen(true) }}
                                style={{ background: 'none', border: 'none', color: textColor, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.15, color: '#fff' }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                    style={{ position: 'relative' }}
                                >
                                    <ShoppingBag size={20} strokeWidth={1} />
                                    {cartItems.length > 0 && (
                                        <div style={{
                                            position: 'absolute', top: '-6px', right: '-8px',
                                            background: '#ff4b4b', color: '#fff',
                                            fontSize: '9px', fontWeight: 'bold',
                                            width: '16px', height: '16px',
                                            borderRadius: '50%', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {cartItems.length}
                                        </div>
                                    )}
                                </motion.div>
                            </button>
                        </motion.div>
                    </div>
                )}


                {/* Mobile Navigation Controls */}
                {isMobile && (
                    <div style={{
                        ...capsuleStyle,
                        padding: '6px 12px',
                        gap: '24px'
                    }}>

                        <motion.div variants={itemVariants}>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setIsCartOpen(true); setIsMobileMenuOpen(false); }}
                                style={{ background: 'none', border: 'none', color: textColor, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0, position: 'relative' }}
                            >
                                <ShoppingBag size={22} strokeWidth={1.5} />
                                {cartItems.length > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '-6px', right: '-8px',
                                        background: '#ff4b4b', color: '#fff',
                                        fontSize: '9px', fontWeight: 'bold',
                                        width: '16px', height: '16px',
                                        borderRadius: '50%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {cartItems.length}
                                    </div>
                                )}
                            </button>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: textColor,
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {isMobileMenuOpen ? <X size={28} strokeWidth={1.5} /> : <Menu size={28} strokeWidth={1.5} />}
                            </button>
                        </motion.div>
                    </div>
                )}

            </div>

            {/* Mobile Menu Overlay - High-End Redesign */}
            <AnimatePresence>
                {isMobile && isMobileMenuOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            position: 'fixed', inset: 0,
                            background: '#f8f7f2', zIndex: 110,
                            display: 'flex', flexDirection: 'column',
                            padding: '80px 40px 40px',
                            overflowY: 'auto',
                            overscrollBehavior: 'contain',
                            WebkitOverflowScrolling: 'touch',
                            willChange: 'transform',
                            transform: 'translate3d(0,0,0)',
                            backfaceVisibility: 'hidden'
                        }}
                    >
                        {/* Decorative Background Element */}
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "circOut" }}
                            style={{
                                position: 'absolute', top: 0, right: 0, bottom: 0,
                                width: '2px', background: 'linear-gradient(to bottom, transparent, #d4af37, transparent)',
                                opacity: 0.3
                            }}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Brand Logo in Overlay */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                style={{ marginBottom: '24px' }}
                            >
                                <img
                                    src="https://lhnamtkpjkrawgql.public.blob.vercel-storage.com/LOGO.webp"
                                    alt="Reveil Logo"
                                    style={{ height: '48px', width: 'auto', display: 'block' }}
                                />
                            </motion.div>

                            {[
                                { name: 'Shop', href: '/products', always: true, hasDropdown: true },
                                { name: 'Orders', href: '/orders', always: true },
                                { name: 'Wishlist', href: '/wishlist', always: true },
                                { name: 'My Addresses', href: '/address-book', loggedIn: true },
                                { name: 'Track Order', href: '/track-order', always: true },
                                { name: 'Refreshub', href: 'https://www.refreshub.com', always: true, external: true },
                                ...(!user ? [
                                    { name: 'Login', href: '/auth?mode=login', always: true },
                                    { name: 'Register', href: '/auth?mode=signup', always: true }
                                ] : [])
                            ].map((link: any, i) => (
                                <motion.div
                                    key={link.name}
                                    initial={{ opacity: 0, y: 30, rotateX: -30 }}
                                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                    transition={{
                                        duration: 0.8,
                                        delay: 0.1 * i + 0.3,
                                        ease: [0.16, 1, 0.3, 1]
                                    }}
                                >
                                    {link.hasDropdown ? (
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setIsShopOpen(v => !v)}
                                                aria-expanded={isShopOpen}
                                                style={{
                                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                    fontSize: 'clamp(20px, 6.5vw, 28px)',
                                                    fontFamily: 'var(--font-baskerville)',
                                                    color: '#1a1a1a',
                                                    letterSpacing: '0.01em',
                                                    fontWeight: 500,
                                                    lineHeight: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    width: '100%',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <span>{link.name}</span>
                                                <motion.span
                                                    animate={{ rotate: isShopOpen ? 180 : 0 }}
                                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                    style={{ display: 'inline-flex', color: '#d4af37' }}
                                                >
                                                    <ChevronDown size={22} strokeWidth={1.5} />
                                                </motion.span>
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {isShopOpen && (
                                                    <motion.div
                                                        key="shop-dropdown"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '14px',
                                                            paddingTop: '18px',
                                                            paddingLeft: '14px',
                                                            borderLeft: '1px solid rgba(212,175,55,0.35)',
                                                            marginLeft: '4px'
                                                        }}>
                                                            <Link
                                                                href="/products"
                                                                onClick={() => setIsMobileMenuOpen(false)}
                                                                style={{
                                                                    fontSize: '15px',
                                                                    fontFamily: 'var(--font-baskerville)',
                                                                    color: '#d4af37',
                                                                    textDecoration: 'none',
                                                                    letterSpacing: '0.18em',
                                                                    textTransform: 'uppercase',
                                                                    fontWeight: 500
                                                                }}
                                                            >
                                                                All Products
                                                            </Link>
                                                            {categories.map((cat) => (
                                                                <Link
                                                                    key={cat.id}
                                                                    href={`/products?category=${cat.slug}`}
                                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                                    style={{
                                                                        fontSize: '17px',
                                                                        fontFamily: 'var(--font-baskerville)',
                                                                        color: '#1a1a1a',
                                                                        textDecoration: 'none',
                                                                        letterSpacing: '0.02em',
                                                                        fontWeight: 400
                                                                    }}
                                                                >
                                                                    {cat.name}
                                                                </Link>
                                                            ))}
                                                            {categories.length === 0 && (
                                                                <span style={{
                                                                    fontSize: '12px',
                                                                    color: 'rgba(0,0,0,0.4)',
                                                                    letterSpacing: '0.15em',
                                                                    textTransform: 'uppercase'
                                                                }}>
                                                                    Loading…
                                                                </span>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : link.external ? (
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            style={{
                                                fontSize: 'clamp(20px, 6.5vw, 28px)',
                                                fontFamily: 'var(--font-baskerville)',
                                                color: '#1a1a1a',
                                                textDecoration: 'none',
                                                display: 'block',
                                                letterSpacing: '0.01em',
                                                fontWeight: 500,
                                                lineHeight: 1
                                            }}
                                        >
                                            <motion.span
                                                whileTap={{ x: 20, color: '#d4af37' }}
                                                style={{ display: 'inline-block' }}
                                            >
                                                {link.name}
                                            </motion.span>
                                        </a>
                                    ) : (
                                        <Link
                                            href={link.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            style={{
                                                fontSize: 'clamp(20px, 6.5vw, 28px)',
                                                fontFamily: 'var(--font-baskerville)',
                                                color: '#1a1a1a',
                                                textDecoration: 'none',
                                                display: 'block',
                                                letterSpacing: '0.01em',
                                                fontWeight: 500,
                                                lineHeight: 1
                                            }}
                                        >
                                            <motion.span
                                                whileTap={{ x: 20, color: '#d4af37' }}
                                                style={{ display: 'inline-block' }}
                                            >
                                                {link.name}
                                            </motion.span>
                                        </Link>
                                    )}
                                </motion.div>
                            ))}
                            {user && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30, rotateX: -30 }}
                                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                    transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <button
                                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false) }}
                                        style={{
                                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                            fontSize: 'clamp(20px, 6.5vw, 28px)',
                                            fontFamily: 'var(--font-baskerville)',
                                            color: '#c0392b',
                                            letterSpacing: '0.01em',
                                            fontWeight: 500,
                                            lineHeight: 1,
                                            textAlign: 'left'
                                        }}
                                    >
                                        Logout
                                    </button>
                                </motion.div>
                            )}
                        </div>



                        {/* Close button inside overlay for better UX */}
                        <motion.button
                            onClick={() => setIsMobileMenuOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            style={{
                                position: 'absolute', top: '24px', right: '24px',
                                background: 'rgba(0,0,0,0.04)',
                                border: '1px solid rgba(0,0,0,0.08)',
                                color: '#1a1a1a',
                                cursor: 'pointer', padding: '10px',
                                borderRadius: '50%'
                            }}
                        >
                            <X size={28} strokeWidth={1.5} />
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Drawer Overlay */}
            <AnimatePresence>
                {isCartOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={() => setIsCartOpen(false)}
                            style={{
                                position: 'fixed', inset: 0,
                                background: isMobile ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.6)',
                                ...(isMobile ? {} : { backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }),
                                zIndex: 200,
                                touchAction: 'none'
                            }}
                        />

                        {/* Drawer Content - Unique Luxury Design */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ duration: isMobile ? 0.32 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                position: 'fixed', top: 0, right: 0,
                                height: isMobile ? '100dvh' : '100vh',
                                width: isMobile ? '100%' : '480px',
                                background: 'linear-gradient(180deg, #ffffff 0%, #f8f7f2 100%)',
                                zIndex: 201,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isMobile ? 'none' : '-40px 0 80px rgba(0,0,0,0.15)',
                                borderLeft: '1px solid rgba(212,175,55,0.3)',
                                overflow: 'hidden',
                                willChange: 'transform',
                                transform: 'translate3d(0,0,0)',
                                backfaceVisibility: 'hidden'
                            }}
                        >
                            {/* Decorative Top Glow */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #d4af37, transparent)', opacity: 0.5 }} />

                            {/* Drawer Header */}
                            <div style={{ padding: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <h2 style={{
                                        fontSize: '24px',
                                        fontFamily: 'var(--font-baskerville)',
                                        color: '#d4af37',
                                        margin: 0,
                                        fontWeight: 300,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase'
                                    }}>
                                        Your Cart
                                    </h2>
                                    <span style={{ fontSize: '9px', color: '#d4af37', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                                        {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>
                                <motion.button
                                    whileHover={{ rotate: 90, scale: 1.1 }}
                                    onClick={() => setIsCartOpen(false)}
                                    style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37', cursor: 'pointer', padding: '12px', borderRadius: '50%', display: 'flex' }}
                                >
                                    <X size={20} strokeWidth={1} />
                                </motion.button>
                            </div>

                            {/* Unique Floating Banner */}
                            <div style={{ margin: '0 40px 20px', position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    background: 'linear-gradient(90deg, rgba(212,175,55,0.1), transparent)',
                                    padding: '12px 24px',
                                    borderLeft: '2px solid #d4af37',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4af37', boxShadow: '0 0 10px #d4af37' }} />
                                    <span style={{
                                        color: '#1a1a1a',
                                        fontSize: '9px',
                                        fontWeight: 600,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        opacity: 0.8
                                    }}>
                                        Free Shipping on All Orders
                                    </span>
                                </div>
                            </div>

                            {/* Cart Items Area */}
                            <div 
                                data-lenis-prevent
                                style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '0 40px 40px',
                                    overscrollBehavior: 'contain',
                                    WebkitOverflowScrolling: 'touch',
                                    minHeight: 0
                                }}
                            >
                                {isCartLoading ? (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Loader2 className="animate-spin" size={32} color="#d4af37" />
                                    </div>
                                ) : cartItems.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {cartItems.map((item) => (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                style={{
                                                    display: 'flex',
                                                    gap: '24px',
                                                    padding: '24px',
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(212,175,55,0.25)',
                                                    borderRadius: '4px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {/* Decorative background number */}
                                                <div style={{ position: 'absolute', right: '-10px', bottom: '-20px', fontSize: '100px', color: 'rgba(212,175,55,0.08)', fontFamily: 'var(--font-baskerville)', pointerEvents: 'none' }}>
                                                    {item.quantity}
                                                </div>

                                                <div style={{ width: '100px', height: '130px', background: '#f3eee2', borderRadius: '2px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }}>
                                                    <img src={item.products.images?.[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.products.name} />
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-baskerville)', color: '#1a1a1a', margin: 0, fontWeight: 400, letterSpacing: '0.05em' }}>{item.products.name}</h3>
                                                        <motion.button
                                                            whileHover={{ scale: 1.1, color: '#ff4d4d' }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.45)', cursor: 'pointer', padding: '4px' }}
                                                        >
                                                            <Trash2 size={14} strokeWidth={1.5} />
                                                        </motion.button>
                                                    </div>
                                                    <p style={{ fontSize: '9px', color: '#d4af37', margin: 0, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>{item.products.category || 'Atelier Collection'}</p>
                                                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                                        <span style={{ fontSize: '18px', color: '#1a1a1a', fontWeight: 400, fontFamily: 'var(--font-baskerville)' }}>₹{item.products.price.toLocaleString()}</span>
                                                        <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.4)' }}>× {item.quantity}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <ShoppingBag size={64} strokeWidth={0.5} color="rgba(212,175,55,0.3)" />
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                                transition={{ duration: 3, repeat: Infinity }}
                                                style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(212,175,55,0.2), transparent 70%)' }}
                                            />
                                        </div>
                                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <p style={{ color: '#1a1a1a', fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0, fontWeight: 400 }}>Your cart is empty</p>
                                            <p style={{ color: '#d4af37', fontSize: '10px', letterSpacing: '0.1em', margin: 0 }}>Add something to your cart to get started</p>
                                        </div>
                                        <Link href="/products" onClick={() => setIsCartOpen(false)} style={{ textDecoration: 'none' }}>
                                            <motion.button
                                                whileHover={{ scale: 1.05, letterSpacing: '0.5em' }}
                                                style={{
                                                    background: 'linear-gradient(90deg, #d4af37, #f2d06b)',
                                                    color: '#000',
                                                    border: 'none',
                                                    padding: '18px 50px',
                                                    borderRadius: '0',
                                                    fontSize: '10px',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3em',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 10px 30px rgba(212,175,55,0.2)'
                                                }}>
                                                Shop Now
                                            </motion.button>
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Summary Area - Glass Footer */}
                            <div style={{
                                padding: '40px',
                                borderTop: '1px solid rgba(212,175,55,0.3)',
                                background: 'rgba(255,255,255,0.6)',
                                backdropFilter: 'blur(20px)',
                                position: 'relative',
                                flexShrink: 0
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.55)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Subtotal</span>
                                        <span style={{ fontSize: '11px', color: '#d4af37', letterSpacing: '0.1em' }}>Free Shipping Included</span>
                                    </div>
                                    <span style={{ fontSize: '28px', color: '#1a1a1a', fontWeight: 300, fontFamily: 'var(--font-baskerville)' }}>₹{cartTotals.subtotal.toLocaleString()}</span>
                                </div>
                                <Link href="/cart" onClick={() => setIsCartOpen(false)} style={{ textDecoration: 'none' }}>
                                    <motion.button
                                        whileHover={cartItems.length > 0 ? { y: -5, boxShadow: '0 15px 40px rgba(212,175,55,0.3)' } : {}}
                                        disabled={cartItems.length === 0}
                                        style={{
                                            width: '100%',
                                            background: cartItems.length > 0 ? 'linear-gradient(90deg, #d4af37, #f2d06b)' : 'rgba(0,0,0,0.06)',
                                            color: cartItems.length > 0 ? '#000' : 'rgba(0,0,0,0.35)',
                                            border: 'none',
                                            padding: '24px',
                                            borderRadius: '0',
                                            fontSize: '12px',
                                            fontWeight: 900,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.4em',
                                            cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}
                                    >
                                        CHECKOUT
                                    </motion.button>
                                </Link>

                                {/* Additional Info */}
                                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '8px', color: 'rgba(0,0,0,0.35)', letterSpacing: '0.4em', textTransform: 'uppercase' }}>
                                        Safe & secure checkout
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.nav>
    )
}
