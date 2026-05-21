import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clampString, isEmail, normalizeIndianPhone } from '@/lib/validators'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { sendContactInquiryEmail } from '@/lib/utils/email'

const ADMIN_RECIPIENT = 'reveilfragrances@gmail.com'

export async function POST(req: Request) {
    try {
        let body: any
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const name = clampString(body?.name, 80)
        const message = clampString(body?.message, 4000)
        if (!name || !message || !isEmail(body?.email)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
        const email = (body.email as string).toLowerCase()

        let phone: string | null = null
        if (body?.phone) {
            const digits = normalizeIndianPhone(body.phone)
            if (!digits) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
            phone = `+91${digits}`
        }

        const ip = getClientIp(req)
        const captchaOk = await verifyTurnstile(
            typeof body?.captchaToken === 'string' ? body.captchaToken : undefined,
            ip
        )
        if (!captchaOk) {
            return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 })
        }
        const rl = await rateLimit({ key: `contact:ip:${ip}`, limit: 5, windowSec: 3600 })
        if (!rl.ok) return rateLimitResponse(rl)

        const supabase = await createClient()
        const { error: dbError } = await supabase
            .from('contact_inquiries')
            .insert([{
                name,
                email,
                phone,
                message,
                admin_recipient: ADMIN_RECIPIENT,
                is_read: false,
                created_at: new Date().toISOString(),
            }])

        if (dbError) {
            console.error('[contact] DB error:', dbError.message)
            // Still try to email the admin — losing the DB row is bad but the
            // operator will at least see the inquiry in their inbox.
            sendContactInquiryEmail({ name, email, phone, message }).catch((e) =>
                console.error('[contact] email fallback failed:', e?.message),
            )
            return NextResponse.json({ error: 'Could not save inquiry to database', reason: dbError.message }, { status: 500 })
        }

        // Fire-and-forget the admin notification email. We don't block the
        // success response on it — even if Resend is misconfigured the inquiry
        // is safely persisted in the contact_inquiries table.
        sendContactInquiryEmail({ name, email, phone, message }).catch((e) =>
            console.error('[contact] admin email failed (non-fatal):', e?.message),
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[contact] API Error:', error?.message)
        return NextResponse.json({ error: 'Internal Server Error', reason: error?.message }, { status: 500 })
    }
}
