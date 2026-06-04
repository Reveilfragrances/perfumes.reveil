'use client'

import { useEffect, useState, Suspense } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck, Truck, MapPin, Plus, ArrowRight, Check, CreditCard, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isOdishaPincode, isEmail, realEmail } from '@/lib/validators'

type Address = {
    id: string
    label: string
    full_name: string
    phone: string
    address_line1: string
    address_line2?: string | null
    city: string
    state: string
    pincode: string
    is_default: boolean
}

type CartItem = {
    id: string
    quantity: number
    products: {
        id: string
        name: string
        price: number
        images?: string[] | null
        category?: string | null
    } | null
}

declare global {
    interface Window {
        Razorpay: any
    }
}

// Shipping rules (Reveil, May 2026):
//   - Subtotal >= ₹250                   → Free
//   - Subtotal < ₹250 + Online (Razorpay) → ₹60
//   - Subtotal < ₹250 + Cash on Delivery  → ₹80
const FREE_THRESHOLD = 250
const SHIPPING_FEE_COD = 80
const SHIPPING_FEE_PREPAID = 60

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', background: '#f8f7f2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <Loader2 className="animate-spin" size={28} color="#d4af37" />
                <span style={{ fontSize: '10px', color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase' }}>Preparing checkout...</span>
            </div>
        }>
            <CheckoutInner />
        </Suspense>
    )
}

function CheckoutInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const buyNowProductId = searchParams.get('buyNow')
    const buyNowQty = Math.max(1, parseInt(searchParams.get('qty') || '1', 10))
    const isBuyNow = !!buyNowProductId
    // Set when returning from the address book after adding a new address — so we
    // auto-select it instead of defaulting back to the previous default address.
    const newAddressId = searchParams.get('newAddressId')
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<CartItem[]>([])
    const [addresses, setAddresses] = useState<Address[]>([])
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay')
    const [placing, setPlacing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string>('')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        async function load() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    const next = isBuyNow
                        ? `/checkout?buyNow=${buyNowProductId}&qty=${buyNowQty}`
                        : '/checkout'
                    router.push(`/auth?next=${encodeURIComponent(next)}`)
                    return
                }
                // Pre-fill only a REAL email — phone-OTP signups carry a synthetic
                // "<phone>@reveil.internal" placeholder that must never be shown
                // or used as a contact address.
                const existingEmail = realEmail(user.email)
                if (existingEmail) setUserEmail(existingEmail)

                const addrRes = await fetch('/api/user/address')
                if (addrRes.status === 401) {
                    router.push('/auth?next=/checkout')
                    return
                }
                const addrData = await addrRes.json()

                if (isBuyNow) {
                    // Fetch the single product directly — bypass cart entirely
                    const { data: product, error: prodErr } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', buyNowProductId)
                        .single()
                    if (prodErr || !product) {
                        setError('That product is not available.')
                        return
                    }
                    setItems([{ id: 'buy-now', quantity: buyNowQty, products: product as any }])
                } else {
                    const cartRes = await fetch('/api/cart')
                    if (cartRes.status === 401) {
                        router.push('/auth?next=/checkout')
                        return
                    }
                    const cartData = await cartRes.json()
                    const cartItems: CartItem[] = cartData.items || []
                    if (cartItems.length === 0) {
                        router.push('/cart')
                        return
                    }
                    setItems(cartItems)
                }

                const addrs: Address[] = addrData.addresses || []
                setAddresses(addrs)
                // Prefer a just-added address (returned from the address book),
                // then the default, then the first available.
                const justAdded = newAddressId ? addrs.find((a) => a.id === newAddressId) : undefined
                const def = justAdded || addrs.find((a) => a.is_default) || addrs[0]
                if (def) setSelectedAddressId(def.id)
            } catch (err) {
                console.error('Checkout load error:', err)
                setError('Failed to load checkout. Please try again.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isBuyNow, buyNowProductId, buyNowQty])

    const subtotal = items.reduce((sum, item) => sum + (item.products?.price ?? 0) * item.quantity, 0)
    // Per-product opt-out: if every item has apply_delivery_fee=false, no shipping.
    const applyFee = items.length === 0
        ? true
        : items.some((it: any) => (it.products?.apply_delivery_fee ?? true) === true)
    // Otherwise standard rules: free above ₹250, else COD ₹80 / Online ₹60.
    const shipping = !applyFee
        ? 0
        : subtotal >= FREE_THRESHOLD
            ? 0
            : paymentMethod === 'cod' ? SHIPPING_FEE_COD : SHIPPING_FEE_PREPAID
    const total = subtotal + shipping
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null

    // The checkout URL (incl. buy-now params) we send to the address book so it
    // can return the user here after they save a new address.
    const checkoutReturnPath = isBuyNow
        ? `/checkout?buyNow=${buyNowProductId}&qty=${buyNowQty}`
        : '/checkout'
    const addAddressHref = `/address-book?next=${encodeURIComponent(checkoutReturnPath)}`

    const placeCodOrder = async () => {
        if (!selectedAddress) return
        const orderItems = items.map((i) => ({
            product_id: i.products!.id,
            quantity: i.quantity,
        }))
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: orderItems,
                email: userEmail.trim(),
                shipping_address: {
                    label: selectedAddress.label,
                    full_name: selectedAddress.full_name,
                    phone: selectedAddress.phone,
                    address_line1: selectedAddress.address_line1,
                    address_line2: selectedAddress.address_line2,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    pincode: selectedAddress.pincode,
                },
                payment_method: 'cod',
                buy_now: isBuyNow,
            }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to place order')
        return data?.id as string
    }

    const ensureRazorpayLoaded = async () => {
        if (typeof window === 'undefined') throw new Error('Browser only')
        if (window.Razorpay) return
        await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-rzp]')
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true })
                existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')), { once: true })
                return
            }
            const s = document.createElement('script')
            s.src = 'https://checkout.razorpay.com/v1/checkout.js'
            s.async = true
            s.dataset.rzp = '1'
            s.onload = () => resolve()
            s.onerror = () => reject(new Error('Failed to load Razorpay'))
            document.head.appendChild(s)
        })
        if (!window.Razorpay) throw new Error('Razorpay failed to initialise. Please reload the page.')
    }

    const placeRazorpayOrder = async () => {
        if (!selectedAddress) return

        await ensureRazorpayLoaded()

        // Step 1 — create the Razorpay order on our server
        const createRes = await fetch('/api/payment/razorpay/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address_id: selectedAddress.id,
                email: userEmail.trim(),
                buy_now: isBuyNow ? { product_id: buyNowProductId, quantity: buyNowQty } : undefined,
            }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) {
            // Server already wrote a structured error. Surface the operator
            // hint when present so a misconfigured DB shows up in plain English
            // instead of a vague "Could not initialise payment".
            const detail = createData.hint || createData.reason
            const message = detail
                ? `${createData.error || 'Failed to start payment'} — ${detail}`
                : createData.error || 'Failed to start payment'
            throw new Error(message)
        }

        if (!createData.key_id) {
            throw new Error('Razorpay is not configured yet. Please contact support.')
        }

        // Step 2 — open Razorpay Checkout
        return await new Promise<string>((resolve, reject) => {
            const rzp = new window.Razorpay({
                key: createData.key_id,
                amount: createData.amount,
                currency: createData.currency,
                name: 'REVEIL',
                description: 'Luxury Perfumes',
                order_id: createData.razorpay_order_id,
                prefill: {
                    name: selectedAddress.full_name,
                    email: userEmail,
                    contact: selectedAddress.phone,
                },
                notes: { address_id: selectedAddress.id },
                theme: { color: '#d4af37' },
                handler: async (response: any) => {
                    try {
                        const verifyRes = await fetch('/api/payment/razorpay/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                address_id: selectedAddress.id,
                                buy_now: isBuyNow ? { product_id: buyNowProductId, quantity: buyNowQty } : undefined,
                            }),
                        })
                        const verifyData = await verifyRes.json()
                        if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed')
                        resolve(verifyData.order_id)
                    } catch (err: any) {
                        reject(err)
                    }
                },
                modal: {
                    ondismiss: () => reject(new Error('Payment cancelled')),
                },
            })
            rzp.on('payment.failed', (resp: any) => {
                reject(new Error(resp?.error?.description || 'Payment failed'))
            })
            rzp.open()
        })
    }

    const handlePlaceOrder = async () => {
        if (!selectedAddress) {
            setError('Please select a delivery address.')
            return
        }
        if (!userEmail.trim()) {
            setError('Please enter your email address to receive order updates.')
            return
        }
        if (!isEmail(userEmail.trim())) {
            setError('Please enter a valid email address.')
            return
        }
        if (!isOdishaPincode(selectedAddress.pincode)) {
            setError('Please choose an address with a valid 6-digit Indian pincode.')
            return
        }
        setPlacing(true)
        setError(null)
        try {
            const orderId =
                paymentMethod === 'cod' ? await placeCodOrder() : await placeRazorpayOrder()
            if (orderId) {
                router.push(`/orders?placed=${orderId}`)
            } else {
                router.push('/orders')
            }
        } catch (err: any) {
            console.error('Place order error:', err)
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setPlacing(false)
        }
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8f7f2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <Loader2 className="animate-spin" size={28} color="#d4af37" />
                <span style={{ fontSize: '10px', color: '#d4af37', letterSpacing: '0.4em', textTransform: 'uppercase' }}>Preparing checkout...</span>
            </div>
        )
    }

    return (
        <>
            <Script
                src="https://checkout.razorpay.com/v1/checkout.js"
                strategy="afterInteractive"
                data-rzp="1"
            />

            <main style={{ background: '#f8f7f2', minHeight: '100vh', color: '#1a1a1a', paddingTop: isMobile ? '90px' : '120px', paddingBottom: isMobile ? '60px' : '120px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 40px' }}>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d4af37', fontSize: isMobile ? '8px' : '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: isMobile ? '0.4em' : '0.6em', marginBottom: '16px', fontFamily: 'var(--font-baskerville)' }}>
                        Secure Checkout <div style={{ width: '30px', height: '1px', background: 'rgba(212,175,55,0.3)' }} />
                    </motion.div>
                    <h1 style={{ fontSize: isMobile ? 'clamp(26px, 8vw, 36px)' : 'clamp(32px, 6vw, 56px)', fontFamily: 'var(--font-baskerville)', textTransform: 'uppercase', margin: 0, lineHeight: 1, fontWeight: 300, marginBottom: isMobile ? '28px' : '48px' }}>
                        Complete Your <span style={{ color: '#d4af37', fontStyle: 'italic', fontWeight: 400 }}>Order</span>
                    </h1>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: isMobile ? '24px' : '60px', alignItems: 'start' }}>
                        {/* LEFT — address + payment */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '32px' }}>
                            {/* Addresses */}
                            <section style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '2px', padding: isMobile ? '20px' : '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h2 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', color: '#d4af37', fontFamily: 'var(--font-baskerville)', margin: 0 }}>Delivery Address</h2>
                                    <Link href={addAddressHref} style={{ fontSize: '9px', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.2em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Plus size={12} /> Add New
                                    </Link>
                                </div>

                                {addresses.length === 0 ? (
                                    <div style={{ padding: '32px', border: '1px dashed rgba(0,0,0,0.1)', textAlign: 'center' }}>
                                        <MapPin size={20} color="#666" style={{ marginBottom: '12px' }} />
                                        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 16px' }}>You don't have any saved addresses yet.</p>
                                        <Link href={addAddressHref} style={{ display: 'inline-block', padding: '12px 24px', border: '1px solid #d4af37', color: '#d4af37', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', textDecoration: 'none' }}>
                                            Add Address
                                        </Link>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {addresses.map((a) => {
                                            const active = a.id === selectedAddressId
                                            return (
                                                <button
                                                    key={a.id}
                                                    onClick={() => setSelectedAddressId(a.id)}
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '20px',
                                                        background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                                                        border: `1px solid ${active ? '#d4af37' : 'rgba(0,0,0,0.12)'}`,
                                                        cursor: 'pointer',
                                                        color: '#1a1a1a',
                                                        display: 'grid',
                                                        gridTemplateColumns: '24px 1fr',
                                                        gap: '16px',
                                                        alignItems: 'start',
                                                    }}
                                                >
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1px solid ${active ? '#d4af37' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                                        {active && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d4af37' }} />}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '9px', letterSpacing: '0.3em', color: '#d4af37', fontWeight: 900, textTransform: 'uppercase' }}>{a.label}</span>
                                                            {a.is_default && <span style={{ fontSize: '8px', padding: '2px 8px', border: '1px solid rgba(0,0,0,0.1)', color: '#888', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Default</span>}
                                                        </div>
                                                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{a.full_name} · {a.phone}</div>
                                                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', marginTop: '4px', lineHeight: 1.5 }}>
                                                            {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} {a.pincode}
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Contact Email */}
                            <section style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '2px', padding: isMobile ? '20px' : '32px' }}>
                                <h2 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', color: '#d4af37', fontFamily: 'var(--font-baskerville)', margin: '0 0 8px' }}>Contact Email</h2>
                                <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)', margin: '0 0 16px' }}>We'll send your order confirmation and updates here.</p>
                                <input
                                    type="email"
                                    value={userEmail}
                                    onChange={(e) => setUserEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    style={{
                                        width: '100%',
                                        background: '#fff',
                                        border: 'none',
                                        borderBottom: '1px solid rgba(0,0,0,0.15)',
                                        color: '#1a1a1a',
                                        fontSize: '14px',
                                        padding: '12px 2px',
                                        outline: 'none',
                                        fontFamily: 'var(--font-baskerville)',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </section>

                            {/* Payment Method */}
                            <section style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '2px', padding: isMobile ? '20px' : '32px' }}>
                                <h2 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', color: '#d4af37', fontFamily: 'var(--font-baskerville)', margin: '0 0 24px' }}>Payment Method</h2>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { id: 'razorpay' as const, label: 'Pay Online', desc: 'Cards · UPI · Netbanking · Wallets', Icon: CreditCard },
                                        { id: 'cod' as const, label: 'Cash on Delivery', desc: 'Pay in cash when your order arrives', Icon: Wallet },
                                    ].map(({ id, label, desc, Icon }) => {
                                        const active = paymentMethod === id
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => setPaymentMethod(id)}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '20px',
                                                    background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                                                    border: `1px solid ${active ? '#d4af37' : 'rgba(0,0,0,0.12)'}`,
                                                    cursor: 'pointer',
                                                    color: '#1a1a1a',
                                                    display: 'grid',
                                                    gridTemplateColumns: '24px 1fr auto',
                                                    gap: '16px',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1px solid ${active ? '#d4af37' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {active && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d4af37' }} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                                                    <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)', marginTop: '4px' }}>{desc}</div>
                                                </div>
                                                <Icon size={18} color={active ? '#d4af37' : '#666'} />
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        </div>

                        {/* RIGHT — summary */}
                        <aside style={{ background: '#ffffff', padding: isMobile ? '20px' : '32px', borderRadius: '2px', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '24px', color: '#d4af37', fontFamily: 'var(--font-baskerville)' }}>Order Summary</h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', maxHeight: '240px', overflowY: 'auto' }}>
                                {items.map((item) => (
                                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '60px', background: '#f3eee2', overflow: 'hidden' }}>
                                            {item.products?.images?.[0] && (
                                                <img src={item.products.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            )}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '11px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.products?.name}</div>
                                            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>Qty {item.quantity}</div>
                                        </div>
                                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-baskerville)' }}>₹{((item.products?.price ?? 0) * item.quantity).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: 'rgba(0,0,0,0.08)', margin: '8px 0 24px' }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'rgba(0,0,0,0.5)' }}>Subtotal</span>
                                    <span>₹{subtotal.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'rgba(0,0,0,0.5)' }}>
                                        Shipping
                                        {shipping > 0 && (
                                            <span style={{ color: 'rgba(0,0,0,0.4)', marginLeft: '6px', fontSize: '10px' }}>
                                                ({paymentMethod === 'cod' ? 'COD' : 'Online'})
                                            </span>
                                        )}
                                    </span>
                                    <span style={{ color: shipping === 0 ? '#16a34a' : '#1a1a1a' }}>
                                        {shipping === 0 ? 'FREE' : `₹${shipping}`}
                                    </span>
                                </div>
                                {shipping === 0 ? (
                                    <div style={{ fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Check size={12} /> Free delivery unlocked (orders over ₹{FREE_THRESHOLD})
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.5 }}>
                                        {paymentMethod === 'cod'
                                            ? `COD shipping is ₹${SHIPPING_FEE_COD}. Pay online to save ₹${SHIPPING_FEE_COD - SHIPPING_FEE_PREPAID} — or spend ₹${(FREE_THRESHOLD - subtotal).toLocaleString()} more to unlock free delivery.`
                                            : `Add ₹${(FREE_THRESHOLD - subtotal).toLocaleString()} more to unlock free delivery.`}
                                    </div>
                                )}
                                <div style={{ height: '1px', background: 'rgba(0,0,0,0.08)', margin: '8px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 400, fontFamily: 'var(--font-baskerville)' }}>
                                    <span>TOTAL</span>
                                    <span>₹{total.toLocaleString()}</span>
                                </div>
                            </div>

                            {error && (
                                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', color: '#ff6b6b', fontSize: '11px' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handlePlaceOrder}
                                disabled={placing || !selectedAddressId || !userEmail.trim()}
                                style={{
                                    width: '100%',
                                    background: placing || !selectedAddressId || !userEmail.trim() ? '#888' : '#1a1a1a',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '18px',
                                    fontSize: '10px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3em',
                                    cursor: placing || !selectedAddressId ? 'not-allowed' : 'pointer',
                                    marginTop: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                }}
                            >
                                {placing ? (
                                    <><Loader2 className="animate-spin" size={14} /> Processing</>
                                ) : (
                                    <>{paymentMethod === 'cod' ? 'Place Order' : `Pay ₹${total.toLocaleString()}`} <ArrowRight size={14} /></>
                                )}
                            </button>

                            <div style={{ marginTop: '24px', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <ShieldCheck size={12} color="#d4af37" />
                                    <p style={{ fontSize: '9px', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Secure 256-bit Encrypted</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <Truck size={12} color="#d4af37" />
                                    <p style={{ fontSize: '9px', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Pan-India Delivery</p>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </>
    )
}