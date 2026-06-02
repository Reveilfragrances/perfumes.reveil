'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, ArrowRight, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Home } from 'lucide-react'


function AuthPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const modeParam = searchParams.get('mode') as 'login' | 'signup' | null
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [otpSent, setOtpSent] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [authMode, setAuthMode] = useState<'login' | 'signup'>(modeParam || 'login')
    const [step, setStep] = useState<'auth' | 'name'>('auth')
    const [userId, setUserId] = useState<string | null>(null)
    const [loginUrl, setLoginUrl] = useState<string | null>(null)

    // Message Central verification ID — returned after OTP send
    const [verificationId, setVerificationId] = useState<string | null>(null)
    const [showNotRegistered, setShowNotRegistered] = useState(false)

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        otp: '',
    })

    useEffect(() => {
        if (modeParam) setAuthMode(modeParam)
        const errorParam = searchParams.get('error')
        if (errorParam === 'session_failed') {
            setError('Login link expired or already used. Please request a new OTP.')
        } else {
            // Clear stale error if user navigated away from a failed link
            setError((prev) => (prev?.includes('Login link expired') ? null : prev))
        }
    }, [modeParam, searchParams])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        setError(null)
        setMessage(null)
    }, [authMode])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    // ── STEP 1: Send OTP via Message Central ──────────────────────────────────
    const sendOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const digits = formData.phone.replace(/\D/g, '')
        if (digits.length !== 10) {
            setError('Please enter a valid 10-digit mobile number.')
            return
        }

        // Signup mode: also require a first name upfront so we can persist
        // the profile inside the OTP-verify step (where the admin client
        // already does the upsert). Avoids the broken post-OTP save-profile
        // path that 401's because the magic link hasn't been visited yet.
        if (authMode === 'signup' && !formData.firstName.trim()) {
            setError('Please enter your first name.')
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const formattedPhone = `+91${digits}`

            // Pre-validate: check if user exists/doesn't exist
            const checkRes = await fetch('/api/auth/firebase-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formattedPhone, mode: authMode }),
            })

            let checkData;
            try {
                checkData = await checkRes.json()
            } catch (e) {
                const text = await checkRes.text()
                console.error('Pre-check non-JSON response:', text)
                throw new Error(`Server Error (${checkRes.status}): ${text.slice(0, 50)}`)
            }

            if (!checkRes.ok) {
                if (checkData?.error_code === 'user_not_found') {
                    setShowNotRegistered(true)
                    setLoading(false)
                    return
                }
                setError(checkData.error || 'Something went wrong.')
                setLoading(false)
                return
            }

            // Send OTP via Message Central
            const otpRes = await fetch('/api/auth/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: formattedPhone }),
            })

            let otpData;
            try {
                otpData = await otpRes.json()
            } catch (e) {
                const text = await otpRes.text()
                console.error('OTP Send non-JSON response:', text)
                throw new Error(`OTP Service Error (${otpRes.status}): ${text.slice(0, 50)}`)
            }

            if (!otpRes.ok || !otpData.verificationId) {
                // Server attaches `hint`/`reason` for operator-facing errors
                // (missing env vars, expired MC token, etc.). Surface them so
                // we don't stare at "Failed to send OTP" with no context.
                const detail = otpData.hint || otpData.reason
                const base = otpData.error || 'Failed to send OTP. Please try again.'
                setError(detail ? `${base} — ${detail}` : base)
                setLoading(false)
                return
            }

            setVerificationId(otpData.verificationId)
            setOtpSent(true)
            setMessage(`OTP sent to +91 ${digits}`)
        } catch (err: any) {
            console.error('[AuthPage] Error:', err)
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── STEP 2: Verify OTP ────────────────────────────────────────────────────
    const verifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (formData.otp.length !== 4) {
            setError('Please enter the 4-digit OTP.')
            return
        }

        if (!verificationId) {
            setError('Session expired. Please request a new OTP.')
            return
        }

        setLoading(true)

        try {
            const digits = formData.phone.replace(/\D/g, '')
            const formattedPhone = `+91${digits}`

            const res = await fetch('/api/auth/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: formattedPhone,
                    otp: formData.otp,
                    verificationId,
                    mode: authMode,
                    email: formData.email?.trim() || undefined,
                    firstName: formData.firstName?.trim() || undefined,
                    lastName: formData.lastName?.trim() || undefined,
                }),
            })

            let data;
            try {
                data = await res.json()
            } catch (e) {
                const text = await res.text()
                console.error('OTP Verify non-JSON response:', text)
                throw new Error(`Verify Error (${res.status}): ${text.slice(0, 50)}`)
            }

            if (!res.ok || data.error) {
                // Backstop: if the number turns out not to be registered at verify
                // time (login flow), show the same "create an account" popup the
                // pre-check uses instead of a raw error — never log them in.
                if (data?.error_code === 'user_not_found') {
                    setShowNotRegistered(true)
                    setLoading(false)
                    return
                }
                const extra = data.detail || data.hint
                setError((data.error || 'OTP verification failed. Please try again.') + (extra ? ` — ${extra}` : ''))
                setLoading(false)
                return
            }

            setUserId(data.user_id)
            setLoginUrl(data.loginUrl)

            if (data.needs_name) {
                setStep('name')
                setLoading(false)
                return
            }

            if (data.loginUrl) {
                window.location.href = data.loginUrl
            }
        } catch (err: any) {
            console.error('[AuthPage] Verify Error:', err)
            setError('Something went wrong: ' + err.message)
            setLoading(false)
        }
    }

    // ── STEP 3: Save Name (fallback for existing users without a name) ────────
    // At this point the OTP has been consumed but the magic link is still
    // unvisited, so we have NO session cookie yet. Calling save-profile
    // directly would 401. Instead, stash the name data and navigate to the
    // magic link — AuthTokenCatcher will pick up the stashed data after the
    // session is established and complete the profile save.
    const handleSaveName = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        const firstName = formData.firstName.trim()

        if (!firstName) {
            setError('Please enter at least your first name.')
            return
        }
        if (!loginUrl) {
            setError('Session expired — please request a new OTP.')
            return
        }
        setLoading(true)

        try {
            sessionStorage.setItem('reveil_pending_profile', JSON.stringify({
                first_name: firstName,
                last_name: formData.lastName.trim(),
                phone: formData.phone,
                email: formData.email.trim(),
                ts: Date.now(),
            }))
            window.location.href = loginUrl
        } catch (err: any) {
            setError('Error: ' + err.message)
            setLoading(false)
        }
    }


    return (
        <main style={{
            background: '#fafafa',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-baskerville)',
            padding: isMobile ? '16px' : '24px'
        }}>
            {/* Not Registered Popup Modal */}
            <AnimatePresence>
                {showNotRegistered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNotRegistered(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100,
                            background: 'rgba(0,0,0,0.45)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '20px',
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: '#fff',
                                borderRadius: '8px',
                                padding: '40px 36px 32px',
                                maxWidth: '380px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '50%',
                                background: 'rgba(212,175,55,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px',
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#d4af37" />
                                </svg>
                            </div>

                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#000', marginBottom: '10px', letterSpacing: '0.02em' }}>
                                Not Registered Yet
                            </h3>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: '28px' }}>
                                We couldn't find an account for this number.<br />
                                Please create an account first to continue.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <motion.button
                                    whileHover={{ backgroundColor: '#c5a02e' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setShowNotRegistered(false)
                                        setAuthMode('signup')
                                        setError(null)
                                    }}
                                    style={{
                                        width: '100%', background: '#d4af37', color: '#000',
                                        border: 'none', padding: '14px', borderRadius: '3px',
                                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.4em',
                                        textTransform: 'uppercase', cursor: 'pointer',
                                        transition: 'background-color 0.2s ease',
                                    }}
                                >
                                    Create Account →
                                </motion.button>
                                <button
                                    onClick={() => setShowNotRegistered(false)}
                                    style={{
                                        background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)',
                                        fontSize: '12px', cursor: 'pointer', padding: '6px',
                                    }}
                                >
                                    Back to Login
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Form Side */}

            <div style={{
                width: '100%',
                maxWidth: '480px',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center'
            }}>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        width: '100%',
                        background: '#ffffff',
                        padding: isMobile ? '28px 20px 24px' : '48px 60px',
                        borderRadius: '8px',
                        boxShadow: '0 40px 120px rgba(0,0,0,0.04)',
                        textAlign: 'center',
                        border: '1px solid rgba(0,0,0,0.02)'
                    }}
                >
                    {/* Back to Home — inside card, top aligned */}
                    <div style={{ textAlign: 'left', marginBottom: isMobile ? '20px' : '28px' }}>
                        <Link href="/" prefetch={false} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            color: 'rgba(0,0,0,0.4)', textDecoration: 'none',
                            fontSize: '10px', fontWeight: 500,
                            letterSpacing: '0.2em', textTransform: 'uppercase', transition: 'all 0.3s ease'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(0,0,0,0.4)'}
                        >
                            <Home size={12} style={{ marginBottom: '1px' }} />
                            <span style={{ lineHeight: 1 }}>Back to Home</span>
                        </Link>
                    </div>

                    {/* Brand Logo Header */}
                    <div style={{ marginBottom: isMobile ? '20px' : '40px' }}>
                        <h1 style={{
                            fontSize: isMobile ? '18px' : '24px', color: '#000', fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0
                        }}>
                            REVEIL
                        </h1>
                        <div style={{ height: '1.5px', width: '30px', background: '#d4af37', margin: isMobile ? '8px auto' : '12px auto', opacity: 0.5 }} />
                    </div>

                    {/* Welcome Typography */}
                    <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
                        <h2 style={{ fontSize: isMobile ? '26px' : '38px', color: '#000', fontWeight: 300, marginBottom: '4px', letterSpacing: '0.01em' }}>
                            {authMode === 'login' ? 'Welcome to ' : 'Join '} <span style={{ color: '#d4af37', fontWeight: 400 }}>Reveil</span>
                        </h2>
                        <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: isMobile ? '11px' : '13px', fontWeight: 400, letterSpacing: '0.05em' }}>
                            {otpSent
                                ? 'Enter the code we sent to your phone'
                                : authMode === 'login'
                                    ? 'We will send a code to your phone'
                                    : 'Create your account — it only takes a minute'}
                        </p>
                    </div>

                    {/* MAIN AUTH FORM */}
                    {step === 'name' ? (
                        <form onSubmit={handleSaveName}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'left' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <motion.div whileHover={{ borderBottomColor: '#d4af37' }} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '4px' }}>
                                        <label style={{ fontSize: '9px', color: '#d4af37', textTransform: 'uppercase', marginBottom: '2px', display: 'block', letterSpacing: '0.15em' }}>First Name *</label>
                                        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required style={{ width: '100%', border: 'none', background: 'none', fontSize: '14px', outline: 'none', color: '#000' }} />
                                    </motion.div>
                                    <motion.div whileHover={{ borderBottomColor: '#d4af37' }} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '4px' }}>
                                        <label style={{ fontSize: '9px', color: '#d4af37', textTransform: 'uppercase', marginBottom: '2px', display: 'block', letterSpacing: '0.15em' }}>Last Name (optional)</label>
                                        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} style={{ width: '100%', border: 'none', background: 'none', fontSize: '14px', outline: 'none', color: '#000' }} />
                                    </motion.div>
                                </div>

                                <motion.div whileHover={{ borderBottomColor: '#d4af37' }} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '4px' }}>
                                    <label style={{ fontSize: '9px', color: '#d4af37', textTransform: 'uppercase', marginBottom: '2px', display: 'block', letterSpacing: '0.15em' }}>Email (optional)</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" style={{ width: '100%', border: 'none', background: 'none', fontSize: '14px', outline: 'none', color: '#000' }} />
                                </motion.div>

                                <motion.button
                                    whileHover={{ scale: 1.01, backgroundColor: '#c5a02e' }}
                                    whileTap={{ scale: 0.99 }}
                                    disabled={loading}
                                    style={{
                                        width: '100%', background: '#d4af37', color: '#000', border: 'none',
                                        padding: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                                        letterSpacing: '0.5em', cursor: loading ? 'not-allowed' : 'pointer',
                                        borderRadius: '2px', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', gap: '12px', marginTop: '12px'
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <>Save &amp; Continue <ArrowRight size={16} /></>}
                                </motion.button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={otpSent ? verifyOtp : sendOtp}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>

                                {!otpSent ? (
                                    <>
                                        {/* Signup-only: collect names + optional email upfront so OTP-verify can persist them */}
                                        {authMode === 'signup' && (
                                            <>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
                                                    <div>
                                                        <label style={{ fontSize: '9px', color: '#000', opacity: 0.4, textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.15em' }}>First Name *</label>
                                                        <input
                                                            type="text"
                                                            name="firstName"
                                                            placeholder="First name"
                                                            value={formData.firstName}
                                                            onChange={handleChange}
                                                            required
                                                            style={{
                                                                width: '100%',
                                                                background: '#fff',
                                                                border: '1px solid rgba(0,0,0,0.08)',
                                                                borderRadius: '4px',
                                                                padding: isMobile ? '14px 16px' : '18px 20px',
                                                                fontSize: isMobile ? '14px' : '15px',
                                                                color: '#000', outline: 'none'
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '9px', color: '#000', opacity: 0.4, textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.15em' }}>Last Name</label>
                                                        <input
                                                            type="text"
                                                            name="lastName"
                                                            placeholder="Last name"
                                                            value={formData.lastName}
                                                            onChange={handleChange}
                                                            style={{
                                                                width: '100%',
                                                                background: '#fff',
                                                                border: '1px solid rgba(0,0,0,0.08)',
                                                                borderRadius: '4px',
                                                                padding: isMobile ? '14px 16px' : '18px 20px',
                                                                fontSize: isMobile ? '14px' : '15px',
                                                                color: '#000', outline: 'none'
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'left' }}>
                                                    <label style={{ fontSize: '9px', color: '#000', opacity: 0.4, textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.15em' }}>Email (optional)</label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        placeholder="you@example.com"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        autoComplete="email"
                                                        style={{
                                                            width: '100%',
                                                            background: '#fff',
                                                            border: '1px solid rgba(0,0,0,0.08)',
                                                            borderRadius: '4px',
                                                            padding: isMobile ? '14px 16px' : '18px 20px',
                                                            fontSize: isMobile ? '14px' : '15px',
                                                            color: '#000', outline: 'none'
                                                        }}
                                                    />
                                                    <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.4)', margin: '6px 2px 0', letterSpacing: '0.02em' }}>
                                                        We&apos;ll use it for order receipts. Leave blank if you don&apos;t have one.
                                                    </p>
                                                </div>
                                            </>
                                        )}

                                        <div style={{ textAlign: 'left' }}>
                                            <label style={{ fontSize: '9px', color: '#000', opacity: 0.4, textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.15em' }}>Mobile Number</label>
                                            <motion.div
                                                whileHover={{ background: 'linear-gradient(145deg, #ffffff, #f9f9f9)', borderColor: '#000' }}
                                                style={{
                                                    background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '4px',
                                                    padding: isMobile ? '14px 16px' : '20px 24px',
                                                    display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s ease'
                                                }}>
                                                <span style={{ fontSize: isMobile ? '14px' : '16px', color: '#000', opacity: 0.4, fontWeight: 500, borderRight: '1px solid rgba(0,0,0,0.1)', paddingRight: '12px' }}>+91</span>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    placeholder="Your phone number"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    style={{ flex: 1, border: 'none', background: 'none', fontSize: isMobile ? '14px' : '16px', color: '#000', outline: 'none' }}
                                                />
                                                <MessageCircle size={isMobile ? 16 : 18} style={{ color: '#d4af37', opacity: 0.6 }} />
                                            </motion.div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ borderBottom: '2px solid #d4af37', paddingBottom: '8px' }}>
                                            <label style={{ fontSize: '10px', color: '#d4af37', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px', display: 'block' }}>Enter Code</label>
                                            <input
                                                type="text"
                                                name="otp"
                                                placeholder="· · · ·"
                                                value={formData.otp}
                                                onChange={handleChange}
                                                required
                                                maxLength={4}
                                                inputMode="numeric"
                                                style={{ width: '100%', padding: '8px 0 0', background: 'none', border: 'none', color: '#000', fontSize: '24px', letterSpacing: '0.6em', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                                            <button type="button" onClick={() => { setOtpSent(false); setVerificationId(null) }} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <ChevronLeft size={14} /> Back
                                            </button>
                                            <button type="button" onClick={(e) => sendOtp(e as any)} style={{ background: 'none', border: 'none', color: '#000', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                                                Didn&apos;t get the code? <span style={{ color: '#d4af37' }}>Resend</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Action Button */}
                                <motion.button
                                    whileHover={{ scale: 1.01, backgroundColor: '#c5a02e' }}
                                    whileTap={{ scale: 0.99 }}
                                    disabled={loading}
                                    style={{
                                        width: '100%', background: '#d4af37', color: '#000', border: 'none',
                                        padding: isMobile ? '16px' : '20px', fontSize: isMobile ? '10px' : '11px',
                                        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5em',
                                        cursor: loading ? 'not-allowed' : 'pointer', borderRadius: '2px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                        marginTop: isMobile ? '4px' : '8px', transition: 'background-color 0.3s ease'
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : (
                                        otpSent ? <>Verify Code <CheckCircle2 size={16} /></> : <>Send OTP <ArrowRight size={16} /></>
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    )}

                    {/* Mode Toggle */}
                    {!otpSent && (
                        <div style={{ marginTop: '24px', fontSize: '12px', color: 'rgba(0,0,0,0.5)', letterSpacing: '0.02em' }}>
                            {authMode === 'login' ? (
                                <p>New to REVEIL? <span onClick={() => setAuthMode('signup')} style={{ color: '#d4af37', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #d4af37' }}>Create Account</span></p>
                            ) : (
                                <p>Already have an account? <span onClick={() => setAuthMode('login')} style={{ color: '#d4af37', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #d4af37' }}>Login Here</span></p>
                            )}
                        </div>
                    )}

                    {/* Status Feedback */}
                    {error && <p style={{ color: '#ff4d4d', fontSize: '11px', marginTop: '16px', letterSpacing: '0.02em', fontWeight: 500 }}>{error}</p>}
                    {message && <p style={{ color: '#d4af37', fontSize: '11px', marginTop: '16px', letterSpacing: '0.02em', fontWeight: 500 }}>{message}</p>}

                    {/* Footer Legal */}
                    <div style={{ marginTop: isMobile ? '24px' : '48px', paddingTop: isMobile ? '16px' : '20px', borderTop: '1px solid rgba(0,0,0,0.04)', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', color: 'rgba(0,0,0,0.3)', lineHeight: 1.6, letterSpacing: '0.05em' }}>
                            Your information is safe with us.<br />
                            © Reveil 2026
                        </p>
                    </div>
                </motion.div>
            </div>

            <style jsx global>{`
                input:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }
            `}</style>
        </main>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={32} color="#d4af37" /></div>}>
            <AuthPageContent />
        </Suspense>
    )
}
