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
    if (typeof raw !== 'string' && typeof raw !== 'number') return null
    const trimmed = String(raw).trim()
    if (!trimmed || trimmed.length > 64) return null
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

// iCarry's exact webhook payload field names aren't published, so accept the
// common variants for each value. Returns the first present, sanitized AWB.
export function extractAwb(body: any): string | null {
    const candidate =
        body?.awb ?? body?.awb_number ?? body?.awb_no ?? body?.tracking_number ??
        body?.tracking_no ?? body?.waybill ?? body?.waybill_no
    return sanitizeAwb(candidate)
}

export function extractStatus(body: any): string {
    const s = body?.status ?? body?.current_status ?? body?.shipment_status ?? body?.status_name ?? 'unknown'
    return String(s).toLowerCase().slice(0, 40)
}

export function extractReason(body: any): string {
    const r = body?.reason ?? body?.ndr_reason ?? body?.remark ?? body?.remarks ?? body?.message ?? 'Delivery attempted, not delivered'
    return String(r).slice(0, 300)
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
