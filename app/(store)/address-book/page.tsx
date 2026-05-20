'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Trash2, Home, Briefcase, ArrowLeft, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { isOdishaPincode } from '@/lib/validators'

type Address = {
    id: string
    label: string
    name: string
    phone: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
    is_default: boolean
}

export default function AddressBookPage() {
    const supabase = createClient()
    const router = useRouter()

    const [addresses, setAddresses] = useState<Address[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkRes = () => setIsMobile(window.innerWidth < 900)
        checkRes()
        window.addEventListener('resize', checkRes)
        return () => window.removeEventListener('resize', checkRes)
    }, [])

    const emptyForm = { label: 'Home', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' }
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        async function load() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { router.push('/auth'); return }
                setUserId(user.id)

                const res = await fetch('/api/user/address')
                const data = await res.json()
                if (data.addresses) setAddresses(data.addresses)
            } catch (err) {
                console.error('Load error:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.line1 || !form.city || !form.pincode) {
            setError('Please fill in all required fields.')
            return
        }
        if (!isOdishaPincode(form.pincode)) {
            setError('Please enter a valid 6-digit Indian pincode.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const res = await fetch('/api/user/address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: form.label.toUpperCase(),
                    full_name: form.name,
                    phone: form.phone,
                    address_line1: form.line1,
                    address_line2: form.line2,
                    city: form.city,
                    state: form.state,
                    pincode: form.pincode,
                    is_default: addresses.length === 0 || editingId === null // Default if first address
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save address')

            // Reload addresses
            const loadRes = await fetch('/api/user/address')
            const loadData = await loadRes.json()
            if (loadData.addresses) setAddresses(loadData.addresses)

            setSuccess(editingId ? 'Address updated!' : 'Address saved!')
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
            setTimeout(() => setSuccess(null), 3000)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this address?')) return
        try {
            const res = await fetch('/api/user/address', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            })
            if (!res.ok) throw new Error('Failed to delete')

            setAddresses(prev => prev.filter(a => a.id !== id))
            setSuccess('Address removed.')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setTimeout(() => setSuccess(null), 3000)
        }
    }

    const handleSetDefault = async (id: string) => {
        try {
            const res = await fetch('/api/user/address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_default: true, updateOnly: true })
            })
            if (!res.ok) throw new Error('Failed to update')

            // Refresh list
            const loadRes = await fetch('/api/user/address')
            const loadData = await loadRes.json()
            if (loadData.addresses) setAddresses(loadData.addresses)
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleEdit = (a: Address) => {
        setForm({ label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode })
        setEditingId(a.id)
        setShowForm(true)
    }

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f2' }}>
            <Loader2 size={32} color="#d4af37" className="animate-spin" />
        </div>
    )

    const inputStyle: React.CSSProperties = {
        width: '100%', background: '#ffffff', border: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.12)', color: '#1a1a1a',
        fontSize: isMobile ? '13px' : '14px',
        padding: isMobile ? '8px 0' : '12px 14px',
        outline: 'none',
        fontFamily: 'var(--font-baskerville)',
        boxSizing: 'border-box'
    }

    const labelStyle: React.CSSProperties = {
        fontSize: isMobile ? '8px' : '9px',
        color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase',
        letterSpacing: isMobile ? '0.15em' : '0.2em',
        display: 'block',
        marginBottom: isMobile ? '4px' : '6px'
    }

    return (
        <main style={{ background: '#f8f7f2', minHeight: '100vh', color: '#1a1a1a', paddingTop: isMobile ? '80px' : '120px', paddingBottom: '100px' }}>
            {/* HIDDEN SEO HEADINGS - GOD LEVEL SEO */}
            <div className="sr-only">
                <h1>REVEIL Address Book - Luxury Perfume Delivery Management</h1>
                <h2>Fast Shipping for Signature Fragrances and Authentic Attars India</h2>
                <p>Manage your delivery locations for your favorite REVEIL perfumes. Ensure seamless shipping of long-lasting laboratory fragrances to your doorstep with our optimized logistics.</p>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>

                {/* Header */}
                <header style={{ marginBottom: '60px' }}>
                    <Link href="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#d4af37', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', textDecoration: 'none', marginBottom: '32px' }}>
                        <ArrowLeft size={12} /> Back to Profile
                    </Link>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '10px', fontWeight: 900, color: '#d4af37', letterSpacing: '0.6em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'inline-block', width: '40px', height: '1px', background: 'rgba(212,175,55,0.3)' }} />
                        Address Book
                        <span style={{ display: 'inline-block', width: '40px', height: '1px', background: 'rgba(212,175,55,0.3)' }} />
                    </motion.p>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontFamily: 'var(--font-baskerville)', fontWeight: 300, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
                        Your <span style={{ color: '#d4af37', fontStyle: 'italic' }}>Addresses</span>
                    </motion.h1>
                    <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '13px', fontFamily: 'var(--font-baskerville)', fontStyle: 'italic' }}>
                        Save your delivery addresses so checkout is faster.
                    </p>

                    {/* Counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
                        <div style={{ padding: '8px 20px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#d4af37' }} />
                            <span style={{ fontSize: '9px', fontWeight: 900, color: '#1a1a1a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                {addresses.length.toString().padStart(2, '0')} Saved
                            </span>
                        </div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(212,175,55,0.2), transparent)' }} />
                    </div>
                </header>

                {/* Success/Error messages */}
                <AnimatePresence>
                    {success && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', padding: '12px 20px', borderRadius: '2px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#d4af37' }}>
                            <Check size={14} /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Address List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                    {addresses.length === 0 && !showForm && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed rgba(0,0,0,0.12)', borderRadius: '4px' }}>
                            <MapPin size={32} color="rgba(212,175,55,0.5)" style={{ margin: '0 auto 16px' }} />
                            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', fontFamily: 'var(--font-baskerville)', fontStyle: 'italic', marginBottom: '8px' }}>
                                No addresses saved yet.
                            </p>
                            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>Add one below to make checkout faster.</p>
                        </motion.div>
                    )}

                    {addresses.map((addr, idx) => (
                        <motion.div key={addr.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            style={{
                                background: addr.is_default ? 'rgba(212,175,55,0.08)' : '#ffffff',
                                border: `1px solid ${addr.is_default ? 'rgba(212,175,55,0.4)' : 'rgba(0,0,0,0.08)'}`,
                                borderRadius: '4px', padding: isMobile ? '20px' : '28px 32px',
                                position: 'relative', overflow: 'hidden'
                            }}>
                            {/* Ghost index */}
                            <div style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '48px', fontWeight: 900, color: 'rgba(0,0,0,0.04)', fontFamily: 'var(--font-baskerville)', pointerEvents: 'none' }}>
                                {String(idx + 1).padStart(2, '0')}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    {/* Label row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        {addr.label === 'Home' ? <Home size={14} color="#d4af37" /> : <Briefcase size={14} color="#d4af37" />}
                                        <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#d4af37' }}>{addr.label}</span>
                                        {addr.is_default && (
                                            <span style={{ fontSize: '8px', fontWeight: 700, background: 'rgba(212,175,55,0.15)', color: '#d4af37', padding: '2px 8px', borderRadius: '100px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: '#1a1a1a' }}>{addr.name}</p>
                                    <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', margin: '0 0 2px', fontFamily: 'var(--font-baskerville)' }}>
                                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                                    </p>
                                    <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', margin: '0 0 8px', fontFamily: 'var(--font-baskerville)' }}>
                                        {addr.city}, {addr.state} — {addr.pincode}
                                    </p>
                                    {addr.phone && <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', margin: 0 }}>{addr.phone}</p>}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', marginLeft: '24px' }}>
                                    <button onClick={() => handleEdit(addr)} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '2px', cursor: 'pointer', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                        Edit
                                    </button>
                                    {!addr.is_default && (
                                        <button onClick={() => handleSetDefault(addr.id)} style={{ background: 'none', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', padding: '6px 14px', borderRadius: '2px', cursor: 'pointer', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                            Set Default
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(addr.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,75,75,0.7)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        <Trash2 size={12} /> Remove
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Add Button */}
                {!showForm && (
                    <motion.button
                        whileHover={{ borderColor: 'rgba(212,175,55,0.6)' }}
                        onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}
                        style={{
                            width: '100%', padding: '20px', background: 'transparent',
                            border: '1px dashed rgba(212,175,55,0.4)', borderRadius: '4px',
                            color: '#d4af37', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '10px', fontSize: '10px', fontWeight: 900,
                            textTransform: 'uppercase', letterSpacing: '0.3em', transition: 'border-color 0.3s'
                        }}>
                        <Plus size={16} /> Add New Address
                    </motion.button>
                )}

                {/* Add/Edit Form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onSubmit={handleSubmit}
                            style={{ background: '#ffffff', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '4px', padding: isMobile ? '16px' : '40px' }}>

                            <h3 style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: 900, letterSpacing: isMobile ? '0.3em' : '0.4em', textTransform: 'uppercase', color: '#d4af37', marginBottom: isMobile ? '20px' : '32px' }}>
                                {editingId ? 'Edit Address' : 'New Address'}
                            </h3>

                            {/* Label Selector */}
                            <div style={{ marginBottom: isMobile ? '18px' : '28px' }}>
                                <span style={labelStyle}>Label</span>
                                <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px' }}>
                                    {['Home', 'Work', 'Other'].map(l => (
                                        <button key={l} type="button" onClick={() => setForm({ ...form, label: l })}
                                            style={{ padding: isMobile ? '6px 12px' : '8px 20px', background: form.label === l ? '#d4af37' : 'transparent', border: `1px solid ${form.label === l ? '#d4af37' : 'rgba(0,0,0,0.12)'}`, color: form.label === l ? '#000' : 'rgba(0,0,0,0.6)', borderRadius: '2px', cursor: 'pointer', fontSize: isMobile ? '9px' : '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: isMobile ? '0.15em' : '0.2em' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '14px' : '28px' }}>
                                <div>
                                    <label style={labelStyle}>Full Name *</label>
                                    <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone</label>
                                    <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Address Line 1 *</label>
                                    <input style={inputStyle} value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} placeholder="Your house, street name" required />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Address Line 2</label>
                                    <input style={inputStyle} value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} placeholder="Your landmark or area (optional)" />
                                </div>
                                <div>
                                    <label style={labelStyle}>City *</label>
                                    <input style={inputStyle} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Your city" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>State</label>
                                    <input style={inputStyle} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Your state" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Pincode *</label>
                                    <input
                                        style={inputStyle}
                                        value={form.pincode}
                                        onChange={e => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                        placeholder="6-digit pincode"
                                        inputMode="numeric"
                                        maxLength={6}
                                        required
                                    />
                                    <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)', margin: '6px 0 0', letterSpacing: '0.05em' }}>
                                        Reveil ships pan-India.
                                    </p>
                                    {form.pincode.length === 6 && !isOdishaPincode(form.pincode) && (
                                        <p style={{ fontSize: '11px', color: '#b00020', margin: '6px 0 0' }}>
                                            Please enter a valid Indian pincode.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {error && <p style={{ color: '#ff4d4d', fontSize: '11px', marginTop: isMobile ? '14px' : '20px' }}>{error}</p>}

                            <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', marginTop: isMobile ? '20px' : '32px' }}>
                                <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.01 }}
                                    style={{ flex: 1, padding: isMobile ? '12px' : '16px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '2px', fontSize: isMobile ? '9px' : '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: isMobile ? '0.2em' : '0.3em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {saving ? 'Saving...' : 'Save Address'}
                                </motion.button>
                                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
                                    style={{ padding: isMobile ? '12px 18px' : '16px 28px', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.6)', borderRadius: '2px', cursor: 'pointer', fontSize: isMobile ? '9px' : '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: isMobile ? '0.15em' : '0.2em' }}>
                                    Cancel
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </main>
    )
}
