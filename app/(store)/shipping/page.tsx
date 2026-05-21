'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AnimatedNavbar } from '@/components/store/AnimatedNavbar'
import { StayConnected } from '@/components/store/StayConnected'
import { Truck, Box, MapPin, Clock, CreditCard } from 'lucide-react'
import { Footer } from '@/components/store/Footer'

export default function ShippingPage() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return (
        <main style={{ background: '#ffffff', color: '#050505', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* HIDDEN SEO HEADINGS - GOD LEVEL SEO */}
            <div className="sr-only">
                <h1>REVEIL Shipping and Delivery - Premium Perfume Logistics India</h1>
                <h2>Fast Delivery for Luxury Fragrances, Attars, and Designer Scents</h2>
                <p>Learn about REVEIL's shipping policies. Free shipping on orders above ₹250. Below ₹250 — ₹60 online / ₹80 cash on delivery. Cash on delivery available pan-India. Track your signature scents from our laboratory to your doorstep.</p>
            </div>

            <AnimatedNavbar />

            {/* Header Section */}
            <section style={{
                padding: isMobile ? '140px 24px 60px' : '180px 40px 60px',
                textAlign: 'center',
                background: '#fafafa',
                borderBottom: '1px solid #eee'
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                >
                    <h1 style={{
                        fontSize: isMobile ? '36px' : 'clamp(32px, 5vw, 64px)',
                        fontFamily: 'var(--font-baskerville)',
                        fontWeight: 900,
                        color: '#050505',
                        marginBottom: '10px'
                    }}>
                        Shipping <span style={{ color: '#d4af37' }}>&</span> Delivery
                    </h1>
                    <p style={{
                        fontSize: '11px',
                        letterSpacing: '0.4em',
                        textTransform: 'uppercase',
                        color: '#aaa',
                        fontWeight: 500
                    }}>
                        Global Standards — Local Care
                    </p>
                </motion.div>
            </section>

            {/* Feature Row */}
            <section style={{ padding: isMobile ? '40px 24px' : '60px 40px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                    gap: isMobile ? '16px' : '20px'
                }}>
                    {[
                        { icon: Truck, title: 'Free Shipping', text: 'On orders above ₹250' },
                        { icon: CreditCard, title: 'COD Available', text: 'Pay at your doorstep' },
                        { icon: Clock, title: 'Early Dispatch', text: '4-7 days processing' },
                        { icon: Box, title: 'Secure Track', text: 'SMS notifications' }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            style={{
                                padding: isMobile ? '20px 10px' : '30px 20px', textAlign: 'center',
                                background: '#fff', border: '1px solid #eee',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
                            }}
                        >
                            <item.icon size={20} color="#d4af37" strokeWidth={1.5} />
                            <div>
                                <h4 style={{ fontSize: isMobile ? '10px' : '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>{item.title}</h4>
                                <p style={{ fontSize: isMobile ? '11px' : '13px', color: '#888' }}>{item.text}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Detailed Content */}
            <section style={{ padding: isMobile ? '40px 24px 80px' : '40px 40px 100px', maxWidth: '900px', margin: '0 auto', flex: 1, width: '100%', boxSizing: 'border-box' }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    style={{ lineHeight: 1.8, fontSize: isMobile ? '15px' : '16px', color: '#444' }}
                >
                    <div style={{ marginBottom: isMobile ? '40px' : '60px' }}>
                        <h2 style={{ fontFamily: 'var(--font-baskerville)', fontSize: isMobile ? '28px' : '32px', color: '#050505', marginBottom: '24px' }}>General Guidelines</h2>
                        <p style={{ marginBottom: '20px' }}>
                            The REVEIL website is operated by **Trimurty Enterprises**. We are committed to delivering your signature scents within the promised period and in accordance with this policy.
                        </p>
                        <p>
                            We currently deliver across India, using the most reliable courier partners to ensure your products arrive in perfect condition.
                        </p>
                    </div>

                    <div style={{ marginBottom: isMobile ? '40px' : '60px' }}>
                        <h2 style={{ fontFamily: 'var(--font-baskerville)', fontSize: isMobile ? '28px' : '32px', color: '#050505', marginBottom: '24px' }}>Shipping Cost & Updates</h2>
                        <p style={{ marginBottom: '20px' }}>
                            Shipping and handling rates vary based on product size, volume, and destination. The exact cost is calculated and shown at the final checkout window.
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                                <div style={{ color: '#d4af37' }}>—</div>
                                <span>Orders <strong>above ₹250</strong> ship <strong>free</strong> across India — no payment-method restriction.</span>
                            </li>
                            <li style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                                <div style={{ color: '#d4af37' }}>—</div>
                                <span>Orders <strong>under ₹250</strong> with <strong>online payment</strong> (UPI / card / net-banking): flat <strong>₹60</strong> shipping.</span>
                            </li>
                            <li style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                                <div style={{ color: '#d4af37' }}>—</div>
                                <span>Orders <strong>under ₹250</strong> with <strong>cash on delivery</strong>: flat <strong>₹80</strong> shipping (covers courier handling charges).</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ color: '#d4af37' }}>—</div>
                                <span>Once shipped, tracking details are sent to your registered email and shown on the <strong>My Orders</strong> page.</span>
                            </li>
                        </ul>
                    </div>

                    <div style={{ padding: isMobile ? '30px 24px' : '40px', background: '#fafafa', border: '1px solid #eee' }}>
                        <h3 style={{ fontFamily: 'var(--font-baskerville)', fontSize: '20px', color: '#ec4899', marginBottom: '15px' }}>Important Note</h3>
                        <p style={{ fontSize: '14px', fontStyle: 'italic' }}>
                            "To ensure timely delivery, please double-check your shipping address before finalizing your order. Once placed, the delivery destination cannot be altered in our system."
                        </p>
                    </div>
                </motion.div>
            </section>

            <StayConnected theme="light" />
        </main>
    )
}
