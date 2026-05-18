import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from './_components/AdminSidebar'

// Admin layout always runs an auth check against the request cookie — never
// safe to prerender. Marking the segment dynamic suppresses noise warnings.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/static-v2-resource-policy-handler/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        // Non-admins get bounced to the public site, NOT to the admin login —
        // we don't even confirm an admin panel exists.
        redirect('/')
    }

    return (
        <div className="flex min-h-screen bg-[#fcfcfc] admin-panel">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-8 lg:p-12">
                    {children}
                </div>
            </main>
            {/* Strengthen base content weight across the admin panel so labels,
                cells, and helper text read crisply without touching every page. */}
            <style>{`
                .admin-panel { font-weight: 500; }
                .admin-panel p, .admin-panel span, .admin-panel td, .admin-panel li, .admin-panel a, .admin-panel label, .admin-panel button { font-weight: 600; }
                .admin-panel h1, .admin-panel h2, .admin-panel h3, .admin-panel h4 { font-weight: 800; letter-spacing: -0.01em; }
                .admin-panel th { font-weight: 800 !important; }
            `}</style>
        </div>
    )
}
