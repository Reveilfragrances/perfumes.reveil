import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import PageHeader from '../_components/PageHeader'
import { Users, Mail, Phone, Calendar, ArrowRight } from 'lucide-react'
import { realEmail } from '@/lib/validators'

export default async function UsersPage() {
    const supabase = await createClient()

    const { data: allUsers, error } = await supabase
        .from('profiles')
        .select(`
            *,
            orders ( id )
        `)
        .order('created_at', { ascending: false })

    // Backstop: pull real (non-placeholder) emails from auth.users for users
    // whose profiles.email is missing. We strip the "<phone>@reveil.internal"
    // placeholder so the admin panel never displays it.
    const emailById = new Map<string, string | null>()
    try {
        const admin = createAdminClient()
        const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
        for (const u of authData?.users ?? []) {
            emailById.set(u.id, realEmail(u.email))
        }
    } catch (e) {
        console.error('[Admin Users] Failed to load auth emails:', e)
    }

    const users = allUsers
        ?.filter(u => u.role !== 'admin')
        .map(u => ({
            ...u,
            email: realEmail(u.email) || emailById.get(u.id) || null,
        }))

    return (
        <div className="space-y-10">
            <PageHeader
                title="Users"
                subtitle="Everyone who has signed up on the site."
            >
                <div className="bg-white px-5 py-2.5 rounded-full border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Users: </span>
                    <span className="text-base font-extrabold text-black">{users?.length ?? 0}</span>
                </div>
            </PageHeader>

            {error && (
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-red-600 text-sm font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Could not load users: {error.message}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-500 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
                                <th className="px-5 py-5">User ID</th>
                                <th className="px-5 py-5">Name</th>
                                <th className="px-5 py-5">Contact</th>
                                <th className="px-5 py-5">Orders</th>
                                <th className="px-5 py-5">Joined</th>
                                <th className="px-5 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users?.map((profile: any) => (
                                <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-5">
                                        <div className="text-sm font-mono font-extrabold text-gray-900">
                                            #{profile.id.slice(0, 8).toUpperCase()}
                                        </div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#d4af37]/15 text-[#8a6d18] flex items-center justify-center text-base font-extrabold uppercase shrink-0">
                                                {profile.first_name?.[0] || profile.full_name?.[0] || '?'}
                                            </div>
                                            <div className="text-sm font-extrabold text-gray-900">
                                                {profile.first_name || profile.full_name || 'Anonymous'} {profile.last_name || ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                                <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                                <span className="truncate max-w-[220px]">{profile.email || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                                <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                                {profile.phone || '—'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-sm font-extrabold text-gray-800 min-w-[36px] justify-center">
                                            {profile.orders?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                            {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </div>
                                    </td>
                                    <td className="px-5 py-5 text-right">
                                        {profile.orders?.length > 0 ? (
                                            <Link
                                                href={`/static-v2-resource-policy-handler/orders?userId=${profile.id}`}
                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[#8a6d18] hover:text-black transition-colors"
                                            >
                                                View orders <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        ) : (
                                            <span className="text-sm font-bold text-gray-300">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(!users || users.length === 0) && (
                    <div className="py-28 text-center bg-gradient-to-b from-gray-50/50 to-white">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4af37]/10 mb-6">
                            <Users className="w-7 h-7 text-[#d4af37]" />
                        </div>
                        <p className="text-lg font-extrabold text-gray-800">No users yet</p>
                        <p className="text-sm font-semibold text-gray-500 mt-2">New signups will show up here.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
