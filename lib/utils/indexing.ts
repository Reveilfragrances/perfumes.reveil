/**
 * GOOGLE INDEXING API UTILITY
 *
 * Notifies Google that a product URL was created/updated/deleted so it gets
 * (re)crawled quickly. Authenticates with a service account via lib/google/auth.
 *
 * Configure ONE of the following in the environment:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full service-account JSON (single line), OR
 *   GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 *
 * The service-account email must be added as an "Owner" in Google Search Console.
 * When no credentials are present this no-ops (logs a mock line) so product
 * create/update/delete never breaks in dev.
 */

import { getGoogleAccessToken } from '@/lib/google/auth'

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing'

export async function notifyGoogleOfChange(url: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED') {
    const token = await getGoogleAccessToken([INDEXING_SCOPE])
    if (!token) {
        console.log(`[INDEXING_API_MOCK] Notify Google of ${type}: ${url}`)
        return { success: true, mocked: true }
    }

    try {
        const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url, type }),
        })

        if (!res.ok) {
            const body = await res.text().catch(() => '')
            console.error(`[INDEXING_API] ${type} failed for ${url}: ${res.status} ${body}`)
            return { success: false, status: res.status }
        }

        return { success: true }
    } catch (error) {
        console.error('Indexing API Error:', error)
        return { success: false, error }
    }
}
