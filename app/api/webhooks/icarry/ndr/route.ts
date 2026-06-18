import { createAdminClient } from '@/lib/supabase/admin'
import { extractAwb, extractReason, verifyIcarryWebhook } from '@/lib/shipping/webhook-guard'

// iCarry NDR (non-delivery report) webhook — flags the order for admin review.
export async function POST(req: Request) {
    if (!verifyIcarryWebhook(req)) {
        return new Response('Unauthorized', { status: 401 })
    }

    let body: any
    try {
        body = await req.json()
    } catch {
        return new Response('Invalid JSON', { status: 400 })
    }

    // AWB is interpolated into a PostgREST filter — sanitize to prevent injection.
    const awb = extractAwb(body)
    if (!awb) return new Response('Missing or invalid awb', { status: 400 })

    const reason = extractReason(body)

    const supabase = createAdminClient()
    await supabase
        .from('orders')
        .update({
            shipping_status: 'ndr',
            manual_delivery_note: `NDR: ${reason}`,
        })
        .or(`icarry_awb.eq.${awb},shipping_awb.eq.${awb}`)

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}
