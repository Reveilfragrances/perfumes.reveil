/**
 * Shiprocket API Service
 * Handles authentication, order creation, and tracking.
 */

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

interface ShiprocketConfig {
    email?: string;
    password?: string;
}

export class ShiprocketService {
    private static token: string | null = null;
    private static tokenExpiry: number | null = null;

    /**
     * Authenticates with Shiprocket and returns a Bearer token.
     * Tokens are valid for 24 hours.
     */
    private static async getToken(): Promise<string> {
        // Return cached token if valid (with 5 min buffer)
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
            return this.token;
        }

        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

        if (!email || !password) {
            throw new Error('SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not configured in environment.');
        }

        const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Shiprocket Auth Failed: ${data.message || response.statusText}`);
        }

        this.token = data.token;
        // Shiprocket tokens typically last 10 days, but we refresh daily to be safe
        this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

        return this.token!;
    }

    /**
     * Creates a custom order in Shiprocket.
     * @param orderData Standard Shiprocket order object
     */
    static async createOrder(orderData: any) {
        const token = await this.getToken();

        const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Shiprocket Order Creation Error:', data);
            throw new Error(data.message || 'Failed to create Shiprocket order');
        }

        return data;
    }

    /**
     * Fetches tracking information using an AWB number.
     */
    static async getTracking(awbNumber: string) {
        const token = await this.getToken();

        const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${awbNumber}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch tracking info');
        }

        return data;
    }

    /**
     * Checks serviceability for a pincode.
     */
    static async checkServiceability(pincode: string, weight: number = 0.5) {
        const token = await this.getToken();

        const response = await fetch(
            `${SHIPROCKET_API_BASE}/courier/serviceability?delivery_postcode=${pincode}&weight=${weight}&cod=1`,
            {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        return await response.json();
    }
}

/**
 * Cached token shared by `shiprocketFetch`. Shiprocket tokens are valid for ~10 days;
 * we refresh after 9 to be safe. Reusing the token avoids triggering their
 * "too many failed login attempts" lockout when the same account makes many calls.
 */
let cachedToken: string | null = null;
let cachedTokenExpiry: number | null = null;

async function getCachedToken(): Promise<string> {
    if (cachedToken && cachedTokenExpiry && Date.now() < cachedTokenExpiry) {
        return cachedToken;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
        throw new Error('Shiprocket credentials missing. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env.local and restart the server.');
    }

    const authRes = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    const authData = await authRes.json().catch(() => ({}));

    if (!authRes.ok || !authData?.token) {
        const reason = authData?.message || `HTTP ${authRes.status}`;
        throw new Error(`Shiprocket authentication failed: ${reason}`);
    }

    cachedToken = authData.token;
    cachedTokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; // 9 days
    return cachedToken!;
}

/**
 * Helper for authenticated Shiprocket requests. Reuses a cached token so we
 * don't re-login on every call. On non-2xx responses, logs the full body
 * (which contains the field-level reasons behind a generic "Invalid Data"
 * message) and attaches `errors` to the returned object so callers can
 * surface a usable error to the admin.
 */
export async function shiprocketFetch(endpoint: string, options: RequestInit = {}) {
    const token = await getCachedToken();

    const res = await fetch(`${SHIPROCKET_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (res.status === 401) {
        // Token may have been invalidated server-side — clear the cache so the
        // next call re-authenticates instead of repeatedly sending a bad token.
        cachedToken = null;
        cachedTokenExpiry = null;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // Shiprocket returns "Invalid Data" with a per-field `errors` object on
        // 422. Logging the whole body is the only way to see which field failed.
        console.error(`[shiprocket] ${endpoint} → ${res.status}`, JSON.stringify(data, null, 2));
    }

    return data;
}
