/**
 * Shared guards for the public iCarry webhook endpoints.
 *
 *  - sanitizeAwb: AWB / tracking numbers are alphanumeric (with - and _). Any
 *    other character is rejected. This is critical because the AWB is
 *    interpolated into a PostgREST `.or()` filter string — unsanitized input
 *    would allow filter injection (e.g. broadening an UPDATE to all orders).
 *
 *  - verifyIcarryWebhook: when ICARRY_WEBHOOK_SECRET is configured, require a
 *    matching `x-icarry-secret` header so only iCarry can post status updates.
 *    When it is not configured the webhook stays open (works out of the box)
 *    but can be locked down later by setting the env var.
 */

export function sanitizeAwb(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length > 64) return null
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

export function verifyIcarryWebhook(req: Request): boolean {
    const secret = process.env.ICARRY_WEBHOOK_SECRET
    if (!secret) return true // not configured — leave open
    const provided = req.headers.get('x-icarry-secret') || ''
    // Constant-time-ish comparison: lengths first, then char-by-char.
    if (provided.length !== secret.length) return false
    let mismatch = 0
    for (let i = 0; i < secret.length; i++) {
        mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i)
    }
    return mismatch === 0
}
