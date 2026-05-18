import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DeleteProductButton from '@/components/admin/DeleteProductButton'
import CategoryFilter from '@/components/admin/CategoryFilter'
import PageHeader from '../_components/PageHeader'
import { Plus, Search, Tag } from 'lucide-react'

export default async function AdminProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>
}) {
    const params = await searchParams
    const categoryFilter = params.category

    const supabase = await createClient()

    const [productsRes, categoriesRes] = await Promise.all([
        supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
            .filter('category', categoryFilter ? 'eq' : 'neq', categoryFilter || 'dummy_non_existent'),
        supabase
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true })
    ])

    let products = productsRes.data
    if (!categoryFilter) {
        const { data } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
        products = data
    }

    const categories = categoriesRes.data || []

    return (
        <div className="space-y-10">
            <PageHeader
                title="Products"
                subtitle="Manage your fragrance catalogue."
            >
                <div className="flex items-center gap-3">
                    <CategoryFilter
                        categories={categories}
                        currentCategory={categoryFilter}
                    />
                    <Link href="/static-v2-resource-policy-handler/products/new">
                        <button className="flex items-center gap-2 px-5 py-3 bg-black text-white text-sm font-extrabold uppercase tracking-wider rounded-full hover:bg-[#d4af37] transition-all duration-300 shadow-sm">
                            <Plus className="w-4 h-4" />
                            Add Product
                        </button>
                    </Link>
                </div>
            </PageHeader>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/40 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products…"
                            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-500 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
                                <th className="px-5 py-5">Image</th>
                                <th className="px-5 py-5">Name</th>
                                <th className="px-5 py-5">Price</th>
                                <th className="px-5 py-5">Stock</th>
                                <th className="px-5 py-5">Category</th>
                                <th className="px-5 py-5">Featured</th>
                                <th className="px-5 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products?.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-5">
                                        {product.images?.[0] ? (
                                            <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-xs font-bold text-gray-400 border border-dashed border-gray-200">
                                                No image
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="text-sm font-extrabold text-gray-900">{product.name}</div>
                                        <div className="text-[11px] text-gray-500 mt-1 font-mono font-bold">REF: {product.id.slice(0, 8).toUpperCase()}</div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="text-base font-extrabold text-black">₹{product.price.toLocaleString()}</div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                product.stock < 5 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                                            )} />
                                            <span className="text-sm font-extrabold text-gray-900">
                                                {product.stock} <span className="text-gray-500 font-semibold">in stock</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-5">
                                        <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-xs font-extrabold text-gray-800 capitalize uppercase tracking-wider">
                                            {product.category ?? 'Uncategorized'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-5">
                                        {product.is_featured ? (
                                            <span className="inline-flex px-3 py-1 rounded-full bg-[#d4af37]/15 text-[#8a6d18] text-xs font-extrabold uppercase tracking-wider border border-[#d4af37]/30">
                                                Featured
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Standard</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/static-v2-resource-policy-handler/products/${product.id}/edit`}
                                                className="inline-flex items-center px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider text-gray-700 border border-gray-200 hover:text-white hover:bg-black hover:border-black transition-all"
                                            >
                                                Edit
                                            </Link>
                                            <DeleteProductButton id={product.id} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(!products || products.length === 0) && (
                    <div className="py-28 text-center bg-gradient-to-b from-gray-50/50 to-white">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4af37]/10 mb-6">
                            <Tag className="w-7 h-7 text-[#d4af37]" />
                        </div>
                        <p className="text-lg font-extrabold text-gray-800">No products yet</p>
                        <Link href="/static-v2-resource-policy-handler/products/new" className="text-[#d4af37] text-sm font-extrabold mt-3 inline-block hover:underline underline-offset-4 uppercase tracking-wider">
                            + Add your first product
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
