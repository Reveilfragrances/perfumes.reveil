import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy India — Reveil Fragrance',
  description:
    'Pan-India shipping policy for Reveil Fragrance. Free delivery on orders above ₹250 — ₹60 online / ₹80 COD on smaller orders. Delivered in 3–7 business days via Shiprocket.',
  keywords: [
    'Reveil shipping policy', 'perfume delivery India', 'free shipping perfume India',
    'cash on delivery perfume', 'pan India perfume delivery',
  ],
  alternates: { canonical: `${SITE_URL}/shipping` },
}

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
