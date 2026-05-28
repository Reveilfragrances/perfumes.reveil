'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PremiumLoader } from '@/components/store/PremiumLoader'

// Auth callback reads ?code= / hash tokens at request time — never prerender it.
// Also avoids "Supabase URL/key required" build errors when env vars are only on Vercel.
export const dynamic = 'force-dynamic'

export default function AuthCallbackPage() {
    const router = useRouter()
    const supabase = createClient()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        // Strip tokens from the URL hash as early as we can — even if we
        // bail out below, we don't want access_token / refresh_token left
        // in browser history or visible to other scripts.
        const cleanHash = () => {
            if (typeof window !== 'undefined' && window.location.hash) {
                // Replace state so the URL bar updates without a navigation
                window.history.replaceState(null, '', window.location.pathname + window.location.search)
            }
        }

        const handleCallback = async () => {
            try {
                // 1. Check if session is already established (e.g. by automatic background parsing)
                const { data: { session: existingSession } } = await supabase.auth.getSession()
                if (existingSession) {
                    cleanHash()
                    router.replace('/orders')
                    return
                }

                // 2. Fallback: Manually parse tokens from hash if Supabase SDK is taking too long.
                //    Critical for mobile browsers where the hash fragment might not be
                //    immediately picked up by the SDK's internal listeners.
                const hash = window.location.hash
                if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
                    const params = new URLSearchParams(hash.substring(1))
                    const access_token = params.get('access_token')
                    const refresh_token = params.get('refresh_token')

                    if (access_token && refresh_token) {
                        const { data: { session: newSession }, error: setSessionError } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        })
                        // Clear hash immediately after we've consumed the tokens
                        cleanHash()
                        if (setSessionError) throw setSessionError
                        if (newSession) {
                            router.replace('/orders')
                            return
                        }
                    }
                }

                // 3. Listen for the SIGNED_IN event (this is what the SDK usually triggers)
                const listener = supabase.auth.onAuthStateChange((event, newSession) => {
                    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession) {
                        cleanHash()
                        router.replace('/orders')
                    }
                })
                subscription = listener.data.subscription

                // 4. Final fallback: if nothing happens after 5 seconds, try one last check
                timeoutId = setTimeout(async () => {
                    const { data: { session: finalCheck } } = await supabase.auth.getSession()
                    if (finalCheck) {
                        cleanHash()
                        router.replace('/orders')
                    } else {
                        setError("We couldn't establish your session. This might happen if the link is expired or used already.")
                    }
                }, 5000)
            } catch (err: any) {
                console.error('Callback error:', err)
                setError(err.message || 'Authentication failed. Please try again.')
            }
        }

        handleCallback()

        return () => {
            subscription?.unsubscribe()
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [router, supabase])

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f7f2', color: '#1a1a1a', fontFamily: 'var(--font-baskerville)' }}>
                <p style={{ color: '#ff4b4b', marginBottom: '20px' }}>{error}</p>
                <button onClick={() => router.push('/auth')} style={{ background: '#d4af37', border: 'none', padding: '12px 32px', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>
                    Back to Login
                </button>
            </div>
        )
    }

    return <PremiumLoader iconName="sparkles" text="Securing your session..." />
}
