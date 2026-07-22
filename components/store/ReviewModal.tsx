'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X, Loader2, CheckCircle, Image as ImageIcon, Video, Trash2 } from 'lucide-react'

interface ReviewModalProps {
    isOpen: boolean
    onClose: () => void
    product: {
        id: string
        name: string
    }
    orderId?: string
    initialRating?: number
}

export function ReviewModal({ isOpen, onClose, product, orderId, initialRating = 0 }: ReviewModalProps) {
    const router = useRouter()
    const [rating, setRating] = useState(initialRating)
    const [hoveredRating, setHoveredRating] = useState(0)

    useEffect(() => {
        if (isOpen && initialRating > 0) {
            setRating(initialRating)
        }
    }, [isOpen, initialRating])
    const [heading, setHeading] = useState('')
    const [comment, setComment] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [mediaUrls, setMediaUrls] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch('/api/reviews/upload', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.url) {
                setMediaUrls(prev => [...prev, data.url])
            }
        } catch (error) {
            console.error('Upload failed:', error)
        } finally {
            setUploading(false)
        }
    }

    const removeMedia = (url: string) => {
        setMediaUrls(prev => prev.filter(u => u !== url))
    }

    const handleSubmit = async () => {
        if (rating === 0) return
        setSubmitting(true)
        setError('')
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: product.id,
                    rating,
                    heading,
                    comment,
                    media_urls: mediaUrls,
                    reviewer_name: isAnonymous ? 'Anonymous' : null,
                    order_id: orderId
                })
            })
            if (res.ok) {
                setSubmitted(true)
                // Re-run the server component so the new review appears in the
                // list without a manual page reload.
                router.refresh()
                setTimeout(() => {
                    onClose()
                    setSubmitted(false)
                    setRating(0)
                    setHeading('')
                    setComment('')
                    setMediaUrls([])
                    setError('')
                }, 2000)
            } else {
                // Surface the failure instead of silently swallowing it.
                let message = 'Could not submit your review. Please try again.'
                if (res.status === 401) {
                    message = 'Please sign in to write a review.'
                } else {
                    try {
                        const data = await res.json()
                        if (data?.error) message = data.error
                        // Surface the DB reason when present so a schema/policy
                        // problem is visible rather than a generic failure.
                        if (data?.reason && data.reason !== data.error) message += ` (${data.reason})`
                    } catch {
                        // keep the default message
                    }
                }
                setError(message)
            }
        } catch (err) {
            console.error('Error submitting review:', err)
            setError('Network error. Please check your connection and try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        style={{
                            background: '#111',
                            border: '1px solid rgba(212,175,55,0.2)',
                            width: '100%',
                            maxWidth: '500px',
                            position: 'relative',
                            padding: '48px',
                            borderRadius: '4px',
                            boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
                            maxHeight: 'calc(100dvh - 48px)',
                            overflowY: 'auto'
                        }}
                    >
                        <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        {submitted ? (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                                    <CheckCircle size={64} color="#d4af37" style={{ margin: '0 auto 24px' }} />
                                </motion.div>
                                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-baskerville)', color: '#fff', marginBottom: '16px' }}>Experience Archived</h2>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontStyle: 'italic' }}>Thank you for sharing your olfactory journey with us.</p>
                            </div>
                        ) : (
                            <>
                                <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                                    <p style={{ fontSize: '10px', color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '12px' }}>Share your Experience</p>
                                    <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-baskerville)', color: '#fff', fontWeight: 300, margin: 0 }}>{product.name}</h2>
                                </header>

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <motion.button
                                            key={star}
                                            whileHover={{ scale: 1.2 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoveredRating(star)}
                                            onMouseLeave={() => setHoveredRating(0)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            <Star
                                                size={32}
                                                fill={(hoveredRating || rating) >= star ? '#d4af37' : 'transparent'}
                                                color={(hoveredRating || rating) >= star ? '#d4af37' : 'rgba(255,255,255,0.1)'}
                                                strokeWidth={1.5}
                                            />
                                        </motion.button>
                                    ))}
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }} onClick={() => setIsAnonymous(!isAnonymous)}>
                                        <div style={{ width: '14px', height: '14px', border: '1px solid #d4af37', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isAnonymous && <div style={{ width: '8px', height: '8px', background: '#d4af37', borderRadius: '1px' }} />}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Post review as anonymous</span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '12px' }}>Review Heading</p>
                                    <input
                                        type="text"
                                        value={heading}
                                        onChange={(e) => setHeading(e.target.value)}
                                        placeholder="Summarize your experience..."
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '2px',
                                            color: '#fff',
                                            padding: '12px 16px',
                                            fontSize: '14px',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '12px' }}>Review Description</p>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Describe the scent evolution, longevity, and your impressions..."
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '2px',
                                            color: '#fff',
                                            padding: '16px',
                                            fontSize: '14px',
                                            fontFamily: 'inherit',
                                            minHeight: '100px',
                                            outline: 'none',
                                            resize: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '40px' }}>
                                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '12px' }}>Add Image or Video</p>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {mediaUrls.map((url) => (
                                            <div key={url} style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                                {url.match(/\.(mp4|mov)$/) ? (
                                                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                )}
                                                <button onClick={() => removeMedia(url)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <label style={{ width: '80px', height: '80px', border: '1px dashed rgba(212,175,55,0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.3s' }}>
                                            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,video/*" disabled={uploading} />
                                            {uploading ? (
                                                <Loader2 size={16} className="animate-spin" color="#d4af37" />
                                            ) : (
                                                <>
                                                    <ImageIcon size={16} color="#d4af37" />
                                                    <span style={{ fontSize: '8px', color: '#d4af37', marginTop: '4px', textTransform: 'uppercase' }}>Browse</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {error && (
                                    <p style={{ color: '#e57373', fontSize: '12px', textAlign: 'center', marginBottom: '16px', letterSpacing: '0.02em' }}>
                                        {error}
                                    </p>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={rating === 0 || submitting}
                                    style={{
                                        width: '100%',
                                        background: rating === 0 ? 'rgba(255,255,255,0.05)' : '#fff',
                                        color: '#000',
                                        border: 'none',
                                        padding: '18px',
                                        fontSize: '11px',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.4em',
                                        cursor: rating === 0 ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: '0.3s'
                                    }}
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Submit Review'}
                                </button>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
