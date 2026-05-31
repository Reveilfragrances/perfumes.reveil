'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Trash2, Edit2, Plus, CheckCircle, XCircle, User, MessageSquare, Tag, Sparkles, Quote } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Review {
    id: string
    rating: number
    heading: string | null
    comment: string
    media_urls: string[] | null
    created_at: string
    reviewer_name: string | null
    reviewer_avatar: string | null
    is_featured: boolean
    product_id: string | null
    products: { name: string } | null
    profiles: { full_name: string } | null
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingReview, setEditingReview] = useState<Review | null>(null)
    const [products, setProducts] = useState<{id: string, name: string}[]>([])
    
    const [form, setForm] = useState({
        reviewer_name: '',
        reviewer_avatar: '',
        rating: 5,
        heading: '',
        comment: '',
        media_urls: [] as string[],
        product_id: '',
        is_featured: false,
        source: 'google' // Default to Google as requested
    })

    const router = useRouter()

    useEffect(() => {
        fetchReviews()
        fetchProducts()
    }, [])

    async function fetchReviews() {
        setLoading(true)
        try {
            const res = await fetch('/api/reviews?admin=true')
            const data = await res.json()
            if (data.reviews) setReviews(data.reviews)
        } catch (error) {
            console.error('Error fetching reviews:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchProducts() {
        try {
            const res = await fetch('/api/products?limit=100')
            const data = await res.json()
            if (data.products) setProducts(data.products)
        } catch (error) {
            console.error('Error fetching products:', error)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Permanently remove this testimonial from the archive?')) return
        try {
            const res = await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                setReviews(prev => prev.filter(r => r.id !== id))
            }
        } catch (error) {
            console.error('Error deleting review:', error)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const method = editingReview ? 'PATCH' : 'POST'
        const body = editingReview ? { id: editingReview.id, ...form } : form

        try {
            const res = await fetch('/api/reviews', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (res.ok) {
                setIsModalOpen(false)
                setEditingReview(null)
                setForm({ reviewer_name: '', reviewer_avatar: '', rating: 5, heading: '', comment: '', media_urls: [], product_id: '', is_featured: false, source: 'google' })
                fetchReviews()
            } else {
                const errorData = await res.json()
                console.error('Failed to save review:', errorData)
                alert('Failed to save review: ' + (errorData.error || 'Unknown error'))
            }
        } catch (error) {
            console.error('Error saving review:', error)
        }
    }

    function openEdit(review: Review) {
        setEditingReview(review)
        setForm({
            reviewer_name: review.reviewer_name || '',
            reviewer_avatar: review.reviewer_avatar || '',
            rating: review.rating,
            heading: review.heading || '',
            comment: review.comment || '',
            media_urls: review.media_urls || [],
            product_id: review.product_id || '',
            is_featured: review.is_featured,
            source: (review as any).source || 'google'
        })
        setIsModalOpen(true)
    }

    async function toggleFeatured(review: Review) {
        try {
            const res = await fetch('/api/reviews', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: review.id, is_featured: !review.is_featured })
            })
            if (res.ok) {
                setReviews(prev => prev.map(r => r.id === review.id ? { ...r, is_featured: !r.is_featured } : r))
            }
        } catch (error) {
            console.error('Error toggling featured status:', error)
        }
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px' }}>
            {/* Elegant Header */}
            <header style={{ marginBottom: '80px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d4af37', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '16px' }}>
                        Customer Feedback <div style={{ width: '40px', height: '1px', background: 'rgba(212,175,55,0.4)' }} />
                    </div>
                    <h1 style={{ fontSize: '56px', fontFamily: 'serif', textTransform: 'uppercase', margin: 0, fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
                        Ratings <span style={{ fontStyle: 'italic', color: '#d4af37' }}>& Reviews</span>
                    </h1>
                    <p style={{ marginTop: '12px', color: '#999', fontSize: '14px', letterSpacing: '0.05em' }}>Manual addition of Google and Website testimonials</p>
                </div>
                <button 
                    onClick={() => { setEditingReview(null); setForm({ reviewer_name: '', reviewer_avatar: '', rating: 5, heading: '', comment: '', media_urls: [], product_id: '', is_featured: false, source: 'google' }); setIsModalOpen(true); }}
                    style={{ 
                        background: '#000', color: '#fff', border: '1px solid #000', 
                        padding: '18px 40px', borderRadius: '4px', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '12px', 
                        fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', 
                        letterSpacing: '0.3em', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}
                    className="hover-gold"
                >
                    <Plus size={16} strokeWidth={3} /> Add Manual Review
                </button>
            </header>

            {loading ? (
                <div style={{ padding: '160px', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '2px solid #eee', borderTopColor: '#d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
                    <div style={{ color: '#999', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Synchronizing Archive...</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '40px' }}>
                    {reviews.map((review, idx) => (
                        <motion.div 
                            key={review.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08, duration: 0.6 }}
                            style={{ 
                                background: '#fff', padding: '48px', borderRadius: '8px',
                                border: '1px solid rgba(0,0,0,0.04)', position: 'relative',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.03)',
                                display: 'flex', flexDirection: 'column', gap: '24px',
                                transition: 'all 0.3s ease'
                            }}
                            className="review-card"
                        >
                            <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {(review as any).source === 'google' && (
                                    <div style={{ fontSize: '9px', background: '#f8f9fa', padding: '4px 8px', borderRadius: '40px', color: '#4285F4', fontWeight: 700, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                        Google
                                    </div>
                                )}
                                <Quote style={{ color: 'rgba(212,175,55,0.08)', width: '40px', height: '40px' }} />
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ 
                                        width: '64px', height: '64px', borderRadius: '50%', 
                                        background: '#fcfcfc', overflow: 'hidden', 
                                        border: '1px solid rgba(212,175,55,0.2)',
                                        padding: '3px'
                                    }}>
                                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5' }}>
                                            {review.reviewer_avatar ? (
                                                <img src={review.reviewer_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                                    <User size={24} strokeWidth={1} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.01em' }}>{review.reviewer_name || review.profiles?.full_name || 'Anonymous Collector'}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {[1,2,3,4,5].map(s => <Star key={s} size={11} fill={s <= review.rating ? '#d4af37' : 'none'} color={s <= review.rating ? '#d4af37' : '#eee'} />)}
                                            </div>
                                            <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em' }}>• Verified client</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px', fontWeight: 700 }}>
                                    Target Product: {review.products?.name || 'General Feedback'}
                                </div>
                                {review.heading && (
                                    <h4 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>{review.heading}</h4>
                                )}
                                <p style={{ 
                                    margin: 0, fontSize: '17px', lineHeight: 1.8, color: '#333', 
                                    fontStyle: 'italic', fontFamily: 'serif', fontWeight: 400
                                }}>
                                    "{review.comment}"
                                </p>
                                {review.media_urls && review.media_urls.length > 0 && (
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                                        {review.media_urls.map((url, i) => (
                                            <div key={i} style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #eee' }}>
                                                {url.match(/\.(mp4|mov)$/) ? (
                                                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <button onClick={() => openEdit(review)} style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }} className="action-link">
                                        <Edit2 size={13} /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(review.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }} className="action-link-red">
                                        <Trash2 size={13} /> Remove
                                    </button>
                                </div>
                                <button 
                                    onClick={() => toggleFeatured(review)}
                                    style={{ 
                                        background: review.is_featured ? '#000' : 'transparent', 
                                        border: '1px solid #000', 
                                        padding: '8px 20px', borderRadius: '4px', cursor: 'pointer',
                                        fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em',
                                        color: review.is_featured ? '#fff' : '#000',
                                        display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                >
                                    {review.is_featured ? <Sparkles size={12} color="#d4af37" /> : null}
                                    {review.is_featured ? 'Featured' : 'Promote'}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Premium Modal Overlay */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '20px', overflowY: 'auto' }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            style={{ background: '#fff', padding: '32px', borderRadius: '4px', width: '100%', maxWidth: '500px', boxShadow: '0 50px 100px rgba(0,0,0,0.3)', position: 'relative', margin: 'auto' }}
                        >
                            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><XCircle size={20} /></button>
                            
                            <h2 style={{ fontSize: '24px', fontFamily: 'serif', textTransform: 'uppercase', margin: '0 0 32px', fontWeight: 300, textAlign: 'center', letterSpacing: '-0.02em' }}>
                                manual <span style={{ fontStyle: 'italic', color: '#d4af37' }}>entry</span>
                            </h2>
                            
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="input-group">
                                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Client Name</label>
                                        <input 
                                            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '14px', outline: 'none', transition: 'all 0.3s ease', background: 'transparent' }} 
                                            className="custom-input"
                                            value={form.reviewer_name}
                                            onChange={e => setForm({ ...form, reviewer_name: e.target.value })}
                                            placeholder="John Doe..."
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Review Source</label>
                                        <select 
                                            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '14px', outline: 'none', background: 'transparent', cursor: 'pointer' }} 
                                            value={form.source}
                                            onChange={e => setForm({ ...form, source: e.target.value })}
                                        >
                                            <option value="google">Google Review</option>
                                            <option value="website">Website Direct</option>
                                            <option value="instagram">Instagram</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="input-group">
                                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Star Rating</label>
                                        <select 
                                            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '14px', outline: 'none', background: 'transparent', cursor: 'pointer' }} 
                                            value={form.rating}
                                            onChange={e => setForm({ ...form, rating: parseInt(e.target.value) })}
                                        >
                                            <option value="5">5 Stars — Exceptional</option>
                                            <option value="4">4 Stars — Superior</option>
                                            <option value="3">3 Stars — Average</option>
                                            <option value="2">2 Stars — Limited</option>
                                            <option value="1">1 Star — Poor</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Product Link</label>
                                        <select 
                                            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '13px', outline: 'none', background: 'transparent', cursor: 'pointer' }} 
                                            value={form.product_id}
                                            onChange={e => setForm({ ...form, product_id: e.target.value })}
                                        >
                                            <option value="">General Narrative</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Avatar / DP URL</label>
                                    <input 
                                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '13px', outline: 'none', background: 'transparent' }} 
                                        value={form.reviewer_avatar}
                                        onChange={e => setForm({ ...form, reviewer_avatar: e.target.value })}
                                        placeholder="https://googleusercontent.com/..."
                                    />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Review Heading</label>
                                    <input 
                                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '14px', outline: 'none', background: 'transparent' }} 
                                        value={form.heading}
                                        onChange={e => setForm({ ...form, heading: e.target.value })}
                                        placeholder="Heading..."
                                    />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Review Text</label>
                                    <textarea 
                                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '15px', outline: 'none', minHeight: '80px', resize: 'none', fontFamily: 'serif', fontStyle: 'italic', background: 'transparent', lineHeight: 1.5 }} 
                                        value={form.comment}
                                        onChange={e => setForm({ ...form, comment: e.target.value })}
                                        placeholder="Describe the experience..."
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#999', marginBottom: '8px' }}>Media URLs (JSON Array)</label>
                                    <textarea 
                                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid #eee', fontSize: '12px', outline: 'none', minHeight: '40px', resize: 'none', background: 'transparent' }} 
                                        value={JSON.stringify(form.media_urls)}
                                        onChange={e => {
                                            try {
                                                const parsed = JSON.parse(e.target.value)
                                                if (Array.isArray(parsed)) setForm({ ...form, media_urls: parsed })
                                            } catch {}
                                        }}
                                        placeholder='["url1", "url2"]'
                                    />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fcfcfc', padding: '12px', borderRadius: '4px', border: '1px solid #eee' }}>
                                    <input 
                                        type="checkbox" id="modal_featured" 
                                        checked={form.is_featured}
                                        onChange={e => setForm({ ...form, is_featured: e.target.checked })}
                                        style={{ width: '14px', height: '14px', accentColor: '#000', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="modal_featured" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Feature in Public Showcase</label>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                    <button type="submit" style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '14px', borderRadius: '2px', cursor: 'pointer', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                                        {editingReview ? 'Update' : 'Save'}
                                    </button>
                                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, background: 'none', color: '#999', border: '1px solid #eee', padding: '14px', borderRadius: '2px', cursor: 'pointer', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .custom-input:focus {
                    border-bottom-color: #d4af37 !important;
                }
                .hover-gold:hover {
                    background: #d4af37 !important;
                    border-color: #d4af37 !important;
                    transform: translateY(-2px);
                }
                .review-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 30px 60px rgba(0,0,0,0.08);
                    border-color: rgba(212,175,55,0.2);
                }
                .action-link:hover {
                    color: #d4af37 !important;
                }
                .action-link-red:hover {
                    color: #ff1a1a !important;
                    opacity: 1;
                }
            `}</style>
        </div>
    )
}

function Loader2({ className, size, style }: any) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
            style={style}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
