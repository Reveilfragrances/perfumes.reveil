/**
 * GOOGLE SERVICE-ACCOUNT AUTH (no external SDK)
 *
 * Mints an OAuth2 access token for a Google service account using a self-signed
 * RS256 JWT (RFC 7523), then exchanges it at Google's token endpoint. We do this
 * with Node's built-in `crypto` + `fetch` instead of pulling in the heavy
 * `googleapis` package — it keeps the serverless bundle small and matches the
 * fetch-based style used elsewhere in this project.
 *
 * Credentials are read from either:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — the full service-account JSON (single line), OR
 *   GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY  — the two relevant fields only.
 *
 * Returns null (never throws) when credentials are absent so callers can no-op
 * gracefully in dev / unconfigured environments.
 */

import crypto from 'crypto'

type ServiceAccount = {
    client_email: string
    private_key: string
    token_uri?: string
}

function loadServiceAccount(): ServiceAccount | null {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (json) {
        try {
            const parsed = JSON.parse(json)
            if (parsed.client_email && parsed.private_key) {
                return {
                    client_email: parsed.client_email,
                    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
                    token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
                }
            }
        } catch (err) {
            console.error('[google-auth] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON:', (err as Error).message)
        }
    }

    const email = process.env.GOOGLE_CLIENT_EMAIL
    const key = process.env.GOOGLE_PRIVATE_KEY
    if (email && key) {
        return {
            client_email: email,
            private_key: key.replace(/\\n/g, '\n'),
            token_uri: 'https://oauth2.googleapis.com/token',
        }
    }

    return null
}

function base64url(input: Buffer | string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
}

// Cache one token per scope-set so repeated calls in the same lambda reuse it.
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getGoogleAccessToken(scopes: string[]): Promise<string | null> {
    const sa = loadServiceAccount()
    if (!sa) return null

    const scopeKey = scopes.slice().sort().join(' ')
    const cached = tokenCache.get(scopeKey)
    if (cached && Date.now() < cached.expiresAt) return cached.token

    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = base64url(
        JSON.stringify({
            iss: sa.client_email,
            scope: scopeKey,
            aud: sa.token_uri,
            iat: now,
            exp: now + 3600,
        })
    )
    const unsigned = `${header}.${claim}`

    let signature: string
    try {
        signature = base64url(
            crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key)
        )
    } catch (err) {
        console.error('[google-auth] Failed to sign JWT — check the private key formatting:', (err as Error).message)
        return null
    }

    const assertion = `${unsigned}.${signature}`

    try {
        const res = await fetch(sa.token_uri!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion,
            }),
        })
        const data = await res.json()
        if (!res.ok || !data.access_token) {
            console.error('[google-auth] Token exchange failed:', JSON.stringify(data))
            return null
        }
        const token = data.access_token as string
        const ttl = (Number(data.expires_in) || 3600) * 1000
        // Refresh 60s early to avoid using a token that expires mid-request.
        tokenCache.set(scopeKey, { token, expiresAt: Date.now() + ttl - 60_000 })
        return token
    } catch (err) {
        console.error('[google-auth] Token request error:', (err as Error).message)
        return null
    }
}
