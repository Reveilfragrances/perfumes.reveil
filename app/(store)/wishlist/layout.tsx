import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export const metadata: Metadata = {
  title: 'My Wishlist — Saved Luxury Perfumes | Reveil Fragrance India',
  description:
    'View your saved luxury perfumes, authentic attars, premium oudh, and home fragrances at Reveil Fragrance. Keep track of your favourite scents and complete your purchase later.',
  keywords: [
    'my wishlist Reveil', 'saved perfumes India', 'perfume wishlist',
    'favourite perfumes Reveil', 'save perfumes for later India',
  ],
  alternates: { canonical: `${SITE_URL}/wishlist` },
  openGraph: {
    title: 'My Wishlist — Reveil Fragrance India',
    description: 'Your saved luxury perfumes, attars, and home fragrances at Reveil Fragrance. Pick up where you left off.',
    url: `${SITE_URL}/wishlist`,
    type: 'website',
    siteName: 'Reveil Fragrance',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary',
    title: 'My Wishlist — Reveil Fragrance',
    description: 'View your saved luxury perfumes and complete your purchase at Reveil Fragrance India.',
  },
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
