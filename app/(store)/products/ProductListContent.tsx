'use client'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, LayoutGrid, List, SlidersHorizontal, Filter, Plus, Loader2, Sparkles } from 'lucide-react'
import { PremiumLoader } from '@/components/store/PremiumLoader'
import { useSearchParams } from 'next/navigation'
import ProductCard from '@/components/store/ProductCard'
import { Product } from '@/types/store'
import { createClient } from '@/lib/supabase/client'

export function ProductListContent() {
    const searchParams = useSearchParams()
    const initialSearch = searchParams.get('search') || ""
    const initialCategory = searchParams.get('category') || "ALL"

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [searchQuery, setSearchQuery] = useState(initialSearch)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [sortBy, setSortBy] = useState("Featured")
    const [selectedConcentrations, setSelectedConcentrations] = useState<string[]>([])
    const [selectedStatus, setSelectedStatus] = useState<string[]>([])
    const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set())

    const supabase = createClient()

    useEffect(() => {
        async function fetchProducts() {
            try {
                // Cap at 500 so a runaway catalog doesn't OOM the browser.
                // Sufficient for current SKU count; raise when the catalog grows.
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500)

                if (error) throw error
                setProducts(data || [])
            } catch (err) {
                console.error('Error fetching products:', err)
            } finally {
                setLoading(false)
            }
        }
        async function fetchWishlist() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                const { data } = await supabase
                    .from('wishlists')
                    .select('product_id')
                    .eq('user_id', user.id)
                if (data) setWishlistedIds(new Set(data.map((r: any) => r.product_id)))
            } catch (err) {
                console.error('Error fetching wishlist:', err)
            }
        }
        fetchProducts()
        fetchWishlist()

        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const categories = useMemo(() => {
        const uniqueCats = Array.from(new Set(products.map(p => (p.category || 'UNCATEGORIZED').toUpperCase())))
        return ["ALL", ...uniqueCats]
    }, [products])

    const filteredAndSortedProducts = useMemo(() => {
        let filtered = products.filter(p => {
            const matchesCat = selectedCategory === "ALL" || p.category?.toUpperCase() === selectedCategory.toUpperCase()
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesConc = selectedConcentrations.length === 0 || (p.technical_specs?.concentration && selectedConcentrations.includes(p.technical_specs.concentration))

            let matchesStatus = true
            if (selectedStatus.length > 0) {
                matchesStatus = false
                if (selectedStatus.includes("In Stock") && p.stock > 0) matchesStatus = true
                if (selectedStatus.includes("Limited Edition") && p.category === "LIMITED") matchesStatus = true
                if (selectedStatus.includes("Wishlisted") && wishlistedIds.has(p.id)) matchesStatus = true
            }

            return matchesCat && matchesSearch && matchesConc && matchesStatus
        })

        switch (sortBy) {
            case "Price: Low to High":
                filtered.sort((a, b) => a.price - b.price)
                break
            case "Price: High to Low":
                filtered.sort((a, b) => b.price - a.price)
                break
            case "Featured":
            default:
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
                break
        }

        return filtered
    }, [selectedCategory, searchQuery, products, selectedConcentrations, selectedStatus, sortBy, wishlistedIds])

    return (
        <main style={{ background: '#f8f7f2', minHeight: '100vh', color: '#1a1a1a', display: 'flex', flexDirection: 'column', maxWidth: '100vw' }}>
            {/* SECTION 1: TOP HERO (FIXED) */}
            {!isMobile && (
            <section style={{
                padding: isMobile ? '100px 0 20px' : '30px 0 10px',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(to bottom, #f3eee2, #f8f7f2)',
                borderBottom: '1px solid rgba(0,0,0,0.03)'
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0)',
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(to bottom, black, transparent)'
                }} />

                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '0 24px' : '0 60px', position: 'relative' }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        fontSize: '15vw', color: 'rgba(0,0,0,0.012)', fontWeight: 900,
                        pointerEvents: 'none', zIndex: 0, letterSpacing: '-0.05em'
                    }}>
                        02
                    </div>

                    <div style={{ 
                        display: 'flex', flexDirection: 'column',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        justifyContent: 'center',
                        position: 'relative', zIndex: 1, width: '100%',
                        gap: isMobile ? '6px' : '14px'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                            style={{ textAlign: isMobile ? 'left' : 'center' }}
                        >
                            <h1 style={{ margin: 0 }}>
                                <span style={{
                                    fontSize: isMobile ? '32px' : 'clamp(40px, 8vw, 80px)',
                                    fontWeight: 300, letterSpacing: '-0.04em', color: '#1a1a1a', lineHeight: 0.85, display: 'block'
                                }}>
                                    Re<span style={{ color: '#d4af37', fontWeight: 400 }}>veil</span>
                                </span>
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1.5, delay: 0.5 }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', gap: '16px' }}
                        >
                            <div style={{ width: '24px', height: '1px', background: 'rgba(212,175,55,0.3)' }} />
                            <span style={{
                                fontSize: isMobile ? '8px' : '10px',
                                letterSpacing: '0.35em',
                                color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', fontWeight: 500
                            }}>
                                Studio Archive
                            </span>
                            <div style={{ width: '24px', height: '1px', background: 'rgba(212,175,55,0.3)' }} />
                        </motion.div>
                    </div>
                </div>
            </section>
            )}

            {isMobile && (
                <div style={{
                    position: 'sticky', top: '56px', zIndex: 50, background: 'rgba(248,247,242,0.98)',
                    backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)',
                    marginTop: '72px',
                    padding: '12px 0', overflowX: 'auto', scrollbarWidth: 'none',
                    display: 'flex', gap: '8px', paddingLeft: '16px', paddingRight: '16px',
                    msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
                    maxWidth: '100vw', width: '100%', boxSizing: 'border-box'
                }}>
                    {categories.map(cat => (
                        <motion.button
                            key={cat}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                background: selectedCategory === cat ? 'rgba(212, 175, 55, 0.08)' : 'rgba(0,0,0,0.02)',
                                border: `1px solid ${selectedCategory === cat ? '#d4af37' : 'rgba(0,0,0,0.1)'}`,
                                color: selectedCategory === cat ? '#d4af37' : '#888',
                                padding: '8px 18px',
                                borderRadius: '999px',
                                fontSize: '9px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2em',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                fontWeight: selectedCategory === cat ? 800 : 500,
                                cursor: 'pointer',
                                outline: 'none',
                                flexShrink: 0
                            }}
                        >
                            {cat}
                        </motion.button>
                    ))}
                </div>
            )}

            {/* SECTION 2 & 3 WRAPPER — sticks to viewport on desktop so only the products column scrolls */}
            <div style={{
                display: 'flex', width: '100%', maxWidth: '100%', minWidth: 0,
                position: isMobile ? 'relative' : 'sticky',
                top: isMobile ? 'auto' : '0',
                height: isMobile ? 'auto' : '100vh',
                overflow: isMobile ? 'visible' : 'hidden',
                alignSelf: 'flex-start'
            }}>
                {/* SECTION 2: SIDEBAR (FIXED/SCROLLABLE INDEPENDENTLY) */}
                <aside style={{
                    width: isMobile ? '0' : '280px', padding: isMobile ? '0' : '40px 30px',
                    display: isMobile ? 'none' : 'flex', background: 'transparent', borderRight: '1px solid rgba(0,0,0,0.05)',
                    height: isMobile ? 'auto' : '100%', flexDirection: 'column', gap: '40px', zIndex: 20,
                    flexShrink: 0, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none'
                }}>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Search</span>
                        <div style={{ position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '14px' }}>
                            <Search size={16} style={{ position: 'absolute', left: 0, top: '4px', opacity: 0.3 }} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#1a1a1a', fontSize: '13px', paddingLeft: '36px', width: '100%', outline: 'none', letterSpacing: '0.05em' }}
                            />
                        </div>
                    </div>

                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>Category</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {categories.map((cat, idx) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                         background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left',
                                         color: selectedCategory === cat ? '#1a1a1a' : '#555', textTransform: 'uppercase', letterSpacing: '0.15em',
                                         display: 'flex', alignItems: 'center', transition: 'all 0.4s ease', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
                                         width: '100%'
                                     }}
                                 >
                                     <span style={{ fontSize: '8px', opacity: 0.3, width: '28px', fontWeight: 700, fontFamily: 'var(--font-tenor)' }}>{String(idx + 1).padStart(2, '0')}</span>
                                    <span style={{ position: 'relative', fontWeight: selectedCategory === cat ? 900 : 500, letterSpacing: selectedCategory === cat ? '0.3em' : '0.2em' }}>
                                        {cat}
                                        {selectedCategory === cat && (
                                            <motion.div layoutId="cat-underline" style={{ position: 'absolute', bottom: '-4px', left: 0, right: 0, height: '1px', background: '#d4af37' }} />
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '-20px' }}>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            style={{
                                width: '100%', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', padding: '12px 14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '1px', transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <SlidersHorizontal size={12} color="#d4af37" />
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#1a1a1a', letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Filters</span>
                            </div>
                            <Plus size={10} color="#555" />
                        </button>
                    </div>

                    <div style={{ marginTop: 'auto', padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <p style={{ fontSize: '11px', color: '#555', lineHeight: 1.7, margin: 0, fontWeight: 600, letterSpacing: '0.02em' }}>
                            All products are 100% genuine and safe to use.
                        </p>
                    </div>
                </aside>

                {/* SECTION 3: PRODUCTS (PRIMARY SCROLL AREA) */}
                <section style={{
                    flex: 1, position: 'relative', scrollBehavior: 'smooth', minWidth: 0, width: '100%',
                    height: isMobile ? 'auto' : '100%',
                    overflowY: isMobile ? 'visible' : 'auto'
                }}>
                    <div style={{
                        position: 'sticky', top: '0', zIndex: 10,
                        padding: isMobile ? '10px 16px' : '20px 80px', background: 'rgba(248,247,242,0.85)', backdropFilter: 'blur(20px)',
                        borderBottom: '1px solid rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <span style={{ fontSize: isMobile ? '8px' : '10px', color: '#555', letterSpacing: '0.2em' }}>
                                {loading ? 'Loading...' : `${filteredAndSortedProducts.length} product${filteredAndSortedProducts.length === 1 ? '' : 's'} found`}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {isMobile && (
                                <button onClick={() => setIsFilterOpen(true)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Filter size={14} color="#d4af37" />
                                    <span style={{ fontSize: '9px', color: '#1a1a1a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Filter</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: isMobile ? '12px 12px 40px' : '20px 80px 40px' }}>
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{ width: '100%' }}
                                >
                                    <PremiumLoader iconName="sparkles" text="Loading Fragrances" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={selectedCategory + sortBy + selectedStatus.join(',')}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))',
                                        gap: isMobile ? '12px' : '48px 28px',
                                        alignItems: 'stretch',
                                        gridAutoRows: '1fr',
                                        width: '100%'
                                    }}
                                >
                                    {filteredAndSortedProducts.map((product, idx) => (
                                        <motion.div
                                            key={product.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            style={{ width: '100%', height: '100%', display: 'flex', alignSelf: 'stretch' }}
                                        >
                                            <ProductCard product={product} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!loading && filteredAndSortedProducts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '160px 0', border: '1px dashed rgba(0,0,0,0.1)' }}>
                                <h3 style={{ fontSize: '14px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.4em' }}>No products found. Try a different search or filter.</h3>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {isFilterOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFilterOpen(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 100 }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            style={{
                                position: 'fixed', top: 0, right: 0, bottom: 0,
                                width: isMobile ? '100%' : '450px',
                                background: '#ffffff', borderLeft: '1px solid rgba(0,0,0,0.08)', zIndex: 110,
                                padding: isMobile ? '40px 24px' : '80px 60px',
                                boxShadow: '-20px 0 80px rgba(0,0,0,0.15)',
                                display: 'flex', flexDirection: 'column', gap: isMobile ? '40px' : '64px',
                                overflowY: 'auto'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', color: '#1a1a1a' }}>Filters</h2>
                                <button onClick={() => setIsFilterOpen(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Close</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                                <div>
                                    <label style={{ fontSize: '9px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '24px', display: 'block' }}>Sort Order</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {["Featured", "Price: High to Low", "Price: Low to High", "Newest"].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSortBy(s)}
                                                style={{
                                                    background: 'none', border: 'none', textAlign: 'left',
                                                    color: sortBy === s ? '#1a1a1a' : '#555', fontSize: '13px',
                                                    cursor: 'pointer', transition: '0.3s'
                                                }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '9px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '24px', display: 'block' }}>Status</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {["In Stock", "Limited Edition", "Wishlisted"].map(status => (
                                            <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#666', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ accentColor: '#d4af37' }}
                                                    checked={selectedStatus.includes(status)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedStatus([...selectedStatus, status])
                                                        else setSelectedStatus(selectedStatus.filter(s => s !== status))
                                                    }}
                                                />
                                                {status}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsFilterOpen(false)}
                                style={{
                                    marginTop: 'auto', background: '#d4af37', color: '#000', border: 'none',
                                    padding: '24px', fontWeight: 900, textTransform: 'uppercase',
                                    letterSpacing: '0.3em', fontSize: '10px', cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.3s ease'
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.background = '#e8c050')}
                                onMouseOut={(e) => (e.currentTarget.style.background = '#d4af37')}
                            >
                                Apply Filters
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </main>
    )
}
