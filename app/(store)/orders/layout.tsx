import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export const metadata: Metadata = {
  title: 'My Orders — Track & Manage Perfume Orders | Reveil Fragrance',
  description:
    'Track your Reveil Fragrance orders, view past purchases, and download invoices. Real-time shipment tracking, secure delivery across India, cash on delivery support.',
  keywords: [
    'my orders Reveil', 'track perfume order India', 'Reveil order history',
    'perfume order tracking', 'view perfume invoice India',
  ],
  alternates: { canonical: `${SITE_URL}/orders` },
  openGraph: {
    title: 'My Orders — Reveil Fragrance India',
    description: 'Track and manage your Reveil Fragrance perfume orders. Real-time delivery updates, invoice downloads, and order history.',
    url: `${SITE_URL}/orders`,
    type: 'website',
    siteName: 'Reveil Fragrance',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary',
    title: 'My Orders — Reveil Fragrance',
    description: 'Track your perfume orders and view past purchases at Reveil Fragrance India.',
  },
}

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
