/**
 * POST /api/admin/sync-merchant
 *
 * One-time (or periodic) bulk push of ALL active products to Google Merchant Center.
 * Call this once after deploying to ensure your full catalogue is in Merchant Center.
 *
 * Admin-only endpoint — protected by requireAdmin middleware.
 */
import { bulkSyncAllProducts } from '@/lib/google-sync'
import { requireAdmin } from '@/lib/auth/require'
import { NextResponse } from 'next/server'

export async function POST() {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    try {
        await bulkSyncAllProducts()
        return NextResponse.json({ success: true, message: 'Bulk sync triggered — check server logs for progress.' })
    } catch (err: unknown) {
        console.error('[sync-merchant]', err)
        return NextResponse.json(
            { success: false, error: (err as Error).message },
            { status: 500 }
        )
    }
}
