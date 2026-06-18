/**
 * iCarry.in Shipping Integration
 * API docs: https://www.icarry.in/shipping-api-plugins-extensions
 *
 * Kept entirely separate from the existing Shiprocket integration. The admin
 * chooses iCarry per-order from the order detail panel; the customer checkout
 * flow is unchanged. All functions throw on hard failures so the calling route
 * can surface a usable error to the admin.
 */

const ICARRY_BASE_URL = 'https://www.icarry.in/api'

// Token cache — iCarry tokens expire, so we cache with a timestamp.
let cachedToken: { token: string; expiresAt: number } | null = null

async function getIcarryToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token
    }

    const username = process.env.ICARRY_USERNAME
    const apiKey = process.env.ICARRY_API_KEY
    if (!username || !apiKey) {
        throw new Error('iCarry credentials missing. Set ICARRY_USERNAME and ICARRY_API_KEY in the environment.')
    }

    const res = await fetch(`${ICARRY_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, api_key: apiKey }),
    })

    if (!res.ok) {
        throw new Error(`iCarry login failed: ${res.status} ${await res.text()}`)
    }

    const data = await res.json()
    const token = data.token || data.auth_token || data.access_token
    if (!token) {
        throw new Error('iCarry login did not return a token')
    }

    cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 } // 50 minutes
    return token
}

async function icarryRequest(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
) {
    const token = await getIcarryToken()
    const res = await fetch(`${ICARRY_BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 401) {
        // Token may have been invalidated — clear cache so the next call re-auths.
        cachedToken = null
    }

    if (!res.ok) {
        throw new Error(`iCarry API error on ${path}: ${res.status} — ${JSON.stringify(data)}`)
    }

    return data
}

export async function checkIcarryServiceability(pincode: string) {
    return icarryRequest(`/serviceability?pincode=${encodeURIComponent(pincode)}`)
}

export async function getIcarryEstimate(params: {
    fromPincode: string
    toPincode: string
    weight: number
    length?: number
    breadth?: number
    height?: number
}) {
    return icarryRequest('/estimate/domestic', 'POST', {
        origin_pincode: params.fromPincode,
        destination_pincode: params.toPincode,
        weight: params.weight,
        length: params.length || 15,
        breadth: params.breadth || 10,
        height: params.height || 5,
    })
}

export async function bookIcarryShipment(order: {
    orderId: string
    customerName: string
    customerPhone: string
    shippingAddress: { line1: string; city: string; state: string; pincode: string }
    items: Array<{ name: string; quantity: number; price: number }>
    totalAmount: number
    paymentMethod: string
    weight?: number
}) {
    return icarryRequest('/shipment/book', 'POST', {
        order_id: order.orderId,
        pickup_address_id: process.env.ICARRY_PICKUP_ADDRESS_ID,
        delivery_name: order.customerName,
        delivery_address: order.shippingAddress.line1,
        delivery_city: order.shippingAddress.city,
        delivery_state: order.shippingAddress.state,
        delivery_pincode: order.shippingAddress.pincode,
        delivery_phone: order.customerPhone,
        weight: order.weight || 0.5,
        length: 15,
        breadth: 10,
        height: 5,
        cod_amount: order.paymentMethod === 'cod' ? order.totalAmount : 0,
        declared_value: order.totalAmount,
        items: order.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
    })
}

export async function trackIcarryShipment(awb: string) {
    return icarryRequest(`/track/${encodeURIComponent(awb)}`)
}

export async function cancelIcarryShipment(awb: string) {
    return icarryRequest('/shipment/cancel', 'POST', { awb })
}

export async function getIcarryLabel(awb: string) {
    return icarryRequest(`/label/${encodeURIComponent(awb)}`)
}
