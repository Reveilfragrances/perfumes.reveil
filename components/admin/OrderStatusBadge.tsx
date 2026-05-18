import React from 'react'

const statusStyles: Record<string, { bg: string, text: string, label: string }> = {
    pending: { bg: '#fffbeb', text: '#92400e', label: 'Pending' },
    processing: { bg: '#fffbeb', text: '#92400e', label: 'Processing' },
    confirmed: { bg: '#f0f9ff', text: '#075985', label: 'Confirmed' },
    shipped: { bg: '#f5f3ff', text: '#5b21b6', label: 'Shipped' },
    'in transit': { bg: '#fdf4ff', text: '#701a75', label: 'In Transit' },
    'out for delivery': { bg: '#ecfeff', text: '#155e75', label: 'Out for Delivery' },
    delivered: { bg: '#f0fdf4', text: '#166534', label: 'Delivered' },
    cancelled: { bg: '#fef2f2', text: '#991b1b', label: 'Cancelled' },
    returned: { bg: '#fef2f2', text: '#991b1b', label: 'Returned' },
    'return initiated': { bg: '#fef2f2', text: '#991b1b', label: 'Return Initiated' },
    'delivery failed': { bg: '#fef2f2', text: '#991b1b', label: 'Delivery Failed' },
}

export default function OrderStatusBadge({ status }: { status: string }) {
    const key = (status || '').toLowerCase()
    const style = statusStyles[key] || { bg: '#f1f5f9', text: '#475569', label: status }

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            backgroundColor: style.bg,
            color: style.text,
            border: `1px solid ${style.text}25`,
            whiteSpace: 'nowrap'
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: style.text,
                marginRight: '8px',
                boxShadow: `0 0 0 3px ${style.text}15`
            }} />
            {style.label}
        </span>
    )
}
