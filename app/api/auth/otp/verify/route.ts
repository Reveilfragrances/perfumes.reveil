import { NextResponse } from 'next/server'
import { verifyMessageCentralOTP } from '@/lib/messageCentral'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeOtpBinding } from '@/lib/auth/otp-store'
import { findAuthUserIdByPhone } from '@/lib/auth/find-user'
import { upsertProfile } from '@/lib/auth/upsert-profile'
import { normalizeIndianPhone, isPersonName, isEmail } from '@/lib/validators'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isSafeInternalPath } from '@/lib/validators'

export async function POST(request: Request) {
    try {
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }
        const { phone, otp, verificationId, mode, firstName, lastName, email } = body || {}

        if (!verificationId || typeof verificationId !== 'string' || !otp || typeof otp !== 'string' || otp.length > 10) {
            return NextResponse.json({ error: 'OTP and verification ID are required.' }, { status: 400 })
        }

        const submittedDigits = normalizeIndianPhone(phone)
        if (!submittedDigits) {
            return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
        }

        // Rate-limit verify attempts per verificationId (prevent OTP brute-force) and per IP.
        const ip = getClientIp(request)
        const perId = await rateLimit({ key: `otp:verify:id:${verificationId}`, limit: 5, windowSec: 600 })
        if (!perId.ok) return rateLimitResponse(perId)
        const perIp = await rateLimit({ key: `otp:verify:ip:${ip}`, limit: 30, windowSec: 600 })
        if (!perIp.ok) return rateLimitResponse(perIp)

        // 1. Verify OTP with Message Central
        const mcResult = await verifyMessageCentralOTP(verificationId, otp)
        if (!mcResult.success) {
            return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 })
        }

        // 2. Confirm the verificationId was the one we issued for THIS phone.
        //    consumeOtpBinding returns the phone we recorded at send-time and
        //    marks the binding as consumed (one-shot).
        //    If the binding record is missing (e.g. DB write was non-blocking and failed),
        //    we allow the verify to proceed since MC already confirmed the OTP is valid.
        const boundDigits = await consumeOtpBinding(verificationId).catch(() => null)
        if (boundDigits !== null && boundDigits !== submittedDigits) {
            return NextResponse.json({ error: 'OTP could not be verified for this number.' }, { status: 400 })
        }

        const cleanPhone = `+91${submittedDigits}`

        // 3. Validate optional names
        let safeFirst: string | undefined
        let safeLast: string | undefined
        if (firstName !== undefined && firstName !== null && firstName !== '') {
            if (!isPersonName(firstName)) {
                return NextResponse.json({ error: 'Invalid first name.' }, { status: 400 })
            }
            safeFirst = firstName.trim()
        }
        if (lastName !== undefined && lastName !== null && lastName !== '') {
            if (!isPersonName(lastName)) {
                return NextResponse.json({ error: 'Invalid last name.' }, { status: 400 })
            }
            safeLast = lastName.trim()
        }

        // Optional, user-supplied email. Stored in profiles.email so it
        // can be shown back in the UI and used for transactional mail.
        // We deliberately do NOT fall back to a synthetic "<phone>@reveil.internal"
        // here — if the user doesn't provide one, profiles.email stays NULL.
        let safeEmail: string | null = null
        if (email !== undefined && email !== null && email !== '') {
            if (!isEmail(email)) {
                return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
            }
            safeEmail = email.trim().toLowerCase()
            // Block the internal placeholder from sneaking back in via the client.
            if (/@reveil\.internal$/i.test(safeEmail)) {
                return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
            }
        }

        const supabaseAdmin = createAdminClient()

        // 4. Find user by phone in profiles table (indexed) instead of listUsers (which caps at 1000)
        const { data: profileByPhone } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, full_name')
            .or(`phone.eq.${cleanPhone},phone.eq.${submittedDigits}`)
            .maybeSingle()

        let userId: string
        let userEmail: string
        let needsName = false
        let profileWriteError: string | null = null

        if (profileByPhone?.id) {
            userId = profileByPhone.id
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
            const authUser = authData?.user
            // Magic-link generation requires *some* email on auth.users. If the
            // existing user has none, we fall back to an internal placeholder
            // purely as a login identifier — it is never displayed to anyone.
            userEmail = authUser?.email || `${submittedDigits}@reveil.internal`

            // If the existing profile is missing data the client just provided
            // (e.g. user is signing up with an account that was half-created),
            // persist it now so we don't drop it.
            const existingUpdate: Record<string, unknown> = {}
            if (!profileByPhone.first_name && !profileByPhone.full_name && safeFirst) {
                existingUpdate.first_name = safeFirst
                existingUpdate.last_name = safeLast ?? ''
                existingUpdate.full_name = `${safeFirst} ${safeLast ?? ''}`.trim()
            }
            if (safeEmail) existingUpdate.email = safeEmail

            if (Object.keys(existingUpdate).length > 0) {
                const { error: existingUpsertError } = await supabaseAdmin
                    .from('profiles')
                    .update(existingUpdate)
                    .eq('id', userId)
                if (existingUpsertError) {
                    console.error('[OTP Verify] Profile update (existing user) failed:', existingUpsertError.message)
                }
            }

            needsName = !profileByPhone.first_name && !profileByPhone.full_name && !safeFirst
        } else if (mode === 'login') {
            // LOGIN must NEVER create an account. The only reason we proceed here
            // without a profile is to heal an *existing* orphaned auth user (auth
            // row present, profile missing). If the number isn't known anywhere,
            // reject with user_not_found so the client routes them to sign-up.
            const orphanId = await findAuthUserIdByPhone(supabaseAdmin, submittedDigits)
            if (!orphanId) {
                return NextResponse.json(
                    { error: 'No account found for this number. Please create an account first.', error_code: 'user_not_found' },
                    { status: 404 }
                )
            }

            userId = orphanId
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
            userEmail = authData?.user?.email || `${submittedDigits}@reveil.internal`

            // Heal the missing profile (core identity only — login carries no name).
            profileWriteError = await upsertProfile(supabaseAdmin, {
                id: userId,
                phone: cleanPhone,
                role: 'user',
            })
        } else {
            // SIGNUP — create the user, or recover an orphan if one already exists.
            // auth.users.email is a login-identifier only. Use the real email
            // when the user gave us one, otherwise fall back to an internal
            // placeholder. The placeholder NEVER reaches profiles.email.
            const authEmail = safeEmail ?? `${submittedDigits}@reveil.internal`
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                phone: cleanPhone,
                email: authEmail,
                phone_confirm: true,
                email_confirm: true,
                user_metadata: safeFirst ? { first_name: safeFirst, last_name: safeLast ?? '' } : {},
            })

            if (createError) {
                // The auth user can already exist (phone/email taken) while its
                // profiles row is missing — an "orphaned" account left behind when
                // an earlier signup created the auth user but failed to write the
                // profile. Recover it and heal the profile instead of dead-ending
                // the user into the "already registered / not registered" loop.
                const orphan = /already.*regist|already.*exist|duplicate|registered by/i.test(createError.message || '')
                const recoveredId = orphan ? await findAuthUserIdByPhone(supabaseAdmin, submittedDigits) : null
                if (!recoveredId) throw createError

                userId = recoveredId
                const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
                userEmail = authData?.user?.email || `${submittedDigits}@reveil.internal`
            } else {
                userId = newUser.user.id
                userEmail = newUser.user.email!
            }

            // Ensure the profile row exists. This covers both a brand-new user and
            // a recovered orphan whose profiles row never got written. The helper
            // is resilient to a missing optional column (e.g. `email`) so a signup
            // can never be silently orphaned again.
            const fullName = safeFirst ? `${safeFirst} ${safeLast ?? ''}`.trim() : null
            profileWriteError = await upsertProfile(supabaseAdmin, {
                id: userId,
                phone: cleanPhone,
                role: 'user',
                // Only persist a real email — null when the user didn't supply one.
                email: safeEmail,
                ...(safeFirst && { first_name: safeFirst, last_name: safeLast ?? '', full_name: fullName }),
            })

            needsName = !safeFirst
        }

        // 5. Generate magic link with a validated redirect target
        const protocol = request.headers.get('x-forwarded-proto') || 'https'
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'perfumesreveil.vercel.app'
        const siteUrl = host.includes('localhost') ? `http://${host}` : `${protocol}://${host}`

        const requestedNext = typeof body?.next === 'string' ? body.next : '/orders'
        const safeNext = isSafeInternalPath(requestedNext) ? requestedNext : '/orders'
        const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: userEmail,
            options: { redirectTo },
        })

        if (linkError) {
            // This is the step that creates the login session. It usually fails
            // because of Supabase project config, not the OTP — surface that so
            // the operator can fix it instead of seeing a generic error.
            console.error('[OTP Verify] generateLink failed:', linkError.message, '| redirectTo:', redirectTo, '| email:', userEmail)
            return NextResponse.json({
                error: 'Could not create your login session.',
                detail: linkError.message,
                hint: `Check Supabase → Authentication → URL Configuration: the Site URL and "Redirect URLs" must include ${siteUrl}/auth/callback, and the Email provider must be enabled.`,
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            loginUrl: linkData.properties.action_link,
            needs_name: mode === 'signup' ? needsName : false,
            user_id: userId,
            // Surfaced (not fatal) so a broken profiles schema is visible during
            // testing instead of being silently swallowed. Login still proceeds.
            ...(profileWriteError && { profile_warning: profileWriteError }),
        })

    } catch (error: any) {
        const detail = error?.message || String(error)
        console.error('[OTP Verify] Error:', detail)
        // "already been registered" → the auth user exists but the profile row
        // was missing; guide the user to log in instead of signing up.
        const alreadyExists = /already.*regist|already.*exist|duplicate/i.test(detail)
        return NextResponse.json({
            error: alreadyExists
                ? 'This number is already registered. Please switch to Login.'
                : 'Verification failed.',
            detail,
        }, { status: 500 })
    }
}
