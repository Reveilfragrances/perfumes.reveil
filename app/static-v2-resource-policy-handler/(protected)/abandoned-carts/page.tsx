import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '../_components/PageHeader'
import { realEmail } from '@/lib/validators'
import { ShoppingCart, Clock, Phone, Mail, User, MessageCircle } from 'lucide-react'

// Always read live cart state against the service-role client — never prerender.
export const dynamic = 'force-dynamic'

// A cart is considered "abandoned" once it has been inactive for this long.
// Newer carts are still shown, but flagged as "Active" so the admin can tell
// them apart from stale ones worth a recovery nudge.
const ABANDONED_AFTER_MINUTES = 60

interface CartItemRow {
    id: string
    quantity: number
    created_at: string
    user_id: string | null
    products: {
        id: string
        name: string
        slug: string
        price: number
        images: string[] | null
    } | null
}

function inr(value: number) {
    return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function timeAgo(iso: string) {
    const then = new Date(iso).getTime()
    const mins = Math.max(0, Math.floor((Date.now() - then) / 60000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
}

function waLink(phone: string) {
    const digits = phone.replace(/\D/g, '')
    const withCc = digits.length === 10 ? `91${digits}` : digits
    return `https://wa.me/${withCc}`
}

export default async function AbandonedCartsPage() {
    const admin = createAdminClient()

    // 1. Every cart row still sitting in the DB. Because the checkout flows
    //    (COD in /api/orders and prepaid in finaliseRazorpayOrder) delete
    //    cart_items on a completed order, anything left here is an un-purchased
    //    (i.e. abandoned or in-progress) cart.
    const { data: cartRowsRaw, error } = await admin
        .from('cart_items')
        .select(`
            id,
            quantity,
            created_at,
            user_id,
            products ( id, name, slug, price, images )
        `)
        .order('created_at', { ascending: false })

    const cartRows = (cartRowsRaw ?? []) as unknown as CartItemRow[]

    // 2. Group rows by customer.
    const byUser = new Map<string, { items: CartItemRow[]; lastActivity: string }>()
    for (const row of cartRows) {
        if (!row.user_id) continue
        const entry = byUser.get(row.user_id) ?? { items: [], lastActivity: row.created_at }
        entry.items.push(row)
        if (new Date(row.created_at) > new Date(entry.lastActivity)) entry.lastActivity = row.created_at
        byUser.set(row.user_id, entry)
    }

    const userIds = [...byUser.keys()]

    // 3. Customer profiles for those carts.
    const profilesById = new Map<string, any>()
    if (userIds.length) {
        const { data: profs } = await admin
            .from('profiles')
            .select('id, first_name, last_name, full_name, phone, email, role, created_at')
            .in('id', userIds)
        for (const p of profs ?? []) profilesById.set(p.id, p)
    }

    // 4. Backstop real emails from auth.users (profiles.email may be missing or
    //    a "<phone>@reveil.internal" placeholder) — same approach as the Users page.
    const emailById = new Map<string, string | null>()
    try {
        const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
        for (const u of authData?.users ?? []) emailById.set(u.id, realEmail(u.email))
    } catch (e) {
        console.error('[Admin AbandonedCarts] Failed to load auth emails:', e)
    }

    // 5. Assemble the view model, excluding admin-owned test carts.
    const carts = userIds
        .map((uid) => {
            const profile = profilesById.get(uid)
            const entry = byUser.get(uid)!
            const items = entry.items.filter((it) => it.products) // skip deleted products
            const subtotal = items.reduce((s, it) => s + (it.products!.price || 0) * it.quantity, 0)
            const itemCount = items.reduce((s, it) => s + it.quantity, 0)
            const name = profile?.full_name
                || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
                || 'Guest customer'
            const minsInactive = Math.floor((Date.now() - new Date(entry.lastActivity).getTime()) / 60000)
            return {
                userId: uid,
                name,
                role: profile?.role,
                email: realEmail(profile?.email) || emailById.get(uid) || null,
                phone: profile?.phone || null,
                items,
                subtotal,
                itemCount,
                lastActivity: entry.lastActivity,
                isAbandoned: minsInactive >= ABANDONED_AFTER_MINUTES,
            }
        })
        .filter((c) => c.role !== 'admin' && c.items.length > 0)
        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

    const totalValue = carts.reduce((s, c) => s + c.subtotal, 0)
    const abandonedCount = carts.filter((c) => c.isAbandoned).length

    return (
        <div className="space-y-10">
            <PageHeader
                title="Abandoned Carts"
                subtitle="Customers who added items but haven't checked out yet — follow up to recover the sale."
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white px-5 py-2.5 rounded-full border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Open Carts: </span>
                        <span className="text-base font-extrabold text-black">{carts.length}</span>
                    </div>
                    <div className="bg-white px-5 py-2.5 rounded-full border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Potential Revenue: </span>
                        <span className="text-base font-extrabold text-[#8a6d18]">{inr(totalValue)}</span>
                    </div>
                </div>
            </PageHeader>

            {error && (
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-red-600 text-sm font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Could not load carts: {error.message}
                </div>
            )}

            {carts.length > 0 && (
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    {abandonedCount} inactive &gt; {ABANDONED_AFTER_MINUTES} min · {carts.length - abandonedCount} active
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {carts.map((cart) => (
                    <div key={cart.userId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        {/* Customer header */}
                        <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-full bg-[#d4af37]/15 text-[#8a6d18] flex items-center justify-center text-base font-extrabold uppercase shrink-0">
                                        {cart.name?.[0] || <User className="w-5 h-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-extrabold text-gray-900 truncate">{cart.name}</div>
                                        <div className="text-[11px] font-mono font-bold text-gray-400">#{cart.userId.slice(0, 8).toUpperCase()}</div>
                                    </div>
                                </div>
                                <span
                                    className={
                                        'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ' +
                                        (cart.isAbandoned ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')
                                    }
                                >
                                    <span className={'w-1.5 h-1.5 rounded-full ' + (cart.isAbandoned ? 'bg-red-500' : 'bg-emerald-500')} />
                                    {cart.isAbandoned ? 'Abandoned' : 'Active'}
                                </span>
                            </div>

                            {/* Contact row */}
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                    {cart.email ? (
                                        <a href={`mailto:${cart.email}`} className="hover:text-[#8a6d18] truncate max-w-[220px]">{cart.email}</a>
                                    ) : '—'}
                                </span>
                                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                                    <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                    {cart.phone ? <a href={`tel:${cart.phone}`} className="hover:text-[#8a6d18]">{cart.phone}</a> : '—'}
                                </span>
                                {cart.phone && (
                                    <a
                                        href={waLink(cart.phone)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                    </a>
                                )}
                                <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 ml-auto">
                                    <Clock className="w-3.5 h-3.5" /> {timeAgo(cart.lastActivity)}
                                </span>
                            </div>
                        </div>

                        {/* Products in cart */}
                        <div className="p-5 space-y-3 flex-1">
                            {cart.items.map((item) => {
                                const p = item.products!
                                const img = p.images?.[0] || null
                                return (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                            {img ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={img} alt={p.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <ShoppingCart className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                                            <div className="text-xs font-semibold text-gray-500">{inr(p.price)} × {item.quantity}</div>
                                        </div>
                                        <div className="text-sm font-extrabold text-gray-900 shrink-0">{inr(p.price * item.quantity)}</div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Cart total */}
                        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                                {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
                            </span>
                            <span className="text-base font-extrabold text-black">{inr(cart.subtotal)}</span>
                        </div>
                    </div>
                ))}
            </div>

            {carts.length === 0 && !error && (
                <div className="py-28 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4af37]/10 mb-6">
                        <ShoppingCart className="w-7 h-7 text-[#d4af37]" />
                    </div>
                    <p className="text-lg font-extrabold text-gray-800">No abandoned carts</p>
                    <p className="text-sm font-semibold text-gray-500 mt-2">Every customer with items in their cart will show up here.</p>
                </div>
            )}
        </div>
    )
}
