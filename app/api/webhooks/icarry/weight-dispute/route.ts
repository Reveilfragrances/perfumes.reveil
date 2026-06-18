import { verifyIcarryWebhook } from '@/lib/shipping/webhook-guard'

// iCarry weight-dispute webhook — logged for admin review.
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

    console.log('[iCarry Weight Dispute]', JSON.stringify(body))

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}
