import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public read of active, non-expired coupons for the homepage marquee.
// Client is created per-request (lazy) so the route module imports cleanly
// during build page-data collection even before env is available.
export async function GET() {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
        .from('coupons')
        .select('code, type, value, minimum_order_amount, description')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })

    // Marquee is non-critical — on any error just return an empty list.
    if (error) return NextResponse.json([], { status: 200 })

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=60' },
    })
}
