import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OrderStatusBadge from '@/components/admin/OrderStatusBadge'
import CancelOrderButton from '@/components/admin/CancelOrderButton'
import ConfirmOrderButton from '@/components/admin/ConfirmOrderButton'
import { getDisplayStatus } from '@/lib/utils/order-status'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient()

    // Fetch single order with detailed breakdown and profiles
    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            id,
            total,
            shipping_cost,
            cod_charge,
            status,
            payment_method,
            payment_status,
            payment_id,
            shipping_address,
            shiprocket_order_id,
            awb_code,
            created_at,
            profiles (
                full_name,
                first_name,
                last_name,
                phone,
                email
            ),
            order_items (
                id,
                quantity,
                price,
                products (
                    name,
                    images
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error || !order) {
        return notFound()
    }

    // Calculate subtotal from items
    const subtotal = order.order_items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0)

    // Customer identity — fallback chain so registered users never show "Guest".
    const orderProfile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles as any
    const addr = (order.shipping_address as any) || {}
    const displayName =
        orderProfile?.full_name
        || [orderProfile?.first_name, orderProfile?.last_name].filter(Boolean).join(' ').trim()
        || addr.full_name
        || 'Guest'
    const displayPhone = orderProfile?.phone || addr.phone || '—'
    const displayEmail = orderProfile?.email || addr.email || '—'

    // Full shipping address — read every saved field, not just city/state/pincode.
    const addrLine1 = addr.address_line1 || addr.line1 || addr.address || ''
    const addrLine2 = addr.address_line2 || addr.line2 || ''
    const addrCityStatePin = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')

    return (
        <div style={{ maxWidth: '1000px' }}>
            <div style={{ marginBottom: '24px' }}>
                <Link href="/static-v2-resource-policy-handler/orders" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
                    ← Back to all orders
                </Link>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Order Detail</h1>
                    <div style={{ color: '#64748b', marginTop: '4px' }}>#{order.id.toUpperCase()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <OrderStatusBadge status={getDisplayStatus(order)} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <ConfirmOrderButton
                            orderId={order.id}
                            currentStatus={order.status}
                            shiprocketOrderId={order.shiprocket_order_id ?? null}
                        />
                        <CancelOrderButton orderId={order.id} currentStatus={order.status} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                {/* Left: Items list */}
                <div>
                    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Order Items</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {order.order_items.map((item: any) => (
                                <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <img
                                        src={item.products?.images?.[0] || 'https://via.placeholder.com/64'}
                                        style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#334155' }}>{item.products?.name}</div>
                                        <div style={{ fontSize: '14px', color: '#64748b' }}>₹{item.price} × {item.quantity}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>₹{item.price * item.quantity}</div>
                                </div>
                            ))}
                        </div>

                        {/* Summary Breakdown */}
                        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', padding: '16px', borderRadius: '12px', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', color: '#64748b', fontSize: '14px' }}>
                                <span>Subtotal</span>
                                <span>₹{subtotal.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', color: '#64748b', fontSize: '14px' }}>
                                <span>Shipping Cost</span>
                                <span>+ ₹{order.shipping_cost}</span>
                            </div>
                            {order.payment_method === 'cod' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', color: '#64748b', fontSize: '14px' }}>
                                    <span>COD Charge</span>
                                    <span>+ ₹{order.cod_charge}</span>
                                </div>
                            )}
                            <div style={{ height: '1px', background: '#e2e8f0', width: '240px', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '240px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                                <span>Total</span>
                                <span>₹{order.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Shipping Address</h2>
                        <div style={{
                            fontSize: '15px',
                            lineHeight: 1.6,
                            color: '#475569',
                            padding: '16px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0'
                        }}>
                            {typeof order.shipping_address === 'string' ? order.shipping_address : (
                                <div>
                                    <div style={{ fontWeight: 600 }}>{addr.full_name || displayName}</div>
                                    {addrLine1 && <div>{addrLine1}</div>}
                                    {addrLine2 && <div>{addrLine2}</div>}
                                    {addrCityStatePin && <div>{addrCityStatePin}</div>}
                                    <div>India</div>
                                    <div style={{ marginTop: '4px' }}>Phone: {addr.phone || displayPhone}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Customer & Payment Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Customer</h2>
                        <div>
                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '16px' }}>
                                {displayName}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                                {displayEmail}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>
                                {displayPhone}
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Payment</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Method</label>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', textTransform: 'uppercase' }}>{order.payment_method}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Status</label>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: order.payment_status === 'paid' ? '#059669' : '#d97706',
                                    textTransform: 'uppercase'
                                }}>
                                    {order.payment_status}
                                </div>
                            </div>
                            {order.payment_id && (
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Payment ID</label>
                                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', wordBreak: 'break-all' }}>{order.payment_id}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
