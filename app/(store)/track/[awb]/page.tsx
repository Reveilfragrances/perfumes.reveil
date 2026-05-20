import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { motion } from 'framer-motion'
import { Package, Truck, CheckCircle2, Clock, MapPin, ChevronRight, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function TrackingPage(props: {
    params: Promise<{ awb: string }>
}) {
    const params = await props.params
    const supabase = await createClient()

    // Fetch order from Supabase by AWB
    const { data: order } = await supabase
        .from('orders')
        .select(`
            id, 
            status, 
            courier_name, 
            awb_code, 
            created_at, 
            shipping_address, 
            total,
            order_items(quantity, price, products(name, images))
        `)
        .eq('awb_code', params.awb)
        .single()

    if (!order) notFound()

    // Fetch live tracking from Shiprocket API
    let tracking: any = null
    try {
        // Use full URL or relative if on same server
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const res = await fetch(`${baseUrl}/api/shiprocket/track/${params.awb}`, { 
            next: { revalidate: 300 } 
        })
        if (res.ok) tracking = await res.json()
    } catch (err) {
        console.error('Tracking fetch error:', err)
    }

    const steps = [
        { key: 'pending',           label: 'Order Placed',      icon: Clock },
        { key: 'confirmed',         label: 'Confirmed',         icon: CheckCircle2 },
        { key: 'shipped',           label: 'Shipped',           icon: Truck },
        { key: 'out_for_delivery',  label: 'Out for Delivery',  icon: MapPin },
        { key: 'delivered',         label: 'Delivered',         icon: ShoppingBag },
    ]

    const statusMap: Record<string, number> = {
        'pending': 0,
        'confirmed': 1,
        'shipped': 2,
        'out_for_delivery': 3,
        'delivered': 4,
        'failed_delivery': 2,
        'cancelled': -1,
        'return_initiated': 2,
        'returned': 4
    }

    const currentIndex = statusMap[order.status] ?? 0
    const address = order.shipping_address as any

    return (
        <div className="track-page">
            {/* Mobile-responsive overrides — server components can't useState,
                so we ship one <style> block that re-flows the desktop layout
                below 900px (tablet) and tightens spacing below 640px (phone). */}
            <style>{`
                .track-page {
                    min-height: 100vh;
                    background: #f8f7f2;
                    color: #1a1a1a;
                    padding-top: 100px;
                    padding-bottom: 100px;
                }
                .track-container { max-width: 900px; margin: 0 auto; padding: 0 24px; }
                .track-header { margin-bottom: 60px; }
                .track-title { font-size: clamp(32px, 5vw, 48px); font-family: var(--font-baskerville); font-weight: 300; margin: 0; letter-spacing: 0.05em; }
                .track-grid { display: grid; grid-template-columns: 1fr 320px; gap: 40px; align-items: start; }
                .track-status-card { background: linear-gradient(145deg,#fff 0%,#f3eee2 100%); border: 1px solid rgba(212,175,55,0.3); padding: 40px; border-radius: 4px; position: relative; overflow: hidden; }
                .track-status-heading { font-size: 12px; color: #d4af37; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 40px; text-align: center; }
                .track-timeline { display: flex; justify-content: space-between; position: relative; padding: 0 20px; }
                .track-timeline-line-base { position: absolute; top: 15px; left: 40px; right: 40px; height: 1px; background: rgba(212,175,55,0.3); }
                .track-timeline-line-progress { position: absolute; top: 15px; left: 40px; height: 1px; background: #d4af37; box-shadow: 0 0 10px #d4af37; transition: width 1s ease; }
                .track-step { z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; min-width: 0; }
                .track-step-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.5s; flex-shrink: 0; }
                .track-step-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.15em; text-align: center; max-width: 60px; line-height: 1.3; }
                .track-activity-card { display: flex; gap: 24px; padding: 24px; background: #fff; border: 1px solid rgba(0,0,0,0.05); border-radius: 2px; }
                .track-sidebar-card { padding: 32px; background: #fff; border: 1px solid rgba(0,0,0,0.05); border-radius: 2px; }
                .track-sidebar-card.gold { padding: 32px; background: rgba(212,175,55,0.06); border: 1px solid rgba(212,175,55,0.3); border-radius: 2px; }

                /* ── TABLET: stack the sidebar below ─────────────────────── */
                @media (max-width: 900px) {
                    .track-page { padding-top: 80px; padding-bottom: 60px; }
                    .track-header { margin-bottom: 36px; }
                    .track-grid { grid-template-columns: 1fr; gap: 24px; }
                }

                /* ── PHONE: tighten paddings, shrink timeline ────────────── */
                @media (max-width: 640px) {
                    .track-container { padding: 0 16px; }
                    .track-header { margin-bottom: 28px; }
                    .track-status-card { padding: 24px 14px; }
                    .track-status-heading { margin-bottom: 24px; letter-spacing: 0.25em; font-size: 10px; }
                    .track-timeline { padding: 0 4px; gap: 4px; }
                    .track-timeline-line-base, .track-timeline-line-progress { left: 18px; right: 18px; }
                    .track-step-icon { width: 26px; height: 26px; }
                    .track-step-label { font-size: 7px; max-width: 56px; letter-spacing: 0.08em; }
                    .track-activity-card { padding: 16px; gap: 14px; }
                    .track-sidebar-card, .track-sidebar-card.gold { padding: 20px; }
                }
            `}</style>

            <div className="track-container">

                {/* Header Section */}
                <div className="track-header">
                    <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', textDecoration: 'none', marginBottom: '24px' }}>
                        <ArrowLeft size={12} /> Return to Orders
                    </Link>
                    <h1 className="track-title">
                        Tracking <span style={{ color: '#d4af37', fontStyle: 'italic' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                    </h1>
                    <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '12px' }}>
                        Tracking your order
                    </p>
                </div>

                <div className="track-grid">

                    {/* Left Column: Progress & Activity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* Status Card */}
                        <div className="track-status-card">
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />

                            <h2 className="track-status-heading">Order Journey</h2>

                            <div className="track-timeline">
                                <div className="track-timeline-line-base" />
                                <div
                                    className="track-timeline-line-progress"
                                    style={{ width: `${(currentIndex / 4) * 80}%` }}
                                />

                                {steps.map((step, i) => {
                                    const isCompleted = i <= currentIndex
                                    const isCurrent = i === currentIndex
                                    const Icon = step.icon

                                    return (
                                        <div key={step.key} className="track-step">
                                            <div
                                                className="track-step-icon"
                                                style={{
                                                    background: isCompleted ? '#d4af37' : '#f8f7f2',
                                                    border: `1px solid ${isCompleted ? '#d4af37' : 'rgba(212,175,55,0.3)'}`,
                                                    boxShadow: isCurrent ? '0 0 20px rgba(212,175,55,0.4)' : 'none',
                                                }}
                                            >
                                                <Icon size={14} color={isCompleted ? '#000' : 'rgba(212,175,55,0.5)'} />
                                            </div>
                                            <span
                                                className="track-step-label"
                                                style={{
                                                    color: isCompleted ? '#1a1a1a' : 'rgba(0,0,0,0.35)',
                                                    fontWeight: isCurrent ? 700 : 400,
                                                }}
                                            >
                                                {step.label}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Activity Log Section */}
                        {tracking?.activities?.length > 0 && (
                            <div style={{ padding: '20px 0' }}>
                                <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-baskerville)', color: '#d4af37', marginBottom: '32px', letterSpacing: '0.1em' }}>Delivery Updates</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {tracking.activities.map((act: any, i: number) => (
                                        <div key={i} className="track-activity-card">
                                            <div style={{ paddingTop: '4px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === 0 ? '#d4af37' : 'rgba(212,175,55,0.3)', boxShadow: i === 0 ? '0 0 10px #d4af37' : 'none' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '13px', margin: 0, fontWeight: 500, color: i === 0 ? '#1a1a1a' : 'rgba(0,0,0,0.6)' }}>{act.activity}</p>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '10px', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', flexWrap: 'wrap' }}>
                                                    <span>{act.location}</span>
                                                    <span>•</span>
                                                    <span>{act.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Order Info Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Courier Details */}
                        <div className="track-sidebar-card gold">
                            <h4 style={{ fontSize: '10px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '20px', marginTop: 0 }}>Courier</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <p style={{ fontSize: '9px', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Courier</p>
                                    <p style={{ fontSize: '14px', margin: 0, fontWeight: 500 }}>{order.courier_name || 'Processing'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '9px', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Tracking Number</p>
                                    <p style={{ fontSize: '14px', margin: 0, fontWeight: 500, fontFamily: 'monospace', color: '#d4af37', wordBreak: 'break-all' }}>{order.awb_code}</p>
                                </div>
                                {tracking?.etd && (
                                    <div style={{ marginTop: '4px', padding: '12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '4px' }}>
                                        <p style={{ fontSize: '8px', color: '#d4af37', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Estimated Arrival</p>
                                        <p style={{ fontSize: '13px', margin: 0, fontWeight: 700 }}>{tracking.etd}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Destination */}
                        <div className="track-sidebar-card">
                            <h4 style={{ fontSize: '10px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '20px', marginTop: 0 }}>Delivering To</h4>
                            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(0,0,0,0.7)', margin: 0 }}>
                                {address?.full_name || address?.name || 'Valued Client'}<br />
                                {address?.address_line1 || address?.line1 || address?.address}<br />
                                {address?.city}, {address?.state} {address?.pincode}
                            </p>
                        </div>

                        {/* Items Preview */}
                        <div className="track-sidebar-card">
                            <h4 style={{ fontSize: '10px', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '20px', marginTop: 0 }}>Items in this order</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {order.order_items.map((item: any, i: number) => {
                                    const product = Array.isArray(item.products) ? item.products[0] : item.products
                                    return (
                                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ width: '44px', height: '44px', background: '#f3eee2', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                                                <img src={product?.images?.[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product?.name}</p>
                                                <p style={{ fontSize: '9px', color: 'rgba(0,0,0,0.4)', margin: '2px 0 0 0' }}>Qty: {item.quantity}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}
