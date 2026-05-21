'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Category {
    id: string
    name: string
}

/**
 * Category filter for the admin products page.
 *
 * Uses the current pathname so we don't hardcode the admin URL prefix — the
 * admin lives under `/static-v2-resource-policy-handler/products` today but
 * the prefix has changed before (and will change again on re-key). Reading
 * the path at runtime keeps this component prefix-agnostic.
 */
export default function CategoryFilter({
    categories,
    currentCategory
}: {
    categories: Category[],
    currentCategory?: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    return (
        <form method="GET" className="flex items-center gap-2" onSubmit={(e) => e.preventDefault()}>
            <select
                name="category"
                value={currentCategory || ''}
                onChange={(e) => {
                    const val = e.target.value
                    // Build the next URL from the current pathname so the
                    // filter works no matter what the admin URL prefix is.
                    const params = new URLSearchParams(searchParams.toString())
                    if (val) {
                        params.set('category', val)
                    } else {
                        params.delete('category')
                    }
                    const query = params.toString()
                    router.push(query ? `${pathname}?${query}` : pathname)
                }}
                className="text-[10px] font-bold tracking-widest uppercase border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-accent transition-colors bg-white cursor-pointer"
            >
                <option value="">All Categories</option>
                {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                ))}
            </select>
        </form>
    )
}
