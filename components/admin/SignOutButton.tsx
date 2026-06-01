'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
    const router = useRouter()
    const supabase = createClient()

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push('/admin@reveil/login')
        router.refresh()
    }
// Button of signout 
    return (
        <button
            onClick={handleSignOut}
            style={{
                marginTop: 'auto',
                padding: '10px 12px',
                borderRadius: '8px',
                color: '#ff4d4d',
                background: 'transparent',
                border: '1px solid #ff4d4d',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
                width: '100%',
                display: 'block'
            }}
        >
            Sign Out
        </button>
    )
}
