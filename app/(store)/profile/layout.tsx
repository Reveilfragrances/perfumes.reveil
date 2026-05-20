import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export const metadata: Metadata = {
  title: 'My Account & Profile — Reveil Fragrance India',
  description:
    'Manage your Reveil Fragrance account. Update your profile, saved addresses, payment preferences, and personal details for a seamless luxury perfume shopping experience.',
  keywords: [
    'my account Reveil', 'Reveil profile', 'manage perfume account India',
    'Reveil saved addresses', 'Reveil login account',
  ],
  alternates: { canonical: `${SITE_URL}/profile` },
  openGraph: {
    title: 'My Account — Reveil Fragrance',
    description: 'Manage your Reveil Fragrance account, saved addresses, and personal preferences.',
    url: `${SITE_URL}/profile`,
    type: 'website',
    siteName: 'Reveil Fragrance',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary',
    title: 'My Account — Reveil Fragrance',
    description: 'Manage your Reveil Fragrance perfume account and preferences.',
  },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
