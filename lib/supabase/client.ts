import { createBrowserClient } from '@supabase/ssr'

// Placeholders used ONLY when env vars are absent (e.g. local `next build`
// without .env.local). They satisfy @supabase/ssr's "url + key required"
// guard so prerender completes; no real HTTP call happens during prerender.
// On Vercel the real values are present and override these.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Lazy singleton — only constructs the client on first property access.
// This prevents "Supabase URL/key required" errors at build time when env
// vars are only available on Vercel (no local .env.local).
let _client: ReturnType<typeof createBrowserClient> | null = null
export const supabase: ReturnType<typeof createBrowserClient> = new Proxy({} as any, {
  get(_target, prop, receiver) {
    if (!_client) _client = createClient()
    const value = Reflect.get(_client, prop, receiver)
    // Bind methods so `this` stays the real client (auth, from, channel, etc).
    return typeof value === 'function' ? value.bind(_client) : value
  },
})

