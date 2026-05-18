import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import OrderStatusBadge from '@/components/admin/OrderStatusBadge'
import CancelOrderButton from '@/components/admin/CancelOrderButton'
import { cn } from '@/lib/utils'
import { Truck, ExternalLink, Printer, ShoppingBag, Mail } from 'lucide-react'
import ResendConfirmationButton from '@/components/admin/ResendConfirmationButton'
import FulfillButton from '../../../../components/admin/FulfillButton'
import { getDisplayStatus } from '@/lib/utils/order-status'
import PageHeader from '../_components/PageHeader'

export default async function AdminOrdersPage() {
    const supabase = await createClient()

    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            total,
            status,
            payment_status,
            payment_method,
            created_at,
            cod_charge,
            shipping_cost,
            awb_code,
            label_url,
            courier_name,
            shiprocket_order_id,
            profiles(full_name, phone),
            order_items(quantity, products(name))
        `)
        .order('created_at', { ascending: false })

    return (
        <div className="space-y-10">
            <PageHeader
                title="Orders"
                subtitle="Manage and track every customer order."
            >
                <div className="bg-white px-5 py-2.5 rounded-full border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Orders: </span>
                    <span className="text-base font-extrabold text-black">{orders?.length ?? 0}</span>
                </div>
            </PageHeader>

            {error && (
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 flex items-center gap-3 text-red-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold">Could not load orders: {error.message}</span>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <table className="w-full text-left table-fixed">
                    <thead>
                        <tr className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
                            <th className="px-6 py-5 w-[13%]">Order</th>
                            <th className="px-6 py-5 w-[16%]">Customer</th>
                            <th className="px-6 py-5 w-[20%]">Items</th>
                            <th className="px-6 py-5 w-[11%]">Amount</th>
                            <th className="px-6 py-5 w-[10%]">Payment</th>
                            <th className="px-6 py-5 w-[10%]">Status</th>
                            <th className="px-6 py-5 w-[10%]">Shipping</th>
                            <th className="px-6 py-5 w-[10%] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {orders?.map((order: any) => {
                            const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles as any
                            const displayStatus = getDisplayStatus(order)
                            return (
                                <tr key={order.id} className="group hover:bg-[#fbfaf7] transition-colors align-middle">
                                    {/* Order */}
                                    <td className="px-6 py-6">
                                        <div className="text-sm font-mono font-extrabold text-black tracking-tight truncate">
                                            #{order.id?.slice(0, 8).toUpperCase()}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1.5 font-bold">
                                            {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>

                                    {/* Customer */}
                                    <td className="px-6 py-6">
                                        <div className="text-sm font-extrabold text-gray-900 truncate">
                                            {profile?.full_name ?? 'Guest'}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1 font-semibold truncate">
                                            {profile?.phone ?? '—'}
                                        </div>
                                    </td>

                                    {/* Items */}
                                    <td className="px-6 py-6">
                                        <div className="text-sm text-gray-900 leading-snug space-y-1">
                                            {order.order_items?.map((item: any, i: number) => (
                                                <div key={i} className="truncate">
                                                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 mr-1.5 rounded-md bg-[#d4af37]/15 text-[#8a6d18] text-[11px] font-extrabold">
                                                        {item.quantity}×
                                                    </span>
                                                    <span className="font-bold">{item.products?.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-6 py-6">
                                        <div className="text-base font-extrabold text-black tracking-tight">
                                            ₹{order.total?.toLocaleString()}
                                        </div>
                                        {order.payment_method === 'cod' && (
                                            <div className="inline-flex mt-2 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">COD</div>
                                        )}
                                        {order.payment_method === 'razorpay' && (
                                            <div className="inline-flex mt-2 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">Online</div>
                                        )}
                                    </td>

                                    {/* Payment status */}
                                    <td className="px-6 py-6">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize whitespace-nowrap border",
                                            order.payment_status === 'paid'
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : "bg-amber-50 text-amber-700 border-amber-100"
                                        )}>
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                order.payment_status === 'paid' ? "bg-emerald-500" : "bg-amber-500"
                                            )} />
                                            {order.payment_status ?? 'Pending'}
                                        </div>
                                    </td>

                                    {/* Order status — derived from real signals only */}
                                    <td className="px-6 py-6">
                                        <OrderStatusBadge status={displayStatus} />
                                    </td>

                                    {/* Shipping */}
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1.5">
                                            {order.shiprocket_order_id ? (
                                                <>
                                                    {order.awb_code && (
                                                        <Link href={`/track/${order.awb_code}`} target="_blank" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors truncate">
                                                            <Truck className="w-3.5 h-3.5 shrink-0" /> {order.awb_code}
                                                        </Link>
                                                    )}
                                                    {order.label_url && (
                                                        <a href={order.label_url} target="_blank" className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5 transition-colors">
                                                            <Printer className="w-3.5 h-3.5 shrink-0" /> Label
                                                        </a>
                                                    )}
                                                    {!order.awb_code && !order.label_url && (
                                                        <span className="text-xs text-gray-400 italic">In Shiprocket</span>
                                                    )}
                                                </>
                                            ) : (
                                                <FulfillButton orderId={order.id} isFulfilled={false} />
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-6">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Link
                                                href={`/static-v2-resource-policy-handler/orders/${order.id}`}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-gray-600 hover:text-white hover:bg-black border border-gray-200 hover:border-black transition-all"
                                                title="View order details"
                                            >
                                                <ExternalLink className="w-3 h-3" /> View
                                            </Link>
                                            <ResendConfirmationButton orderId={order.id} />
                                            <CancelOrderButton orderId={order.id} currentStatus={order.status ?? 'pending'} />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {(!orders || orders.length === 0) && (
                    <div className="py-28 text-center bg-gradient-to-b from-gray-50/50 to-white">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4af37]/10 mb-6">
                            <ShoppingBag className="w-7 h-7 text-[#d4af37]" />
                        </div>
                        <p className="text-lg font-bold text-gray-700">
                            No orders yet
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                            New orders will show up here as customers check out.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
