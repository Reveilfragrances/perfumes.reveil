import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validators'

/**
 * Admin "Accept Order" endpoint.
 *
 * Two-factor-style guard between order placement and Shiprocket dispatch:
 *   1. Customer places order  → status = 'pending'
 *   2. Admin clicks Accept    → status = 'confirmed'   (this endpoint)
 *   3. Admin clicks Fulfill   → Shiprocket push + AWB  (existing flow)
 *
 * Only allowed for orders currently in 'pending' state — prevents an admin
 * from accidentally bouncing a shipped order back to confirmed.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Read current status so we can validate the transition.
  const { data: existing, error: readErr } = await admin
    .from('orders')
    .select('id, status, shiprocket_order_id')
    .eq('id', id)
    .single()

  if (readErr || !existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Don't downgrade orders that are already past the confirmed stage.
  const blocked = ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']
  if (blocked.includes(String(existing.status).toLowerCase())) {
    return NextResponse.json(
      { error: `Order is already ${existing.status}. Accept is not applicable.` },
      { status: 409 },
    )
  }

  // Idempotent: if already confirmed, just return success.
  if (existing.status === 'confirmed') {
    return NextResponse.json({ success: true, alreadyAccepted: true })
  }

  const { error: updateErr } = await admin
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', id)

  if (updateErr) {
    console.error('[accept order] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Could not accept order', reason: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
