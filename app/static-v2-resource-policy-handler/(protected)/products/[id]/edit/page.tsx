'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { checkForFlaggedContent, FLAGGED_WORD_REPLACEMENTS } from '@/lib/content-check'

type Params = Promise<{ id: string }>

export default function EditProductPage(props: { params: Params }) {
    const params = use(props.params)
    const id = params.id
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [product, setProduct] = useState<any>(null)
    const [categories, setCategories] = useState<{id: string, name: string}[]>([])
    const [images, setImages] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string>('')

    // Pricing & discount — when discount is on, the admin enters the original
    // (MRP) price and the discounted price; the % off is auto-calculated.
    const [discountOn, setDiscountOn] = useState(false)
    const [origPrice, setOrigPrice] = useState('')   // MRP / original
    const [salePrice, setSalePrice] = useState('')   // discounted price the admin enters
    const [basePrice, setBasePrice] = useState('')    // selling price when no discount

    // Discount % derived from MRP + discounted price. Null when the inputs
    // don't describe a valid discount (e.g. sale price ≥ MRP).
    const computedPct = (() => {
        const m = parseFloat(origPrice)
        const s = parseFloat(salePrice)
        if (!isFinite(m) || !isFinite(s) || m <= 0 || s <= 0 || s >= m) return null
        return Math.round((1 - s / m) * 100)
    })()

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: pData } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single()

            const cRes = await fetch('/api/categories')
            const cData = await cRes.json()

            if (pData) {
                setProduct(pData)
                setImages(Array.isArray(pData.images) ? pData.images : [])

                // Seed the discount controls. A product has an active discount
                // when its MRP is a number greater than the selling price.
                const m = typeof pData.mrp === 'number' ? pData.mrp : null
                if (m && m > pData.price) {
                    setDiscountOn(true)
                    setOrigPrice(String(m))
                    setSalePrice(String(pData.price))
                    setBasePrice(String(pData.price))
                } else {
                    setDiscountOn(false)
                    setBasePrice(String(pData.price))
                }
            }
            if (Array.isArray(cData)) setCategories(cData)

            setLoading(false)
        }
        fetchData()
    }, [id, supabase])

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadError('')
        setUploading(true)
        const uploaded: string[] = []

        for (const file of Array.from(files)) {
            // Accept only webp, jpg/jpeg, png
            const allowed = ['image/webp', 'image/jpeg', 'image/jpg', 'image/png']
            if (!allowed.includes(file.type)) {
                setUploadError(`${file.name}: only webp, jpg, png are allowed`)
                continue
            }
            if (file.size > 5 * 1024 * 1024) {
                setUploadError(`${file.name} exceeds 5MB limit`)
                continue
            }

            const ext = (file.name.split('.').pop() || 'webp').toLowerCase()
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

            const { error: uploadErr } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, { contentType: file.type, cacheControl: '3600', upsert: false })

            if (uploadErr) {
                setUploadError(`Upload failed: ${uploadErr.message}`)
                continue
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName)

            uploaded.push(publicUrl)
        }

        setImages(prev => [...prev, ...uploaded])
        setUploading(false)
        // Reset the file input so re-selecting the same file works
        e.target.value = ''
    }

    function removeImage(url: string) {
        setImages(prev => prev.filter(img => img !== url))
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSaving(true)

        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string

        // Auto-generate slug if not provided, or ensure it's clean
        const slug = formData.get('slug') as string || name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

        const top = ((formData.get('top_notes') as string) || '').trim()
        const heart = ((formData.get('heart_notes') as string) || '').trim()
        const base = ((formData.get('base_notes') as string) || '').trim()

        // Available sizes — comma-separated input from admin, normalised to
        // an array of trimmed, uppercased labels (e.g. "10 ml , 50ml,100ML"
        // → ["10ML", "50ML", "100ML"]).
        const sizesRaw = ((formData.get('sizes') as string) || '').trim()
        const sizes = sizesRaw
            ? sizesRaw.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean)
            : []

        const metaKeywordsRaw = ((formData.get('meta_keywords') as string) || '').trim()
        const metaTitleRaw = ((formData.get('meta_title') as string) || '').trim()
        const metaDescriptionRaw = ((formData.get('meta_description') as string) || '').trim()

        // Resolve selling price (`price`) and original price (`mrp`) from the
        // discount controls. With discount off, mrp is cleared so no
        // strikethrough shows on the storefront.
        let finalPrice: number
        let finalMrp: number | null
        if (discountOn) {
            const m = parseFloat(origPrice)
            const s = parseFloat(salePrice)
            if (!isFinite(m) || !isFinite(s) || m <= 0 || s <= 0 || s >= m) {
                alert('Enter an original price and a lower discounted price.')
                setSaving(false)
                return
            }
            finalPrice = s
            finalMrp = m
        } else {
            finalPrice = parseFloat(basePrice)
            finalMrp = null
            if (!isFinite(finalPrice) || finalPrice <= 0) {
                alert('Enter a valid selling price.')
                setSaving(false)
                return
            }
        }

        const body = {
            name,
            slug,
            description: formData.get('description'),
            price: finalPrice,
            mrp: finalMrp,
            stock: Number(formData.get('stock')),
            category: formData.get('category'),
            is_featured: formData.get('is_featured') === 'on',
            apply_delivery_fee: formData.get('apply_delivery_fee') === 'on',
            meta_title: metaTitleRaw || null,
            meta_description: metaDescriptionRaw || null,
            meta_keywords: metaKeywordsRaw || null,
            // Images managed via controlled state (upload + manual URL fallback)
            images,
            scent_profile: {
                top: top || null,
                heart: heart || null,
                base: base || null,
            },
            // Preserve any existing technical_specs keys (volume, longevity,
            // concentration, …) and overwrite only `sizes`.
            technical_specs: {
                ...(product.technical_specs || {}),
                sizes,
            },
            // Google Merchant Center fields
            unit: (formData.get('unit') as string) || 'ml',
            unit_pricing_base_measure: formData.get('unit_pricing_base_measure')
                ? parseFloat(formData.get('unit_pricing_base_measure') as string)
                : null,
            shipping_weight: formData.get('shipping_weight')
                ? parseFloat(formData.get('shipping_weight') as string)
                : null,
        }

        // Flagged content check — warn admin but never block save
        const flagged = checkForFlaggedContent(
            `${name} ${body.description || ''} ${metaDescriptionRaw}`
        )
        if (flagged.length > 0) {
            const replacements = flagged
                .map((w) => `"${w}" → use ${FLAGGED_WORD_REPLACEMENTS[w] || 'a different word'}`)
                .join('\n')
            const proceed = window.confirm(
                `⚠️ Google Merchant Center Warning\n\n` +
                `The following words may cause Google to flag this product as "Restricted adult content":\n` +
                `${replacements}\n\n` +
                `Consider replacing them before saving.\n\n` +
                `Click OK to save anyway, or Cancel to go back and edit.`
            )
            if (!proceed) {
                setSaving(false)
                return
            }
        }

        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                router.push('/static-v2-resource-policy-handler/products')
                router.refresh()
            } else {
                const err = await res.json()
                alert(`Error: ${err.error}`)
            }
        } catch (error) {
            console.error('Update failed:', error)
            alert('Failed to update product')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    if (!product) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-light text-gray-500 uppercase tracking-widest">Fragrance Not Found</h2>
                <Link href="/static-v2-resource-policy-handler/products" className="text-accent text-sm mt-4 inline-block underline underline-offset-4 font-bold tracking-widest uppercase">
                    Return to Collection
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                    <Link href="/static-v2-resource-policy-handler/products" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-gray-900 leading-none">
                            Edit Essence
                        </h1>
                        <p className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mt-2 italic flex items-center gap-2">
                            Modifying profile for <span className="text-accent tracking-normal underline">#{product.id.slice(0, 8).toUpperCase()}</span>
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Principal Details */}
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2 text-accent">
                            <Sparkles className="w-4 h-4" />
                            <h2 className="text-[10px] font-bold tracking-[.3em] uppercase">Identity & Narrative</h2>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Product Name</label>
                            <input
                                name="name"
                                defaultValue={product.name}
                                required
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all font-medium"
                                placeholder="Golden Oud..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Slug Handle</label>
                                <input
                                    name="slug"
                                    defaultValue={product.slug}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all font-mono"
                                    placeholder="golden-oud-parfum"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Collection Group</label>
                                <select
                                    name="category"
                                    defaultValue={product.category}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all appearance-none font-medium"
                                >
                                    <option value="">Select category</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Description Narrative</label>
                            <textarea
                                name="description"
                                defaultValue={product.description}
                                rows={6}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-4 text-sm focus:ring-1 focus:ring-accent transition-all leading-relaxed whitespace-pre-line"
                                placeholder="Describe the olfactory journey..."
                            />
                            <p className="text-[10px] text-gray-400">Formatting is preserved: start a line with • (or - / *) for bullets, leave a blank line for a new paragraph, and emojis work too. ✨</p>
                        </div>
                    </section>

                    <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2 text-accent">
                            <ImageIcon className="w-4 h-4" />
                            <h2 className="text-[10px] font-bold tracking-[.3em] uppercase">Visual Assets</h2>
                        </div>

                        {/* Upload button */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                                Upload Images <span className="text-gray-300 normal-case font-normal tracking-normal">(webp, jpg, png · max 5MB each)</span>
                            </label>
                            <label
                                className={`flex items-center justify-center gap-3 px-4 py-6 rounded-xl border-2 border-dashed transition-colors ${
                                    uploading
                                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                                        : 'border-gray-300 bg-gray-50 hover:border-accent hover:bg-amber-50 cursor-pointer'
                                }`}
                            >
                                <input
                                    type="file"
                                    accept="image/webp,image/jpeg,image/jpg,image/png"
                                    multiple
                                    disabled={uploading}
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <Upload className="w-4 h-4 text-gray-500" />
                                <span className="text-[11px] font-bold tracking-widest uppercase text-gray-600">
                                    {uploading ? 'Uploading…' : 'Click to upload (you can pick multiple)'}
                                </span>
                            </label>
                            {uploadError && (
                                <p className="text-[11px] text-red-500 mt-2">{uploadError}</p>
                            )}
                        </div>

                        {/* Manual URL fallback — kept for cases where you already have a CDN link */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Or paste an image URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-[11px] font-mono focus:ring-1 focus:ring-accent transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            const v = (e.target as HTMLInputElement).value.trim()
                                            if (v) {
                                                setImages(prev => [...prev, v])
                                                ;(e.target as HTMLInputElement).value = ''
                                            }
                                        }
                                    }}
                                />
                                <span className="text-[9px] text-gray-400 self-center uppercase tracking-widest whitespace-nowrap">Press Enter</span>
                            </div>
                        </div>

                        {/* Preview grid with delete buttons */}
                        {images.length > 0 && (
                            <div className="grid grid-cols-4 gap-4 pt-2">
                                {images.map((img, i) => (
                                    <div key={`${img}-${i}`} className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group relative">
                                        <img src={img} className="w-full h-full object-cover" alt={`Preview ${i + 1}`} />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(img)}
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-red-500 hover:text-white text-gray-700 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                            aria-label="Remove image"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        {i === 0 && (
                                            <span className="absolute bottom-1 left-1 text-[8px] font-bold tracking-widest uppercase bg-black/70 text-white px-2 py-0.5 rounded">Main</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2 text-accent">
                            <Sparkles className="w-4 h-4" />
                            <h2 className="text-[10px] font-bold tracking-[.3em] uppercase">Scent Profile</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Top Notes</label>
                                <input
                                    name="top_notes"
                                    defaultValue={product.scent_profile?.top || ''}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="e.g. Bergamot, Lemon"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Heart Notes</label>
                                <input
                                    name="heart_notes"
                                    defaultValue={product.scent_profile?.heart || ''}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="e.g. Rose, Jasmine"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Base Notes</label>
                                <input
                                    name="base_notes"
                                    defaultValue={product.scent_profile?.base || ''}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="e.g. Oud, Amber"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                                Available Sizes <span className="text-gray-300 normal-case font-normal tracking-normal">(comma separated, e.g. 10ML, 50ML, 100ML)</span>
                            </label>
                            <input
                                name="sizes"
                                defaultValue={Array.isArray(product.technical_specs?.sizes) ? product.technical_specs.sizes.join(', ') : ''}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                placeholder="10ML, 50ML, 100ML"
                            />
                            <p className="text-[10px] text-gray-400">Shown as selectable chips on the product page. Leave blank to use the default 50ML / 100ML.</p>
                        </div>
                    </section>
                </div>

                {/* Right Column: Inventory & Stats */}
                <div className="space-y-8">
                    <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
                        {/* Discount toggle — admin decides per product whether to run a discount */}
                        <div className="pb-4 border-b border-gray-50">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={discountOn}
                                        onChange={(e) => setDiscountOn(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-accent transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                                </div>
                                <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 group-hover:text-accent transition-colors">
                                    Show Discount
                                </span>
                            </label>
                        </div>

                        {discountOn ? (
                            <>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 block">Original Price / MRP (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-light text-sm">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={origPrice}
                                            onChange={(e) => setOrigPrice(e.target.value)}
                                            required
                                            className="w-full bg-gray-50 border-none rounded-xl pl-8 pr-4 py-4 text-lg font-medium focus:ring-1 focus:ring-accent transition-all"
                                            placeholder="649"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 block">Discounted Price (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-light text-sm">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={salePrice}
                                            onChange={(e) => setSalePrice(e.target.value)}
                                            required
                                            className="w-full bg-gray-50 border-none rounded-xl pl-8 pr-4 py-4 text-lg font-medium focus:ring-1 focus:ring-accent transition-all"
                                            placeholder="399"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400">What the customer pays. Must be lower than the original price. The % off is calculated automatically.</p>
                                </div>

                                {/* Live preview of exactly what the storefront will show */}
                                <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                                    {computedPct != null ? (
                                        <div className="flex items-baseline gap-3 flex-wrap">
                                            <span className="text-lg font-bold text-accent">₹{parseFloat(salePrice).toLocaleString('en-IN')}</span>
                                            <span className="text-sm text-gray-400 line-through">₹{parseFloat(origPrice).toLocaleString('en-IN')}</span>
                                            <span className="text-[10px] font-bold text-green-600 tracking-wide">
                                                {computedPct}% OFF
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-gray-400">Enter an original price and a lower discounted price to preview.</span>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-1">Customer pays the bold price. The original shows struck-through with the % badge.</p>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 block">Selling Price (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-light text-sm">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={basePrice}
                                        onChange={(e) => setBasePrice(e.target.value)}
                                        required
                                        className="w-full bg-gray-50 border-none rounded-xl pl-8 pr-4 py-4 text-lg font-medium focus:ring-1 focus:ring-accent transition-all"
                                        placeholder="300"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400">What the customer pays. Turn on “Show Discount” to display a struck-through original price.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 block">Current Inventory</label>
                            <input
                                name="stock"
                                type="number"
                                defaultValue={product.stock}
                                required
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-4 text-lg font-medium focus:ring-1 focus:ring-accent transition-all"
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-50">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_featured"
                                        defaultChecked={product.is_featured}
                                        className="peer sr-only"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-accent transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                                </div>
                                <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 group-hover:text-accent transition-colors">
                                    Promote to Featured Selection
                                </span>
                            </label>
                        </div>

                        <div className="pt-4 border-t border-gray-50">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center mt-1">
                                    <input
                                        type="checkbox"
                                        name="apply_delivery_fee"
                                        defaultChecked={product.apply_delivery_fee ?? true}
                                        className="peer sr-only"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-accent transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 group-hover:text-accent transition-colors block">
                                        Apply Delivery Fee (₹60)
                                    </span>
                                    <span className="text-[10px] text-gray-400 normal-case tracking-normal block leading-relaxed">
                                        ON → standard shipping below ₹250. OFF → this product never contributes to delivery charges.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </section>

                    <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2 text-accent">
                            <Sparkles className="w-4 h-4" />
                            <h2 className="text-[10px] font-bold tracking-[.3em] uppercase">SEO Settings</h2>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                                Meta Title <span className="text-gray-300 normal-case font-normal tracking-normal">(≤ 60 chars)</span>
                            </label>
                            <input
                                name="meta_title"
                                defaultValue={product.meta_title || ''}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                placeholder="Midnight Oud | REVEIL"
                            />
                            <p className="text-[10px] text-gray-400">Overrides the auto-generated browser/Google tab title. Leave blank to use the auto title.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                                Meta Description <span className="text-gray-300 normal-case font-normal tracking-normal">(≤ 160 chars)</span>
                            </label>
                            <textarea
                                name="meta_description"
                                defaultValue={product.meta_description || ''}
                                rows={3}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                placeholder="Experience the deep, mysterious notes of Midnight Oud..."
                            />
                            <p className="text-[10px] text-gray-400">Shown in Google search snippets. Leave blank to use the product description.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                                Meta Keywords <span className="text-gray-300 normal-case font-normal tracking-normal">(comma separated)</span>
                            </label>
                            <textarea
                                name="meta_keywords"
                                defaultValue={product.meta_keywords || ''}
                                rows={3}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                                placeholder="midnight oud, oud perfume india, long lasting oud"
                            />
                            <p className="text-[10px] text-gray-400">Merged with auto-generated keywords on the product page.</p>
                        </div>

                        {/* Google Merchant Center fields */}
                        <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-4 space-y-3">
                            <p className="text-[9px] font-bold tracking-widest uppercase text-amber-700">
                                🛒 Google Merchant Center
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Unit</label>
                                    <select
                                        name="unit"
                                        defaultValue={product.unit || 'ml'}
                                        className="w-full bg-white border border-amber-100 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-accent transition-all"
                                    >
                                        <option value="ml">ml (millilitres)</option>
                                        <option value="g">g (grams)</option>
                                        <option value="fl oz">fl oz</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Volume / Weight (e.g. 50)</label>
                                    <input
                                        type="number"
                                        name="unit_pricing_base_measure"
                                        defaultValue={product.unit_pricing_base_measure || ''}
                                        min="0" step="0.1"
                                        className="w-full bg-white border border-amber-100 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-accent transition-all"
                                        placeholder="50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Shipping weight (kg)</label>
                                    <input
                                        type="number"
                                        name="shipping_weight"
                                        defaultValue={product.shipping_weight || ''}
                                        min="0.01" step="0.01"
                                        className="w-full bg-white border border-amber-100 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-accent transition-all"
                                        placeholder="0.2"
                                    />
                                </div>
                            </div>
                            <p className="text-[9px] text-amber-600">Fixes "Missing unit pricing measure" &amp; "Missing shipping costs" in Merchant Center. Example: 50ml bottle → Unit=ml, Volume=50, Weight=0.2.</p>
                        </div>
                    </section>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-gray-900 border border-gray-900 text-white rounded-2xl py-5 px-8 font-bold text-[10px] tracking-[.3em] uppercase hover:bg-white hover:text-gray-900 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-gray-200"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Commit Changes
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (confirm('Are you sure you want to retire this fragrance?')) {
                                fetch(`/api/products/${id}`, { method: 'DELETE' })
                                    .then(() => router.push('/static-v2-resource-policy-handler/products'))
                            }
                        }}
                        className="w-full border border-red-50/50 bg-red-50/20 text-red-500 rounded-2xl py-4 font-bold text-[9px] tracking-widest uppercase hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Trash2 className="w-3 h-3" />
                        Retire Fragrance
                    </button>
                </div>
            </form>
        </div>
    )
}