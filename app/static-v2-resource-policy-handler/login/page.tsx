'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [clickCount, setClickCount] = useState(0)
    const [isUnlocked, setIsUnlocked] = useState(false)
    const router = useRouter()

    // The portal only shows up if the user clicks the "404" 5 times
    const handleSecretTrigger = () => {
        const newCount = clickCount + 1
        setClickCount(newCount)
        if (newCount >= 5) {
            setIsUnlocked(true)
        }
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const supabase = createClient()
        // Trim email + password so a stray space/newline from pasting doesn't
        // cause a false "Invalid login credentials". Email is also lowercased.
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password.trim(),
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        // Redirect to the new hidden path
        router.push('/static-v2-resource-policy-handler')
        router.refresh()
    }

    // Standard 404 UI that acts as a cloak
    if (!isUnlocked) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                fontFamily: 'sans-serif',
                textAlign: 'center',
                padding: '20px'
            }}>
                <h1
                    onClick={handleSecretTrigger}
                    style={{
                        fontSize: '120px',
                        margin: 0,
                        fontWeight: 900,
                        color: '#eee',
                        cursor: 'default',
                        userSelect: 'none'
                    }}
                >
                    404
                </h1>
                <p style={{ color: '#888', fontSize: '18px', marginTop: '-20px' }}>
                    The page you are looking for does not exist.
                </p>
                <Link href="/" style={{ color: '#000', textDecoration: 'none', borderBottom: '1px solid #000', marginTop: '20px', fontSize: '14px' }}>
                    Return to home
                </Link>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0a'
            }}
        >
            <div style={{ position: 'absolute', top: '40px', left: '40px' }}>
                <span style={{ color: '#d4af37', fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase' }}>Secure Access System v2.0</span>
            </div>

            <form onSubmit={handleLogin} style={{
                background: '#111',
                padding: '48px',
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                border: '1px solid rgba(212,175,55,0.1)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <h1 style={{ margin: 0, fontSize: '24px', color: '#fff', fontFamily: 'var(--font-baskerville)', fontWeight: 400 }}>Portal Unlock</h1>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>Identity verification required</p>
                </div>

                {error && (
                    <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ color: '#ff4d4d', margin: 0, fontSize: '12px', textAlign: 'center', background: 'rgba(255,77,77,0.1)', padding: '10px' }}
                    >
                        {error}
                    </motion.p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Username</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                        style={{
                            padding: '14px',
                            background: '#000',
                            border: '1px solid #222',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Security Phrase</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{
                            padding: '14px',
                            background: '#000',
                            border: '1px solid #222',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '16px',
                        background: '#d4af37',
                        color: '#000',
                        border: 'none',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        transition: 'all 0.3s',
                        marginTop: '10px'
                    }}
                >
                    {loading ? 'Decrypting...' : 'Authenticate'}
                </button>
            </form>
        </motion.div>
    )
}