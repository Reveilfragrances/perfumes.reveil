'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SITE_URL } from '@/lib/seo/keywords'
import { checkForFlaggedContent, FLAGGED_WORD_REPLACEMENTS } from '@/lib/content-check'

export default function NewProductPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [categories, setCategories] = useState<{id: string, name: string}[]>([])

    const [form, setForm] = useState({
        name: '',
        price: '',
        mrp: '',
        discountOn: false,
        description: '',
        category: '',
        stock: '',
        is_featured: false,
        apply_delivery_fee: true,
        meta_title: '',
        meta_description: '',
        meta_keywords: '',
        top_notes: '',
        heart_notes: '',
        base_notes: '',
        sizes: '',
        // Google Merchant Center fields
        unit: 'ml',
        unit_pricing_base_measure: '',
        shipping_weight: '',
    })

    // Discount % derived from MRP + discounted price. Null when the inputs
    // don't describe a valid discount (e.g. discounted price ≥ MRP).
    const computedPct = (() => {
        const m = parseFloat(form.mrp)
        const s = parseFloat(form.price)
        if (!isFinite(m) || !isFinite(s) || m <= 0 || s <= 0 || s >= m) return null
        return Math.round((1 - s / m) * 100)
    })()

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCategories(data)
            })
    }, [])

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) {
        const { name, value, type } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }))
    }

    // Auto-fill SEO fields from name/description
    function handleNameBlur() {
        if (!form.meta_title) {
            setForm(prev => ({ ...prev, meta_title: prev.name }))
        }
    }
    function handleDescBlur() {
        if (!form.meta_description) {
            setForm(prev => ({ ...prev, meta_description: prev.description.slice(0, 160) }))
        }
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        const supabase = createClient()
        const uploaded: string[] = []

        for (const file of Array.from(files)) {
            // Validate file type and size
            if (!file.type.startsWith('image/')) {
                setError(`${file.name} is not an image`)
                continue
            }
            if (file.size > 5 * 1024 * 1024) {
                setError(`${file.name} exceeds 5MB limit`)
                continue
            }

            const ext = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file)

            if (uploadError) {
                setError(`Upload failed: ${uploadError.message}`)
                continue
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName)

            uploaded.push(publicUrl)
        }

        setImages(prev => [...prev, ...uploaded])
        setUploading(false)
    }

    function removeImage(url: string) {
        setImages(prev => prev.filter(img => img !== url))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!form.name) {
            setError('Product name is required')
            return
        }

        // Resolve selling price + original price from the discount controls.
        let finalPrice: number
        let finalMrp: number | null
        if (form.discountOn) {
            const m = parseFloat(form.mrp)
            const s = parseFloat(form.price)
            if (!isFinite(m) || !isFinite(s) || m <= 0 || s <= 0 || s >= m) {
                setError('Enter an original price and a lower discounted price.')
                return
            }
            finalPrice = s
            finalMrp = m
        } else {
            finalPrice = parseFloat(form.price)
            finalMrp = null
            if (!isFinite(finalPrice) || finalPrice <= 0) {
                setError('Enter a valid selling price.')
                return
            }
        }

        if (images.length === 0) {
            setError('Please upload at least one image')
            return
        }

        setLoading(true)

        // Flagged content check — warn admin but never block save
        const flagged = checkForFlaggedContent(
            `${form.name} ${form.description} ${form.meta_description}`
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
                setLoading(false)
                return
            }
        }

        const sizesArr = form.sizes
            .split(',')
            .map(s => s.trim().toUpperCase().replace(/\s+/g, ''))
            .filter(Boolean)

        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...form,
                price: finalPrice,
                mrp: finalMrp,
                stock: parseInt(form.stock || '0'),
                images,
                meta_keywords: form.meta_keywords.trim() || null,
                apply_delivery_fee: form.apply_delivery_fee,
                scent_profile: {
                    top: form.top_notes.trim() || null,
                    heart: form.heart_notes.trim() || null,
                    base: form.base_notes.trim() || null,
                },
                technical_specs: sizesArr.length > 0 ? { sizes: sizesArr } : null,
                // Google Merchant Center fields
                unit: form.unit || 'ml',
                unit_pricing_base_measure: form.unit_pricing_base_measure
                    ? parseFloat(form.unit_pricing_base_measure)
                    : null,
                shipping_weight: form.shipping_weight
                    ? parseFloat(form.shipping_weight)
                    : null,
            }),
        })

        const data = await res.json()

        if (!res.ok) {
            setError(data.error || 'Something went wrong')
            setLoading(false)
            return
        }

        router.push('/static-v2-resource-policy-handler/products')
        router.refresh()
    }

    // ── Styles ────────────────────────────────────────────────────────────────
    const card: React.CSSProperties = {
        background: '#fff', borderRadius: '12px',
        padding: '24px', marginBottom: '20px',
    }
    const label: React.CSSProperties = {
        display: 'block', fontSize: '13px',
        fontWeight: 500, marginBottom: '6px', color: '#444',
    }
    const input: React.CSSProperties = {
        width: '100%', padding: '10px 12px', borderRadius: '8px',
        border: '1px solid #e0e0e0', fontSize: '14px',
        boxSizing: 'border-box', outline: 'none',
    }
    const textarea: React.CSSProperties = {
        ...input, resize: 'vertical', minHeight: '100px',
    }

    return (
        <div style={{ maxWidth: '780px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'none', border: '1px solid #ddd', borderRadius: '8px',
                        padding: '8px 14px', cursor: 'pointer', fontSize: '13px'
                    }}
                >
                    Back
                </button>
                <h1 style={{ margin: 0, fontSize: '22px' }}>Add new product</h1>
            </div>

            {error && (
                <div style={{
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
                    color: '#dc2626', fontSize: '14px'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>

                {/* ── Basic info ── */}
                <div style={card}>
                    <h2 style={{ marginTop: 0, fontSize: '16px', marginBottom: '20px' }}>Basic info</h2>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={label}>Product name *</label>
                        <input
                            style={input} name="name" value={form.name}
                            onChange={handleChange} onBlur={handleNameBlur}
                            placeholder="e.g. Midnight Oud or Velvet Rose" required
                        />
                    </div>

                    {/* Pricing & discount */}
                    <div style={{
                        background: '#fafafa', border: '1px solid #eee', borderRadius: '10px',
                        padding: '16px', marginBottom: '16px'
                    }}>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                            marginBottom: form.discountOn ? '16px' : 0
                        }}>
                            <input
                                type="checkbox" name="discountOn"
                                checked={form.discountOn} onChange={handleChange}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                                Show discount on this product
                            </span>
                        </label>

                        {form.discountOn ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={label}>Original price / MRP (₹) *</label>
                                    <input
                                        style={input} name="mrp" type="number"
                                        min="0" step="0.01" value={form.mrp}
                                        onChange={handleChange} placeholder="649"
                                    />
                                </div>
                                <div>
                                    <label style={label}>Discounted price (₹) *</label>
                                    <input
                                        style={input} name="price" type="number"
                                        min="0" step="0.01" value={form.price}
                                        onChange={handleChange} placeholder="399"
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    {computedPct != null ? (
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '20px', fontWeight: 700, color: '#b8860b' }}>
                                                ₹{parseFloat(form.price).toLocaleString('en-IN')}
                                            </span>
                                            <span style={{ fontSize: '14px', color: '#999', textDecoration: 'line-through' }}>
                                                ₹{parseFloat(form.mrp).toLocaleString('en-IN')}
                                            </span>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                                                {computedPct}% OFF
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '12px', color: '#888' }}>Enter an original price and a lower discounted price to preview.</span>
                                    )}
                                    <p style={{ fontSize: '11px', color: '#888', marginTop: '6px', marginBottom: 0 }}>
                                        Customer pays the bold price (the % off is calculated automatically). The original shows struck-through.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label style={label}>Selling price (₹) *</label>
                                <input
                                    style={input} name="price" type="number"
                                    min="0" step="0.01" value={form.price}
                                    onChange={handleChange} placeholder="300"
                                />
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '4px', marginBottom: 0 }}>
                                    What the customer pays. Turn on the toggle above to show a struck-through original price.
                                </p>
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '16px', maxWidth: '240px' }}>
                        <label style={label}>Stock quantity</label>
                        <input
                            style={input} name="stock" type="number"
                            min="0" value={form.stock}
                            onChange={handleChange} placeholder="50"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={label}>Category</label>
                            <select
                                style={input} name="category"
                                value={form.category} onChange={handleChange}
                            >
                                <option value="">Select category</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '24px' }}>
                            <input
                                type="checkbox" id="is_featured" name="is_featured"
                                checked={form.is_featured}
                                onChange={handleChange}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <label htmlFor="is_featured" style={{ ...label, margin: 0, cursor: 'pointer' }}>
                                Featured product (shown on homepage)
                            </label>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#fafafa', border: '1px solid #eee', borderRadius: '10px',
                        padding: '14px 16px', marginBottom: '16px'
                    }}>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                                Apply delivery fee (₹60)
                            </div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                ON → this product applies the standard ₹60 shipping when subtotal is below ₹250.
                                OFF → this product never contributes to delivery; cart stays free if all items are OFF.
                            </div>
                        </div>
                        <input
                            type="checkbox" id="apply_delivery_fee" name="apply_delivery_fee"
                            checked={form.apply_delivery_fee}
                            onChange={handleChange}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                    </div>

                    <div>
                        <label style={label}>Description</label>
                        <textarea
                            style={textarea} name="description"
                            value={form.description}
                            onChange={handleChange}
                            onBlur={handleDescBlur}
                            placeholder="Describe the product..."
                        />
                        <p style={{ fontSize: '11px', color: '#888', marginTop: '6px', marginBottom: 0 }}>
                            Formatting is preserved: start a line with • (or - / *) for bullets, leave a blank line for a new paragraph, and emojis work too. ✨
                        </p>
                    </div>
                </div>

                {/* ── Scent profile ── */}
                <div style={card}>
                    <h2 style={{ marginTop: 0, fontSize: '16px', marginBottom: '8px' }}>Scent profile</h2>
                    <p style={{ fontSize: '13px', color: '#888', marginTop: 0, marginBottom: '16px' }}>
                        Top, heart and base notes shown on the product page.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={label}>Top notes</label>
                            <input
                                style={input} name="top_notes" value={form.top_notes}
                                onChange={handleChange}
                                placeholder="e.g. Bergamot, Lemon"
                            />
                        </div>
                        <div>
                            <label style={label}>Heart notes</label>
                            <input
                                style={input} name="heart_notes" value={form.heart_notes}
                                onChange={handleChange}
                                placeholder="e.g. Rose, Jasmine"
                            />
                        </div>
                        <div>
                            <label style={label}>Base notes</label>
                            <input
                                style={input} name="base_notes" value={form.base_notes}
                                onChange={handleChange}
                                placeholder="e.g. Oud, Amber"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <label style={label}>Available sizes</label>
                        <input
                            style={input} name="sizes" value={form.sizes}
                            onChange={handleChange}
                            placeholder="e.g. 10ML, 50ML, 100ML"
                        />
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '6px', marginBottom: 0 }}>
                            Comma-separated. Shown as selectable chips on the product page. Leave blank to use the default 50ML / 100ML.
                        </p>
                    </div>
                </div>

                {/* ── Images ── */}
                <div style={card}>
                    <h2 style={{ marginTop: 0, fontSize: '16px', marginBottom: '8px' }}>Product images</h2>
                    <p style={{ fontSize: '13px', color: '#888', marginTop: 0, marginBottom: '16px' }}>
                        Upload up to 5 images. First image will be the main display image. Max 5MB each.
                    </p>

                    {/* Upload button */}
                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', background: '#f4f4f4', borderRadius: '8px',
                        border: '1px dashed #ccc', cursor: images.length >= 5 ? 'not-allowed' : 'pointer',
                        fontSize: '14px', color: '#555', marginBottom: '16px',
                        opacity: images.length >= 5 ? 0.5 : 1,
                    }}>
                        {uploading ? 'Uploading...' : '+ Upload images'}
                        <input
                            type="file" accept="image/*" multiple
                            onChange={handleImageUpload}
                            disabled={uploading || images.length >= 5}
                            style={{ display: 'none' }}
                        />
                    </label>

                    {/* Image previews */}
                    {images.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {images.map((url, i) => (
                                <div key={url} style={{ position: 'relative' }}>
                                    <img
                                        src={url} alt={`Product ${i + 1}`}
                                        style={{
                                            width: '100px', height: '100px',
                                            objectFit: 'cover', borderRadius: '8px',
                                            border: i === 0 ? '2px solid #6366f1' : '1px solid #eee'
                                        }}
                                    />
                                    {i === 0 && (
                                        <span style={{
                                            position: 'absolute', bottom: '4px', left: '4px',
                                            background: '#6366f1', color: '#fff',
                                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                                        }}>
                                            Main
                                        </span>
                                    )}
                                    <button
                                        type="button" onClick={() => removeImage(url)}
                                        style={{
                                            position: 'absolute', top: '-8px', right: '-8px',
                                            background: '#ef4444', color: '#fff', border: 'none',
                                            borderRadius: '50%', width: '22px', height: '22px',
                                            cursor: 'pointer', fontSize: '12px', lineHeight: 1,
                                        }}
                                    >
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── SEO ── */}
                <div style={card}>
                    <h2 style={{ marginTop: 0, fontSize: '16px', marginBottom: '4px' }}>SEO settings</h2>
                    <p style={{ fontSize: '13px', color: '#888', marginTop: 0, marginBottom: '16px' }}>
                        Auto-filled from product name and description. Edit if needed.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={label}>
                            Meta title
                            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: '8px' }}>
                                ({form.meta_title.length}/60)
                            </span>
                        </label>
                        <input
                            style={{
                                ...input,
                                borderColor: form.meta_title.length > 60 ? '#ef4444' : '#e0e0e0',
                            }}
                            name="meta_title" value={form.meta_title}
                            onChange={handleChange}
                            placeholder="Midnight Oud | REVEIL"
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={label}>
                            Meta description
                            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: '8px' }}>
                                ({form.meta_description.length}/160)
                            </span>
                        </label>
                        <textarea
                            style={{
                                ...textarea,
                                minHeight: '80px',
                                borderColor: form.meta_description.length > 160 ? '#ef4444' : '#e0e0e0',
                            }}
                            name="meta_description" value={form.meta_description}
                            onChange={handleChange}
                            placeholder="Experience the deep, mysterious notes of Midnight Oud, a signature fragrance by REVEIL..."
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={label}>Meta keywords</label>
                        <input
                            style={input}
                            name="meta_keywords" value={form.meta_keywords}
                            onChange={handleChange}
                            placeholder="midnight oud, oud perfume india, long lasting oud, royal oud"
                        />
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '6px', marginBottom: 0 }}>
                            Comma-separated. Merged with auto-generated keywords on the product page.
                        </p>
                    </div>

                    {/* ── Google Merchant Center fields ── */}
                    <div style={{
                        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
                        padding: '16px', marginBottom: '16px',
                    }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            🛒 Google Merchant Center
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={label}>Unit (ml / g / fl oz)</label>
                                <select
                                    style={input} name="unit"
                                    value={form.unit} onChange={handleChange}
                                >
                                    <option value="ml">ml (millilitres)</option>
                                    <option value="g">g (grams)</option>
                                    <option value="fl oz">fl oz</option>
                                </select>
                            </div>
                            <div>
                                <label style={label}>Volume/Weight (e.g. 50, 6, 100)</label>
                                <input
                                    style={input} name="unit_pricing_base_measure"
                                    type="number" min="0" step="0.1"
                                    value={form.unit_pricing_base_measure}
                                    onChange={handleChange}
                                    placeholder="e.g. 50"
                                />
                            </div>
                            <div>
                                <label style={label}>Shipping weight (kg)</label>
                                <input
                                    style={input} name="shipping_weight"
                                    type="number" min="0.01" step="0.01"
                                    value={form.shipping_weight}
                                    onChange={handleChange}
                                    placeholder="0.2"
                                />
                            </div>
                        </div>
                        <p style={{ fontSize: '11px', color: '#92400e', marginTop: '10px', marginBottom: 0 }}>
                            These fields fix the "Missing unit pricing measure" and "Missing shipping costs" errors in Google Merchant Center.
                            For a 50ml perfume bottle, enter Unit = ml, Volume = 50, Shipping weight = 0.2.
                        </p>
                    </div>

                    {/* Google preview */}
                    {(form.meta_title || form.name) && (
                        <div style={{
                            marginTop: '16px', padding: '16px', background: '#f8f9fa',
                            borderRadius: '8px', border: '1px solid #eee',
                        }}>
                            <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>Google preview</p>
                            <div style={{ fontSize: '18px', color: '#1a0dab', marginBottom: '4px' }}>
                                {form.meta_title || form.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#006621', marginBottom: '4px' }}>
                                {SITE_URL.replace(/^https?:\/\//, '')}/products/{form.name.toLowerCase().replace(/\s+/g, '-')}
                            </div>
                            <div style={{ fontSize: '13px', color: '#545454' }}>
                                {form.meta_description || form.description || 'No description yet.'}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Submit ── */}
                <div style={{ display: 'flex', gap: '12px', paddingBottom: '40px' }}>
                    <button
                        type="submit" disabled={loading || uploading}
                        style={{
                            padding: '12px 32px', background: loading ? '#a5b4fc' : '#6366f1',
                            color: '#fff', border: 'none', borderRadius: '8px',
                            fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        {loading ? 'Saving...' : 'Save product'}
                    </button>
                    <button
                        type="button" onClick={() => router.back()}
                        style={{
                            padding: '12px 24px', background: '#fff', color: '#555',
                            border: '1px solid #ddd', borderRadius: '8px',
                            fontSize: '15px', cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>

            </form>
        </div>
    )
}