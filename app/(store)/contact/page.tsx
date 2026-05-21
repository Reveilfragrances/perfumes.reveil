'use client'
import { motion } from 'framer-motion'
import { AnimatedNavbar } from '@/components/store/AnimatedNavbar'
import { StayConnected } from '@/components/store/StayConnected'
import { Phone, Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('orderId')
    if (orderId) {
      setFormData((prev) => ({
        ...prev,
        message: `Hi, I need help with my order #${orderId}.\n\n`,
      }))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus('idle')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', phone: '', message: '' })
      } else {
        console.error('[contact form] submit failed:', data)
        setStatus('error')
      }
    } catch (err) {
      console.error('[contact form] network error:', err)
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{
      background: '#ffffff',
      color: '#050505',
      height: isMobile ? 'auto' : '100vh',
      minHeight: '100vh',
      overflow: isMobile ? 'auto' : 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HIDDEN SEO HEADINGS - GOD LEVEL SEO */}
      <div className="sr-only">
        <h1>Contact REVEIL - Luxury Perfume Customer Care and Fragrance Concierge</h1>
        <h2>Premium Perfume Inquiries India - Signature Scents and Custom Orders</h2>
        <p>Get in touch with the REVEIL perfume experts. Whether you are looking for long-lasting perfumes, traditional attars, or designer body sprays, our team is here to guide you.</p>
      </div>

      <AnimatedNavbar />

      <div style={{
        flex: 1,
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : 'row',
        gridTemplateColumns: isMobile ? 'none' : '1fr 1fr',
        width: '100%',
        marginTop: '0'
      }}>

        {/* Left Side: Visual Legacy */}
        <div style={{
          position: 'relative',
          background: '#050505',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isMobile ? '80px 24px' : '100px 80px 80px',
          minHeight: isMobile ? '450px' : 'auto'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <img
              src="https://lhnamtkpjkrawgql.public.blob.vercel-storage.com/ChatGPT%20Image%20Apr%2021%2C%202026%2C%2010_18_56%20PM%20%281%29.webp"
              alt="Perfume Essence"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: isMobile ? 0 : -30, y: isMobile ? 20 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <h2 style={{
              fontSize: isMobile ? '28px' : 'clamp(28px, 3vw, 42px)',
              fontFamily: 'var(--font-baskerville)',
              color: '#d4af37',
              marginBottom: '24px',
              lineHeight: 1.1
            }}>
              The Art of <br /> Communication
            </h2>
            <p style={{
              fontSize: isMobile ? '13px' : '15px',
              color: '#ffffff',
              maxWidth: isMobile ? '100%' : '400px',
              lineHeight: 1.7,
              marginBottom: isMobile ? '32px' : '48px'
            }}>
              Experience the bespoke world of REVEIL. Our concierge team is here to guide your olfactory journey.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '24px' : '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
                  <Mail size={12} />
                </div>
                <span style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#ffffff' }}>reveilfragrances@gmail.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
                  <Phone size={12} />
                </div>
                <span style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#ffffff' }}>+91 7873789595</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Contact Form */}
        <div style={{
          background: '#fff',
          padding: isMobile ? '40px 24px 60px' : '100px 80px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div style={{ marginBottom: isMobile ? '32px' : '48px' }}>
              <h1 style={{
                fontSize: isMobile ? '26px' : '38px',
                fontFamily: 'var(--font-baskerville)',
                color: '#050505',
                marginBottom: '12px'
              }}>
                Contact <span style={{ color: '#d4af37' }}>REVEIL</span>
              </h1>
              <p style={{ fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#aaa' }}>
                Get in touch for exclusive offers
              </p>
            </div>

            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  padding: '40px 24px',
                  border: '1px solid #d4af37',
                  textAlign: 'center',
                  background: '#fffcf5',
                  borderRadius: '2px'
                }}
              >
                <CheckCircle size={40} color="#d4af37" style={{ marginBottom: '20px' }} />
                <h3 style={{ fontFamily: 'var(--font-baskerville)', fontSize: '20px', marginBottom: '12px' }}>Message Received</h3>
                <p style={{ color: '#666', fontSize: '13px' }}>Our concierge team will contact you shortly.</p>
                <button
                  onClick={() => setStatus('idle')}
                  style={{
                    marginTop: '24px', background: 'none', border: 'none',
                    textDecoration: 'underline', cursor: 'pointer', fontSize: '11px',
                    letterSpacing: '0.1em'
                  }}
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '32px' : '40px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: isMobile ? '32px' : '32px',
                  width: '100%'
                }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      placeholder="Name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #eee',
                        padding: '12px 0', color: '#050505', fontSize: '15px', outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #eee',
                        padding: '12px 0', color: '#050505', fontSize: '15px', outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #eee',
                      padding: '12px 0', color: '#050505', fontSize: '15px', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                  <textarea
                    rows={1}
                    placeholder="Message"
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #eee',
                      padding: '12px 0', color: '#050505', fontSize: '15px', outline: 'none',
                      resize: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {status === 'error' && (
                  <p style={{ color: '#ff4b4b', fontSize: '12px' }}>Failed to send message. Please try again.</p>
                )}

                <motion.button
                  disabled={isSubmitting}
                  whileHover={!isSubmitting && !isMobile ? { backgroundColor: '#050505', color: '#fff', x: 10 } : {}}
                  whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: isMobile ? '16px 20px' : '20px 30px',
                    background: '#d4af37', color: '#000',
                    border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontWeight: 900, fontSize: isMobile ? '10px' : '12px', letterSpacing: '0.4em',
                    textTransform: 'uppercase', transition: 'all 0.4s',
                    opacity: isSubmitting ? 0.7 : 1,
                    marginTop: isMobile ? '10px' : '0',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                </motion.button>
              </form>
            )}
          </motion.div>
        </div>
      </div>

      <StayConnected theme="dark" />
    </main>
  )
}
