import { Resend } from 'resend';
import { SITE_URL } from '@/lib/seo/keywords';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Bare host (no protocol) for display text in email footers/links.
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

// Sender address used for all transactional emails. Falls back to Resend's
// sandbox sender so emails still deliver while you're verifying the domain.
const FROM_ADDRESS = process.env.RESEND_FROM || 'Reveil Fragrance <onboarding@resend.dev>';
const FROM_SECURITY = process.env.RESEND_FROM_SECURITY || FROM_ADDRESS;

export async function sendOrderDeliveredEmail(order: any, userEmail: string) {
    const { id, total, order_items, profiles } = order;
    const customerName = profiles?.full_name || 'Valued Customer';
    
    // Fallback if no Resend key is configured
    if (!resend) {
        console.log('--- MOCK EMAIL START ---');
        console.log(`To: ${userEmail}`);
        console.log(`Subject: REVEIL | Order Delivered & E-Invoice [${id.slice(0, 8)}]`);
        console.log(`Content: Your olfactory journey has arrived. Total: ₹${total}`);
        console.log('--- MOCK EMAIL END ---');
        return { success: true, mocked: true };
    }

    try {
        const itemsHtml = order_items.map((item: any) => `
            <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #222;">
                    <p style="margin: 0; color: #fff; font-size: 14px;">${item.products.name}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Qty: ${item.quantity}</p>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #222; text-align: right; color: #d4af37;">
                    ₹${item.price.toLocaleString()}
                </td>
            </tr>
        `).join('');

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: userEmail || 'reveilfragrances@gmail.com', // Using provided address as fallback
            subject: `REVEIL | Order Delivered & E-Invoice [${id.slice(0, 8).toUpperCase()}]`,
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Georgia', serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.2em; text-transform: uppercase; margin: 0; font-size: 24px;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.4em; margin-top: 10px; text-transform: uppercase;">Studio Archive</p>
                    </div>

                    <div style="margin-bottom: 40px;">
                        <h2 style="font-weight: 300; font-size: 20px; border-bottom: 1px solid #d4af37; padding-bottom: 10px; color: #fff;">E-INVOICE</h2>
                        <p style="color: #888; font-size: 13px; line-height: 1.6;">
                            Dear ${customerName},<br><br>
                            Your olfactory journey has reached its destination. We are pleased to confirm that your order has been delivered. Below are the details of your archive acquisition.
                        </p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                        <thead>
                            <tr>
                                <th style="text-align: left; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; padding-bottom: 10px;">Item</th>
                                <th style="text-align: right; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; padding-bottom: 10px;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="padding: 20px 0; color: #888; font-size: 14px;">Total Archive Value</td>
                                <td style="padding: 20px 0; text-align: right; color: #d4af37; font-size: 18px; font-weight: bold;">₹${total.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div style="background: #111; padding: 20px; border-radius: 2px; margin-bottom: 40px;">
                        <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px;">Reference ID</p>
                        <p style="color: #fff; font-size: 13px; margin: 0; font-family: monospace;">${id.toUpperCase()}</p>
                    </div>

                    <div style="text-align: center; color: #444; font-size: 11px; font-style: italic;">
                        <p>Thank you for choosing REVEIL. <br> May your presence be unforgettable.</p>
                        <div style="width: 40px; height: 1px; background: #d4af37; margin: 20px auto; opacity: 0.3;"></div>
                        <p style="letter-spacing: 0.2em; text-transform: uppercase;">${SITE_HOST}</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error('Resend Error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error('Email Dispatch Error:', err);
        return { success: false, error: err };
    }
}

export async function sendOrderConfirmationEmail(order: any, userEmail: string) {
    const { id, total, order_items, profiles } = order;
    const customerName = profiles?.full_name || 'Valued Customer';
    
    if (!resend) {
        console.log('--- MOCK ORDER CONFIRMATION START ---');
        console.log(`To: ${userEmail}`);
        console.log(`Subject: REVEIL | Order Confirmed [${id.slice(0, 8)}]`);
        return { success: true, mocked: true };
    }

    try {
        const itemsHtml = order_items.map((item: any) => `
            <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #1a1a1a;">
                    <p style="margin: 0; color: #fff; font-size: 14px; font-weight: 500;">${item.products.name}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Quantity: ${item.quantity}</p>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #1a1a1a; text-align: right; color: #d4af37; font-weight: 500;">
                    ₹${item.price.toLocaleString()}
                </td>
            </tr>
        `).join('');

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: userEmail,
            subject: `REVEIL | Order Confirmed [${id.slice(0, 8).toUpperCase()}]`,
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Baskerville', 'Georgia', serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a;">
                    <div style="text-align: center; margin-bottom: 50px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; margin: 0; font-size: 28px;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.5em; margin-top: 12px; text-transform: uppercase;">The Art of Presence</p>
                    </div>

                    <div style="margin-bottom: 40px; text-align: center;">
                        <h2 style="font-weight: 300; font-size: 22px; color: #fff; text-transform: uppercase; letter-spacing: 0.1em;">Order Confirmed</h2>
                        <div style="width: 30px; height: 1px; background: #d4af37; margin: 15px auto;"></div>
                        <p style="color: #888; font-size: 14px; line-height: 1.8; margin-top: 20px;">
                            Dear ${customerName},<br><br>
                            Thank you for your acquisition from the REVEIL Archive. Your order has been successfully placed and is now being prepared by our laboratory.
                        </p>
                    </div>

                    <div style="background: #0a0a0a; border: 1px solid #1a1a1a; padding: 25px; margin-bottom: 40px;">
                        <h3 style="color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 20px; font-weight: 400;">Your Selection</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 25px 0 0; color: #888; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Grand Total</td>
                                    <td style="padding: 25px 0 0; text-align: right; color: #d4af37; font-size: 20px; font-weight: 600;">₹${total.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div style="margin-bottom: 40px;">
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <div style="flex: 1;">
                                <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Order Reference</p>
                                <p style="color: #fff; font-size: 12px; margin: 0; font-family: monospace;">#${id.toUpperCase().slice(0, 12)}</p>
                            </div>
                            <div style="flex: 1; text-align: right;">
                                <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Status</p>
                                <p style="color: #d4af37; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">Processing</p>
                            </div>
                        </div>
                    </div>

                    <div style="text-align: center; border-top: 1px solid #1a1a1a; padding-top: 40px; color: #444; font-size: 11px;">
                        <p style="margin-bottom: 15px;">Our artisans are now preparing your selection for transit.</p>
                        <p>Questions about your order? Reply to this email or visit our <a href="${SITE_URL}/track" style="color: #d4af37; text-decoration: none;">tracking portal</a>.</p>
                        <div style="margin-top: 30px;">
                            <p style="letter-spacing: 0.3em; text-transform: uppercase; color: #666;">${SITE_HOST}</p>
                        </div>
                    </div>
                </div>
            `
        });

        return { success: !error, data, error };
    } catch (err) {
        return { success: false, error: err };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// ORDER FULFILLED / SHIPPED EMAIL
// Sent automatically when admin clicks "Fulfill" in the admin panel. Includes
// tracking info, payment summary, item list, and a one-tap track button.
// ────────────────────────────────────────────────────────────────────────────
export async function sendOrderFulfilledEmail(order: any, userEmail: string) {
    const {
        id,
        total,
        order_items,
        profiles,
        payment_method,
        payment_status,
        awb_code,
        courier_name,
        shipping_address,
    } = order
    const customerName = profiles?.full_name || 'Valued Customer'
    const trackUrl = awb_code
        ? `${SITE_URL}/track/${awb_code}`
        : `${SITE_URL}/orders`
    const paymentLabel = payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'
    const paymentStatusLabel = payment_status === 'paid' ? 'PAID' : (payment_method === 'cod' ? 'COD — Pay on Delivery' : 'Pending')
    const addr = shipping_address || {}

    if (!resend) {
        console.log('--- MOCK FULFILLMENT EMAIL ---')
        console.log(`To: ${userEmail}`)
        console.log(`Subject: REVEIL | Your order is on its way [${id.slice(0, 8)}]`)
        console.log(`AWB: ${awb_code || 'pending'} | Courier: ${courier_name || 'pending'}`)
        return { success: true, mocked: true }
    }

    try {
        const itemsHtml = (order_items || []).map((item: any) => `
            <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                    <p style="margin: 0; color: #fff; font-size: 14px; font-weight: 500;">${item.products?.name || 'Item'}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Qty: ${item.quantity}</p>
                </td>
                <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a; text-align: right; color: #d4af37; font-weight: 600;">
                    ₹${(item.price ?? 0).toLocaleString()}
                </td>
            </tr>
        `).join('')

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: userEmail,
            subject: `REVEIL | Your order is on its way 📦 [${id.slice(0, 8).toUpperCase()}]`,
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Baskerville', 'Georgia', serif; padding: 40px; max-width: 620px; margin: 0 auto; border: 1px solid #1a1a1a;">

                    <!-- Brand header -->
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; margin: 0; font-size: 28px;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.5em; margin-top: 12px; text-transform: uppercase;">Fragrance House</p>
                    </div>

                    <!-- Headline -->
                    <div style="margin-bottom: 36px; text-align: center;">
                        <h2 style="font-weight: 300; font-size: 24px; color: #fff; text-transform: uppercase; letter-spacing: 0.15em; margin: 0;">Your Order Has Shipped</h2>
                        <div style="width: 40px; height: 1px; background: #d4af37; margin: 18px auto;"></div>
                        <p style="color: #aaa; font-size: 14px; line-height: 1.8; margin: 18px 0 0;">
                            Dear ${customerName},<br><br>
                            Wonderful news — your Reveil order has been dispatched and is now in transit. Below are your tracking and order details.
                        </p>
                    </div>

                    <!-- Tracking block (hero CTA) -->
                    <div style="background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%); padding: 28px; border-radius: 4px; margin-bottom: 32px; text-align: center;">
                        <p style="margin: 0 0 8px; color: rgba(0,0,0,0.6); font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700;">Tracking Number</p>
                        <p style="margin: 0 0 20px; color: #050505; font-size: 22px; font-weight: 700; font-family: monospace; letter-spacing: 0.05em;">${awb_code || 'Being assigned…'}</p>
                        ${courier_name ? `<p style="margin: 0 0 18px; color: rgba(0,0,0,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 600;">via ${courier_name}</p>` : ''}
                        <a href="${trackUrl}" style="display: inline-block; background: #050505; color: #d4af37; text-decoration: none; padding: 14px 36px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.25em; border-radius: 2px;">Track My Order →</a>
                    </div>

                    <!-- Order summary -->
                    <div style="background: #0a0a0a; border: 1px solid #1a1a1a; padding: 28px; margin-bottom: 28px;">
                        <h3 style="color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 22px; font-weight: 600;">Your Selection</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 22px 0 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600;">Total</td>
                                    <td style="padding: 22px 0 0; text-align: right; color: #d4af37; font-size: 22px; font-weight: 700;">₹${(total ?? 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Payment + Order info row -->
                    <div style="display: table; width: 100%; margin-bottom: 28px;">
                        <div style="display: table-row;">
                            <div style="display: table-cell; width: 50%; background: #0a0a0a; border: 1px solid #1a1a1a; padding: 20px; vertical-align: top;">
                                <p style="color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 8px; font-weight: 700;">Order Reference</p>
                                <p style="color: #fff; font-size: 13px; margin: 0; font-family: monospace;">#${id.toUpperCase().slice(0, 12)}</p>
                            </div>
                            <div style="display: table-cell; width: 8px;"></div>
                            <div style="display: table-cell; width: 50%; background: #0a0a0a; border: 1px solid #1a1a1a; padding: 20px; vertical-align: top;">
                                <p style="color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 8px; font-weight: 700;">Payment</p>
                                <p style="color: #fff; font-size: 13px; margin: 0 0 4px;">${paymentLabel}</p>
                                <p style="color: ${payment_status === 'paid' ? '#10b981' : '#d4af37'}; font-size: 11px; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">${paymentStatusLabel}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Delivery address -->
                    ${addr.full_name ? `
                    <div style="background: #0a0a0a; border: 1px solid #1a1a1a; padding: 20px; margin-bottom: 28px;">
                        <p style="color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 10px; font-weight: 700;">Shipping To</p>
                        <p style="color: #fff; font-size: 14px; margin: 0 0 4px; font-weight: 500;">${addr.full_name}</p>
                        <p style="color: #aaa; font-size: 12px; margin: 0; line-height: 1.6;">
                            ${addr.address_line1 || ''}${addr.address_line2 ? ', ' + addr.address_line2 : ''}<br>
                            ${addr.city || ''}, ${addr.state || ''} — ${addr.pincode || ''}<br>
                            ${addr.phone ? '📞 ' + addr.phone : ''}
                        </p>
                    </div>
                    ` : ''}

                    <!-- Expected delivery -->
                    <div style="text-align: center; padding: 18px; background: rgba(212,175,55,0.05); border: 1px dashed rgba(212,175,55,0.3); margin-bottom: 32px;">
                        <p style="color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 6px; font-weight: 700;">Expected Delivery</p>
                        <p style="color: #fff; font-size: 14px; margin: 0;">3 – 7 business days</p>
                    </div>

                    <!-- Footer -->
                    <div style="text-align: center; border-top: 1px solid #1a1a1a; padding-top: 32px; color: #555; font-size: 11px;">
                        <p style="margin: 0 0 14px; line-height: 1.7;">Questions about your delivery? Reply to this email or visit our <a href="${SITE_URL}/orders" style="color: #d4af37; text-decoration: none;">order portal</a>.</p>
                        <p style="margin: 0 0 24px; line-height: 1.7;">Thank you for choosing Reveil — may your presence be unforgettable.</p>
                        <p style="letter-spacing: 0.3em; text-transform: uppercase; color: #666; margin: 0;">${SITE_HOST}</p>
                    </div>
                </div>
            `
        })

        if (error) {
            console.error('[sendOrderFulfilledEmail] Resend error:', error)
            return { success: false, error }
        }
        return { success: true, data }
    } catch (err) {
        console.error('[sendOrderFulfilledEmail] Dispatch error:', err)
        return { success: false, error: err }
    }
}

/**
 * Fetch the order with all data needed and send the fulfillment email.
 * Called from /api/shiprocket/create-order after Shiprocket order creation.
 */
/**
 * Resolve a real email for a given user. Profiles.email is filled at signup
 * only when the user actually entered one — OTP-only signups store an
 * "<phone>@reveil.internal" placeholder. So we:
 *   1. Try profiles.email and strip placeholders via realEmail().
 *   2. Fall back to auth.users (the real auth record) for a usable email.
 * Returns null if no usable email exists.
 */
async function resolveUserEmail(userId: string, profileEmail: string | null | undefined): Promise<string | null> {
    const { realEmail } = await import('@/lib/validators')
    const fromProfile = realEmail(profileEmail)
    if (fromProfile) return fromProfile
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()
        const { data } = await admin.auth.admin.getUserById(userId)
        return realEmail(data?.user?.email)
    } catch (err) {
        console.error('[resolveUserEmail] auth lookup failed:', (err as any)?.message)
        return null
    }
}

export type EmailTriggerResult =
    | { ok: true; sent: true; mocked?: boolean }
    | { ok: false; sent: false; reason: string }

export async function triggerOrderFulfilledEmail(orderId: string): Promise<EmailTriggerResult> {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()

        const { data: order } = await admin
            .from('orders')
            .select(`
                id,
                user_id,
                total,
                payment_method,
                payment_status,
                awb_code,
                courier_name,
                shiprocket_order_id,
                shipping_address,
                profiles ( full_name, email ),
                order_items (
                    quantity,
                    price,
                    products ( name )
                )
            `)
            .eq('id', orderId)
            .single()

        if (!order) {
            console.error('[triggerOrderFulfilledEmail] Order not found:', orderId)
            return { ok: false, sent: false, reason: 'order_not_found' }
        }

        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
        const email = await resolveUserEmail(order.user_id, profile?.email)

        if (!email) {
            console.warn('[triggerOrderFulfilledEmail] No usable email for user — skipping send')
            return { ok: false, sent: false, reason: 'no_customer_email' }
        }

        if (!process.env.RESEND_API_KEY) {
            console.warn('[triggerOrderFulfilledEmail] RESEND_API_KEY missing — email mocked')
            return { ok: false, sent: false, reason: 'resend_not_configured' }
        }

        const normalizedOrder = { ...order, profiles: profile }
        const result = await sendOrderFulfilledEmail(normalizedOrder, email)
        if (!result.success) {
            return { ok: false, sent: false, reason: (result as any).error?.message || 'email_send_failed' }
        }
        return { ok: true, sent: true, mocked: (result as any).mocked }
    } catch (err: any) {
        console.error('[triggerOrderFulfilledEmail] Error:', err?.message || err)
        return { ok: false, sent: false, reason: err?.message || 'unknown_error' }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// OUT FOR DELIVERY EMAIL
// Triggered automatically from the Shiprocket webhook the moment courier
// scans "Out for Delivery". Quick, exciting, one-tap track CTA.
// ────────────────────────────────────────────────────────────────────────────
export async function sendOrderOutForDeliveryEmail(order: any, userEmail: string) {
    const { id, profiles, awb_code, courier_name } = order
    const customerName = profiles?.full_name || 'there'
    const trackUrl = awb_code
        ? `${SITE_URL}/track/${awb_code}`
        : `${SITE_URL}/orders`

    if (!resend) {
        console.log(`--- MOCK OFD EMAIL --- To: ${userEmail} | Order: ${id.slice(0, 8)}`)
        return { success: true, mocked: true }
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: userEmail,
            subject: `📦 Out for Delivery — your Reveil order arrives today!`,
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Baskerville', 'Georgia', serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a;">
                    <div style="text-align: center; margin-bottom: 36px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; margin: 0; font-size: 28px;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.5em; margin-top: 12px; text-transform: uppercase;">Fragrance House</p>
                    </div>
                    <div style="text-align: center; margin-bottom: 36px;">
                        <div style="font-size: 60px; margin-bottom: 8px;">🚚</div>
                        <h2 style="font-weight: 300; font-size: 26px; color: #fff; text-transform: uppercase; letter-spacing: 0.15em; margin: 0;">Out for Delivery</h2>
                        <div style="width: 40px; height: 1px; background: #d4af37; margin: 18px auto;"></div>
                        <p style="color: #aaa; font-size: 14px; line-height: 1.8; margin: 18px 24px 0;">
                            Hi ${customerName},<br><br>
                            Exciting news — your Reveil order is out for delivery and will arrive at your doorstep <strong style="color: #d4af37;">today</strong>. Please keep your phone handy.
                        </p>
                    </div>
                    <div style="background: linear-gradient(135deg,#d4af37 0%,#b8941f 100%); padding: 24px; border-radius: 4px; margin-bottom: 28px; text-align: center;">
                        ${courier_name ? `<p style="margin: 0 0 10px; color: rgba(0,0,0,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; font-weight: 700;">${courier_name}</p>` : ''}
                        <p style="margin: 0 0 18px; color: #050505; font-size: 18px; font-weight: 700; font-family: monospace; letter-spacing: 0.05em;">${awb_code || ''}</p>
                        <a href="${trackUrl}" style="display: inline-block; background: #050505; color: #d4af37; text-decoration: none; padding: 14px 36px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.25em; border-radius: 2px;">Track Live →</a>
                    </div>
                    <div style="background: rgba(212,175,55,0.05); border: 1px dashed rgba(212,175,55,0.3); padding: 18px; text-align: center; margin-bottom: 28px;">
                        <p style="color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; margin: 0 0 6px; font-weight: 700;">Order Reference</p>
                        <p style="color: #fff; font-size: 13px; margin: 0; font-family: monospace;">#${id.toUpperCase().slice(0, 12)}</p>
                    </div>
                    <div style="text-align: center; border-top: 1px solid #1a1a1a; padding-top: 28px; color: #555; font-size: 11px;">
                        <p style="margin: 0 0 14px;">Couldn't be home? Reply to this email and we'll coordinate.</p>
                        <p style="letter-spacing: 0.3em; text-transform: uppercase; color: #666; margin: 0;">${SITE_HOST}</p>
                    </div>
                </div>
            `
        })
        if (error) return { success: false, error }
        return { success: true, data }
    } catch (err) {
        return { success: false, error: err }
    }
}

/**
 * Look up the order by AWB and send the "out for delivery" email. Called
 * from the Shiprocket webhook when current_status becomes "Out For Delivery".
 */
export async function triggerOrderOutForDeliveryEmail(awbCode: string) {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()
        const { data: order } = await admin
            .from('orders')
            .select(`id, user_id, awb_code, courier_name, profiles ( full_name, email )`)
            .eq('awb_code', awbCode)
            .single()
        if (!order) return
        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
        const email = await resolveUserEmail(order.user_id, profile?.email)
        if (!email) return
        await sendOrderOutForDeliveryEmail({ ...order, profiles: profile }, email)
    } catch (err) {
        console.error('[triggerOrderOutForDeliveryEmail] Error:', err)
    }
}

/**
 * Look up order by AWB and send the existing "delivered" email + invoice.
 * Called from the Shiprocket webhook when current_status becomes "Delivered".
 */
export async function triggerOrderDeliveredEmail(awbCode: string) {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()
        const { data: order } = await admin
            .from('orders')
            .select(`
                id, total, user_id,
                profiles ( full_name, email ),
                order_items ( quantity, price, products ( name ) )
            `)
            .eq('awb_code', awbCode)
            .single()
        if (!order) return
        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
        const email = await resolveUserEmail(order.user_id, profile?.email)
        if (!email) return
        await sendOrderDeliveredEmail({ ...order, profiles: profile }, email)
    } catch (err) {
        console.error('[triggerOrderDeliveredEmail] Error:', err)
    }
}

export async function triggerOrderConfirmationEmail(orderId: string) {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        
        const { data: order } = await admin
            .from('orders')
            .select(`
                id,
                total,
                profiles ( full_name, email ),
                order_items (
                    quantity,
                    price,
                    products ( name )
                )
            `)
            .eq('id', orderId)
            .single();
        if (!order) return;
        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;

        if (profile?.email) {
            const normalizedOrder = { ...order, profiles: profile };
            await sendOrderConfirmationEmail(normalizedOrder, profile.email);
        }
    } catch (err) {
        console.error('[triggerOrderConfirmationEmail] Error:', err);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// ORDER CANCELLED EMAIL
// Sent when an admin cancels/rejects an order from the review flow. Informs the
// customer their order was cancelled and lists the affected order details.
// ────────────────────────────────────────────────────────────────────────────
export async function sendOrderCancellationEmail(order: any, userEmail: string) {
    const { id, total, order_items, profiles } = order
    const customerName = profiles?.full_name || 'Valued Customer'

    if (!resend) {
        console.log('--- MOCK ORDER CANCELLATION START ---')
        console.log(`To: ${userEmail}`)
        console.log(`Subject: REVEIL | Order Cancelled [${id.slice(0, 8)}]`)
        console.log('--- MOCK ORDER CANCELLATION END ---')
        return { success: true, mocked: true }
    }

    try {
        const itemsHtml = (order_items || []).map((item: any) => `
            <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #1a1a1a;">
                    <p style="margin: 0; color: #fff; font-size: 14px; font-weight: 500;">${item.products?.name || 'Item'}</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Quantity: ${item.quantity}</p>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #1a1a1a; text-align: right; color: #d4af37; font-weight: 500;">
                    ₹${(item.price ?? 0).toLocaleString()}
                </td>
            </tr>
        `).join('')

        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: userEmail,
            subject: `REVEIL | Order Cancelled [${id.slice(0, 8).toUpperCase()}]`,
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Baskerville', 'Georgia', serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1a;">
                    <div style="text-align: center; margin-bottom: 50px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; margin: 0; font-size: 28px;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.5em; margin-top: 12px; text-transform: uppercase;">The Art of Presence</p>
                    </div>

                    <div style="margin-bottom: 40px; text-align: center;">
                        <h2 style="font-weight: 300; font-size: 22px; color: #fff; text-transform: uppercase; letter-spacing: 0.1em;">Order Cancelled</h2>
                        <div style="width: 30px; height: 1px; background: #d4af37; margin: 15px auto;"></div>
                        <p style="color: #888; font-size: 14px; line-height: 1.8; margin-top: 20px;">
                            Dear ${customerName},<br><br>
                            We're sorry to inform you that, due to unforeseen circumstances, your order has been cancelled. If any payment was made, it will be refunded as per our policy. We sincerely apologise for the inconvenience.
                        </p>
                    </div>

                    <div style="background: #0a0a0a; border: 1px solid #1a1a1a; padding: 25px; margin-bottom: 40px;">
                        <h3 style="color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 20px; font-weight: 400;">Cancelled Order</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 25px 0 0; color: #888; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Order Total</td>
                                    <td style="padding: 25px 0 0; text-align: right; color: #d4af37; font-size: 20px; font-weight: 600;">₹${(total ?? 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div style="margin-bottom: 40px;">
                        <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Order Reference</p>
                        <p style="color: #fff; font-size: 12px; margin: 0; font-family: monospace;">#${id.toUpperCase().slice(0, 12)}</p>
                    </div>

                    <div style="text-align: center; border-top: 1px solid #1a1a1a; padding-top: 40px; color: #444; font-size: 11px;">
                        <p style="margin-bottom: 15px;">Questions about this cancellation? Reply to this email and we'll help.</p>
                        <div style="margin-top: 30px;">
                            <p style="letter-spacing: 0.3em; text-transform: uppercase; color: #666;">${SITE_HOST}</p>
                        </div>
                    </div>
                </div>
            `
        })

        if (error) {
            console.error('[sendOrderCancellationEmail] Resend error:', error)
            return { success: false, error }
        }
        return { success: true, data }
    } catch (err) {
        console.error('[sendOrderCancellationEmail] Dispatch error:', err)
        return { success: false, error: err }
    }
}

/**
 * Fetch the order + customer email and send the cancellation email. Called from
 * the admin cancel endpoint. Errors are logged, never thrown, so a failed email
 * never breaks the cancellation itself.
 */
export async function triggerOrderCancellationEmail(orderId: string): Promise<EmailTriggerResult> {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()

        const { data: order } = await admin
            .from('orders')
            .select(`
                id,
                total,
                user_id,
                profiles ( full_name, email ),
                order_items ( quantity, price, products ( name ) )
            `)
            .eq('id', orderId)
            .single()

        if (!order) {
            console.error('[triggerOrderCancellationEmail] Order not found:', orderId)
            return { ok: false, sent: false, reason: 'order_not_found' }
        }

        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
        const email = await resolveUserEmail(order.user_id, profile?.email)
        if (!email) {
            console.warn('[triggerOrderCancellationEmail] No usable email — skipping send')
            return { ok: false, sent: false, reason: 'no_customer_email' }
        }
        if (!process.env.RESEND_API_KEY) {
            console.warn('[triggerOrderCancellationEmail] RESEND_API_KEY missing — email mocked')
            return { ok: false, sent: false, reason: 'resend_not_configured' }
        }

        const result = await sendOrderCancellationEmail({ ...order, profiles: profile }, email)
        if (!result.success) {
            return { ok: false, sent: false, reason: (result as any).error?.message || 'email_send_failed' }
        }
        return { ok: true, sent: true, mocked: (result as any).mocked }
    } catch (err: any) {
        console.error('[triggerOrderCancellationEmail] Error:', err?.message || err)
        return { ok: false, sent: false, reason: err?.message || 'unknown_error' }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// CONTACT INQUIRY → ADMIN EMAIL
// Fired whenever a customer submits the public contact form. Goes to
// reveilfragrances@gmail.com with the customer's contact details so the
// admin can reply directly (we set reply-to to their email).
// ────────────────────────────────────────────────────────────────────────────
export async function sendContactInquiryEmail(input: {
    name: string
    email: string
    phone: string | null
    message: string
}) {
    const adminEmail = process.env.CONTACT_ADMIN_EMAIL || 'reveilfragrances@gmail.com'

    if (!resend) {
        console.log('--- MOCK CONTACT EMAIL ---')
        console.log(`From: ${input.name} <${input.email}> ${input.phone || ''}`)
        console.log(`To: ${adminEmail}`)
        console.log(`Message: ${input.message.slice(0, 200)}`)
        return { success: true, mocked: true }
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: adminEmail,
            replyTo: input.email, // Hitting Reply in Gmail emails the customer directly
            subject: `📩 New contact inquiry from ${input.name}`,
            html: `
                <div style="background:#050505; color:#fff; font-family:'Baskerville','Georgia',serif; padding:36px; max-width:620px; margin:0 auto; border:1px solid #1a1a1a;">
                    <div style="text-align:center; margin-bottom:32px;">
                        <h1 style="color:#d4af37; font-weight:300; letter-spacing:0.3em; text-transform:uppercase; margin:0; font-size:26px;">REVEIL</h1>
                        <p style="color:#666; font-size:10px; letter-spacing:0.45em; margin-top:10px; text-transform:uppercase;">Customer Inquiry</p>
                    </div>

                    <div style="text-align:center; margin-bottom:32px;">
                        <h2 style="font-weight:300; font-size:22px; color:#fff; text-transform:uppercase; letter-spacing:0.15em; margin:0;">New Inquiry Received</h2>
                        <div style="width:36px; height:1px; background:#d4af37; margin:14px auto;"></div>
                        <p style="color:#888; font-size:13px; margin:14px 24px 0;">A customer just reached out through the contact form on ${SITE_HOST}.</p>
                    </div>

                    <div style="background:#0a0a0a; border:1px solid #1a1a1a; padding:24px; margin-bottom:24px;">
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <tr><td style="padding:8px 0; color:#666; width:90px; text-transform:uppercase; letter-spacing:0.18em; font-size:10px;">Name</td><td style="padding:8px 0; color:#fff;">${escapeHtml(input.name)}</td></tr>
                            <tr><td style="padding:8px 0; color:#666; text-transform:uppercase; letter-spacing:0.18em; font-size:10px;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(input.email)}" style="color:#d4af37; text-decoration:none;">${escapeHtml(input.email)}</a></td></tr>
                            ${input.phone ? `<tr><td style="padding:8px 0; color:#666; text-transform:uppercase; letter-spacing:0.18em; font-size:10px;">Phone</td><td style="padding:8px 0;"><a href="tel:${escapeHtml(input.phone)}" style="color:#d4af37; text-decoration:none;">${escapeHtml(input.phone)}</a></td></tr>` : ''}
                            <tr><td style="padding:8px 0; color:#666; text-transform:uppercase; letter-spacing:0.18em; font-size:10px;">When</td><td style="padding:8px 0; color:#fff;">${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
                        </table>
                    </div>

                    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-left:3px solid #d4af37; padding:20px; margin-bottom:24px;">
                        <p style="color:#d4af37; font-size:10px; letter-spacing:0.25em; text-transform:uppercase; margin:0 0 12px; font-weight:700;">Message</p>
                        <p style="color:#e4e4e4; font-size:14px; line-height:1.7; margin:0; white-space:pre-wrap;">${escapeHtml(input.message)}</p>
                    </div>

                    <div style="text-align:center; margin-top:28px;">
                        <a href="mailto:${escapeHtml(input.email)}?subject=Re:%20Your%20inquiry%20at%20Reveil%20Fragrance" style="display:inline-block; background:#d4af37; color:#050505; text-decoration:none; padding:13px 32px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.25em; border-radius:2px;">Reply to ${escapeHtml(input.name.split(' ')[0])} →</a>
                    </div>

                    <div style="text-align:center; border-top:1px solid #1a1a1a; padding-top:24px; margin-top:32px; color:#555; font-size:10px;">
                        Just hit reply on this email — it goes straight to the customer.<br>
                        <span style="letter-spacing:0.3em; text-transform:uppercase; color:#666;">${SITE_HOST}</span>
                    </div>
                </div>
            `
        })

        if (error) {
            console.error('[sendContactInquiryEmail] Resend error:', error)
            return { success: false, error }
        }
        return { success: true, data }
    } catch (err) {
        console.error('[sendContactInquiryEmail] Dispatch error:', err)
        return { success: false, error: err }
    }
}

// Minimal HTML-escape helper for fields that go into the inquiry email.
function escapeHtml(s: string): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export async function sendAdminCredentialsEmail(recipientEmail: string) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { success: true, mocked: true };
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);

    try {
        await resend.emails.send({
            from: FROM_SECURITY,
            to: recipientEmail,
            subject: 'REVEIL | Your Administrative Access Credentials',
            html: `
                <div style="background-color: #050505; color: #fff; font-family: 'Georgia', serif; padding: 40px; border: 1px solid #1a1a1a; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="color: #d4af37; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase;">REVEIL</h1>
                        <p style="color: #666; font-size: 10px; letter-spacing: 0.5em; text-transform: uppercase;">Laboratory Security</p>
                    </div>
                    
                    <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
                        Below are the requested administrative credentials for the REVEIL Laboratory Archive system.
                    </p>
                    
                    <div style="background: #0a0a0a; padding: 30px; border-left: 2px solid #d4af37; margin: 30px 0;">
                        <p style="margin: 0 0 15px; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">Direct Access Link</p>
                        <p style="margin: 0 0 25px; color: #fff; font-size: 14px;">${SITE_URL}/static-v2-resource-policy-handler/login</p>
                        
                        <p style="margin: 0 0 10px; color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">Credentials</p>
                        <p style="margin: 0; color: #fff; font-size: 14px;"><strong>Email:</strong> reveilfragrances@gmail.com</p>
                        <p style="margin: 8px 0 0; color: #fff; font-size: 14px;"><strong>Password:</strong> BalajISaanU1095#</p>
                    </div>
                    
                    <p style="color: #444; font-size: 11px; font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 20px;">
                        This is a confidential system transmission. Please ensure these credentials are stored securely and not shared with unauthorized personnel.
                    </p>
                </div>
            `
        });
        return { success: true };
    } catch (err) {
        console.error('[sendAdminCredentialsEmail] Error:', err);
        return { success: false, error: err };
    }
}
