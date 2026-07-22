'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, User, Image as ImageIcon, Video, ChevronDown } from 'lucide-react'
import { ReviewModal } from './ReviewModal'

interface Review {
    id: string
    rating: number
    heading?: string
    comment: string
    media_urls?: string[]
    created_at: string
    reviewer_name?: string
    reviewer_avatar?: string
    profiles: {
        full_name?: string
        first_name?: string
        last_name?: string
        avatar_url?: string
    } | { full_name?: string, first_name?: string, last_name?: string, avatar_url?: string }[]
}

interface ReviewsSectionProps {
    reviews: Review[]
    // Optional: when the section is rendered on a product detail page we
    // pass the product so the Write-a-Review modal knows which product to
    // attach the new review to. On the homepage there's no single product
    // context, so this prop is omitted and the modal trigger is hidden.
    product?: {
        id: string
        name: string
    }
}

export function ReviewsSection({ reviews = [], product }: ReviewsSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [sortBy, setSortBy] = useState<'newest' | 'highest'>('newest')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const averageRating = reviews.length > 0 
        ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length).toFixed(1)
        : '0.0'

    const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        percentage: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0
    }))

    const sortedReviews = [...reviews].sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return b.rating - a.rating
    })

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 20px' : '0 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '40px' : '80px' }}>

                {/* 1. Header & Stats */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: isMobile ? '32px' : '60px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: '1 1 300px', width: isMobile ? '100%' : 'auto' }}>
                        <h2 style={{ fontSize: isMobile ? '22px' : '32px', fontFamily: 'var(--font-baskerville)', color: '#1a1a1a', marginBottom: isMobile ? '20px' : '32px', fontWeight: 400 }}>Rating & Reviews</h2>

                        {/* Rating Bars */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {ratingCounts.map(({ star, count, percentage }) => (
                                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', gap: '2px', width: '60px' }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={10} fill={s <= star ? '#d4af37' : 'transparent'} color={s <= star ? '#d4af37' : 'rgba(0,0,0,0.12)'} />
                                        ))}
                                    </div>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            style={{ height: '100%', background: '#d4af37' }} 
                                        />
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#888', width: '20px' }}>{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        flex: isMobile ? '1 1 100%' : '0 0 240px',
                        width: isMobile ? '100%' : 'auto',
                        textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: isMobile ? '8px' : '16px'
                    }}>
                        <div style={{ fontSize: isMobile ? '36px' : '64px', fontFamily: 'var(--font-baskerville)', color: '#1a1a1a', lineHeight: 1 }}>{averageRating} <span style={{ fontSize: isMobile ? '16px' : '24px', color: '#d4af37' }}>★</span></div>
                        <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#888', letterSpacing: '0.1em' }}>{reviews.length} Rating and {reviews.length} Reviews</div>

                        {product && (
                            <motion.button
                                whileHover={{ scale: 1.02, backgroundColor: '#d4af37', color: '#000' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsModalOpen(true)}
                                style={{
                                    marginTop: isMobile ? '8px' : '16px',
                                    background: 'transparent',
                                    border: '1px solid #d4af37',
                                    color: '#d4af37',
                                    padding: isMobile ? '12px 24px' : '16px 32px',
                                    fontSize: isMobile ? '10px' : '11px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: isMobile ? '0.2em' : '0.3em',
                                    cursor: 'pointer',
                                    transition: '0.3s',
                                    borderRadius: '999px'
                                }}
                            >
                                Write a Review
                            </motion.button>
                        )}
                    </div>
                </div>

                {/* 2. Review List */}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: isMobile ? '32px' : '60px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '24px' : '48px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ fontSize: isMobile ? '10px' : '11px', color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 700 }}>Archived Impressions</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: isMobile ? '11px' : '12px' }}>
                            Sort by:
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                style={{ background: 'none', border: 'none', color: '#1a1a1a', fontSize: isMobile ? '11px' : '12px', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="newest">Newest First</option>
                                <option value="highest">Highest Rated</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '32px' : '64px' }}>
                        {sortedReviews.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: isMobile ? '40px 0' : '100px 0', border: '1px dashed rgba(0,0,0,0.12)', borderRadius: '8px' }}>
                                <p style={{ color: '#888', fontStyle: 'italic', fontFamily: 'var(--font-baskerville)', fontSize: isMobile ? '13px' : '15px' }}>No sensory feedback has been archived yet.</p>
                            </div>
                        ) : (
                            sortedReviews.map((review) => {
                                const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles
                                const profileName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
                                const name = review.reviewer_name || profileName || 'Anonymous'
                                const avatar = review.reviewer_avatar || profile?.avatar_url

                                return (
                                    <motion.div
                                        key={review.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        style={{ display: 'flex', gap: isMobile ? '14px' : '32px' }}
                                    >
                                        <div style={{ flex: isMobile ? '0 0 40px' : '0 0 60px' }}>
                                            <div style={{ width: isMobile ? '40px' : '60px', height: isMobile ? '40px' : '60px', borderRadius: '50%', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {avatar ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <User size={isMobile ? 16 : 24} color="#d4af37" strokeWidth={1} />}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: isMobile ? '8px' : '12px', flexWrap: 'wrap', gap: '4px' }}>
                                                <h4 style={{ fontSize: isMobile ? '14px' : '16px', color: '#1a1a1a', margin: 0, fontFamily: 'var(--font-baskerville)', fontWeight: 500 }}>{name}</h4>
                                                <span style={{ fontSize: isMobile ? '10px' : '12px', color: '#999' }}>{formatDate(review.created_at)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '2px', marginBottom: isMobile ? '12px' : '20px' }}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} size={isMobile ? 10 : 12} fill={s <= review.rating ? '#d4af37' : 'transparent'} color={s <= review.rating ? '#d4af37' : 'rgba(0,0,0,0.12)'} />
                                                ))}
                                            </div>
                                            {review.heading && (
                                                <h5 style={{ fontSize: isMobile ? '14px' : '18px', color: '#d4af37', margin: isMobile ? '0 0 8px' : '0 0 12px', fontWeight: 500 }}>{review.heading}</h5>
                                            )}
                                            <p style={{ fontSize: isMobile ? '13px' : '15px', color: '#555', lineHeight: 1.7, margin: isMobile ? '0 0 16px' : '0 0 24px', whiteSpace: 'pre-wrap' }}>
                                                {review.comment}
                                            </p>

                                            {/* Media Grid */}
                                            {review.media_urls && review.media_urls.length > 0 && (
                                                <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
                                                    {review.media_urls.map((url, i) => (
                                                        <div key={i} style={{ width: isMobile ? '80px' : '120px', height: isMobile ? '80px' : '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                                                            {url.match(/\.(mp4|mov)$/) ? (
                                                                <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} alt="" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {product && (
                <ReviewModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={product}
                />
            )}
        </section>
    )
}
