'use client'

import { useEffect, useState } from 'react'

type CouponType = 'flat' | 'percentage' | 'flat_on_minimum' | 'percentage_on_minimum'

interface Coupon {
    id: string
    code: string
    description: string
    type: CouponType
    value: number
    minimum_order_amount: number
    maximum_discount?: number
    is_active: boolean
    usage_limit?: number
    usage_count: number
    per_user_limit?: number
    expires_at?: string
}

const TYPE_LABELS: Record<CouponType, string> = {
    flat: 'Flat ₹ Off',
    percentage: '% Off',
    flat_on_minimum: 'Flat ₹ Off (Min Order)',
    percentage_on_minimum: '% Off (Min Order)',
}

type CouponForm = {
    code: string
    description: string
    type: CouponType
    value: number
    minimum_order_amount: number
    maximum_discount?: number
    is_active: boolean
    usage_limit?: number
    per_user_limit?: number
    expires_at?: string
}

const EMPTY_FORM: CouponForm = {
    code: '',
    description: '',
    type: 'flat',
    value: 0,
    minimum_order_amount: 0,
    maximum_discount: undefined,
    is_active: true,
    usage_limit: undefined,
    per_user_limit: undefined,
    expires_at: undefined,
}

export default function AdminCouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<CouponForm>({ ...EMPTY_FORM })
    const [saving, setSaving] = useState(false)

    async function fetchCoupons() {
        const res = await fetch('/api/admin/coupons')
        const data = await res.json()
        setCoupons(Array.isArray(data) ? data : [])
    }

    useEffect(() => { fetchCoupons() }, [])

    async function handleSave() {
        setSaving(true)
        const payload = { ...form, code: form.code.toUpperCase().trim() }
        const url = editingId ? `/api/admin/coupons/${editingId}` : '/api/admin/coupons'
        const method = editingId ? 'PUT' : 'POST'
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        setSaving(false)
        setShowForm(false)
        setEditingId(null)
        setForm({ ...EMPTY_FORM })
        fetchCoupons()
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this coupon? This cannot be undone.')) return
        await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
        fetchCoupons()
    }

    async function handleToggle(coupon: Coupon) {
        await fetch(`/api/admin/coupons/${coupon.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !coupon.is_active }),
        })
        fetchCoupons()
    }

    function handleEdit(coupon: Coupon) {
        setForm({
            code: coupon.code,
            description: coupon.description || '',
            type: coupon.type,
            value: coupon.value,
            minimum_order_amount: coupon.minimum_order_amount,
            maximum_discount: coupon.maximum_discount,
            is_active: coupon.is_active,
            usage_limit: coupon.usage_limit,
            per_user_limit: coupon.per_user_limit,
            expires_at: coupon.expires_at,
        })
        setEditingId(coupon.id)
        setShowForm(true)
    }

    const isMinimumType = form.type === 'flat_on_minimum' || form.type === 'percentage_on_minimum'
    const isPercentageType = form.type === 'percentage' || form.type === 'percentage_on_minimum'

    const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-gray-900">Coupon Codes</h1>
                <button
                    onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }) }}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                >
                    + Create New Coupon
                </button>
            </div>

            {showForm && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <h2 className="mb-4 text-base font-semibold">{editingId ? 'Edit Coupon' : 'New Coupon'}</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Coupon Code *</label>
                            <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE10" className={`${inputCls} uppercase tracking-wider`} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description (admin label)</label>
                            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Welcome discount" className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Coupon Type *</label>
                            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })} className={inputCls}>
                                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{isPercentageType ? 'Discount Percentage (%)' : 'Discount Amount (₹)'} *</label>
                            <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} min={0} className={inputCls} />
                        </div>
                        {isMinimumType && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Order Amount (₹)</label>
                                <input type="number" value={form.minimum_order_amount} onChange={(e) => setForm({ ...form, minimum_order_amount: Number(e.target.value) })} min={0} className={inputCls} />
                            </div>
                        )}
                        {isPercentageType && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Maximum Discount Cap (₹) — blank for no cap</label>
                                <input type="number" value={form.maximum_discount ?? ''} onChange={(e) => setForm({ ...form, maximum_discount: e.target.value ? Number(e.target.value) : undefined })} min={0} className={inputCls} />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Total Usage Limit — blank for unlimited</label>
                            <input type="number" value={form.usage_limit ?? ''} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : undefined })} min={1} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Per User Limit — blank for unlimited</label>
                            <input type="number" value={form.per_user_limit ?? ''} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value ? Number(e.target.value) : undefined })} min={1} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date — blank for no expiry</label>
                            <input type="datetime-local" value={form.expires_at ? form.expires_at.substring(0, 16) : ''} onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={inputCls} />
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                            <label className="text-xs font-medium text-gray-600">Active?</label>
                            <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
                            {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
                        </button>
                        <button onClick={() => { setShowForm(false); setEditingId(null) }} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                            {['Code', 'Type', 'Value', 'Min Order', 'Status', 'Expiry', 'Uses', 'Actions'].map((h) => (
                                <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {coupons.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No coupons yet</td></tr>
                        )}
                        {coupons.map((coupon) => (
                            <tr key={coupon.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono font-semibold text-gray-900">{coupon.code}</td>
                                <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[coupon.type]}</td>
                                <td className="px-4 py-3">
                                    {coupon.type.includes('percentage') ? `${coupon.value}%` : `₹${coupon.value}`}
                                    {coupon.maximum_discount ? ` (max ₹${coupon.maximum_discount})` : ''}
                                </td>
                                <td className="px-4 py-3">{coupon.minimum_order_amount > 0 ? `₹${coupon.minimum_order_amount}` : '—'}</td>
                                <td className="px-4 py-3">
                                    <button onClick={() => handleToggle(coupon)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${coupon.is_active ? 'bg-green-500' : 'bg-gray-300'}`} title={coupon.is_active ? 'Click to deactivate' : 'Click to activate'}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${coupon.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-gray-500">{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-4 py-3 text-gray-600">{coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(coupon)} className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">Edit</button>
                                        <button onClick={() => handleDelete(coupon.id)} className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
