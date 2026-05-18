import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import PageHeader from './_components/PageHeader'
import { ArrowUpRight, ShoppingBag, Tag, Users, Clock, ArrowRight } from 'lucide-react'

export default async function AdminDashboard() {
    const supabase = await createClient()

    const [{ count: productCount }, { count: orderCount }, { data: recentOrders }] =
        await Promise.all([
            supabase.from('products').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('orders')
                .select('id, total, status, created_at, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(5),
        ])

    return (
        <div className="space-y-12">
            <PageHeader 
                title="Dashboard" 
                subtitle="System overview and recent performance metrics."
            >
                <div className="flex gap-3">
                    <Link href="/static-v2-resource-policy-handler/products/new" className="px-6 py-3 bg-black text-white text-xs font-extrabold tracking-widest uppercase rounded-full hover:bg-[#d4af37] transition-all duration-300 shadow-sm">
                        + New Product
                    </Link>
                </div>
            </PageHeader>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Products', value: productCount ?? 0, icon: Tag, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Total Orders', value: orderCount ?? 0, icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Customers', value: '12', icon: Users, color: 'text-amber-500', bg: 'bg-amber-50' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className={cn("p-4 rounded-2xl transition-colors duration-300", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-300 group-hover:text-black transition-colors" />
                        </div>
                        <div>
                            <span className="text-[11px] font-extrabold tracking-[0.25em] uppercase text-gray-500">{stat.label}</span>
                            <div className="text-5xl font-extrabold tracking-tight mt-2 text-black">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Sections */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Recent Orders Table */}
                <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-[#d4af37]" />
                            <h2 className="text-base font-extrabold tracking-widest uppercase">Recent Transactions</h2>
                        </div>
                        <Link href="/static-v2-resource-policy-handler/orders" className="text-[11px] font-extrabold tracking-widest uppercase text-gray-500 hover:text-black flex items-center gap-1 transition-colors">
                            View All <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[11px] font-extrabold tracking-widest uppercase text-gray-500 border-b border-gray-100">
                                    <th className="px-8 py-4">Reference</th>
                                    <th className="px-8 py-4">Customer</th>
                                    <th className="px-8 py-4">Amount</th>
                                    <th className="px-8 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders?.map((order) => (
                                    <tr key={order.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-6 font-mono text-xs font-bold text-gray-700 uppercase">
                                            #{order.id.slice(0, 8)}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-extrabold text-gray-900">
                                                {(order.profiles as any)?.full_name ?? 'Guest User'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-extrabold text-black">
                                            ₹{order.total.toLocaleString()}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={cn(
                                                "text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border",
                                                order.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            )}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions / Shortcuts */}
                <div className="space-y-6">
                    <div className="bg-black rounded-3xl p-8 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-extrabold tracking-tight mb-3">Vault Management</h3>
                            <p className="text-white/60 text-sm font-medium leading-relaxed mb-6">
                                Access your full inventory of luxury fragrances and manage collection details.
                            </p>
                            <Link href="/static-v2-resource-policy-handler/products" className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.25em] uppercase text-[#d4af37] hover:text-white transition-colors">
                                Open Inventory <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        {/* Abstract background element */}
                        <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#d4af37] rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity" />
                    </div>

                    <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-extrabold tracking-widest uppercase mb-6 text-gray-600">System Shortcuts</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Manage Carousel', href: '/static-v2-resource-policy-handler/carousel' },
                                { label: 'Review Moderation', href: '/static-v2-resource-policy-handler/reviews' },
                                { label: 'Collection Tags', href: '/static-v2-resource-policy-handler/collections' },
                                { label: 'Resend Credentials', href: '/api/admin/resend-login', method: 'POST' },
                            ].map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="flex justify-between items-center p-4 rounded-2xl border border-gray-100 hover:border-[#d4af37] hover:bg-gray-50 transition-all duration-300 group"
                                >
                                    <span className="text-[11px] font-extrabold tracking-widest uppercase text-gray-700 group-hover:text-black">{link.label}</span>
                                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#d4af37]" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}