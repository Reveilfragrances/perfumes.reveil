import type { Metadata } from "next";
import localFont from 'next/font/local'
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { ALL_KEYWORDS, SITE_URL, SITE_NAME, BRAND_NAME, LEGAL_NAME } from "@/lib/seo/keywords";
import { organizationSchema, websiteSchema, localBusinessSchema, siteNavigationElementSchema } from "@/lib/seo/schema";

const bungee = localFont({
  src: '../public/fonts/Bungee-Regular.woff2',
  variable: '--font-bungee',
})

const bungeeHairline = localFont({
  src: '../public/fonts/BungeeHairline-Regular.woff2',
  variable: '--font-bungee-hairline',
})

const markoOne = localFont({
  src: '../public/fonts/MarkoOne-Regular.woff2',
  variable: '--font-marko-one',
})

const baskerville = localFont({
  src: '../public/fonts/LibreBaskerville-VariableFont_wght.woff2',
  variable: '--font-baskerville',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Reveil Fragrance: Luxury Perfumes Online India | Free Shipping & COD",
    template: "%s | Reveil Fragrance"
  },
  description:
    "✨ Shop India's finest long-lasting perfumes from ₹499. Men's & women's eau de parfum, authentic Arabian attars, premium oudh. 100% original. Free shipping ₹250+. Cash on Delivery. Same-day dispatch.",
  keywords: ALL_KEYWORDS as unknown as string[],
  authors: [{ name: `${BRAND_NAME} Studio` }],
  creator: BRAND_NAME,
  publisher: LEGAL_NAME,
  applicationName: SITE_NAME,
  category: 'Shopping',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: SITE_URL,
  },
  // Explicit icon declarations so Google search results show the favicon next
  // to the listing. Google specifically needs a multipurpose icon set at known
  // paths AND it must be square + high contrast + at least 48x48 PNG.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#d4af37' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Reveil Fragrance — Buy Luxury Perfumes Online India",
    description:
      "Long-lasting luxury perfumes, Arabian attars, and premium oudh. Best perfumes for men & women in India. Cash on delivery. Free shipping above ₹250.",
    images: [
      {
        url: "/luxury_perfume_hero_png_1775752819988.png",
        width: 1200,
        height: 630,
        alt: "Reveil Fragrance — Luxury Perfumes India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reveil Fragrance — Luxury Perfumes Online India",
    description:
      "Shop original long-lasting perfumes, authentic attars, and premium oudh from Reveil. Cash on delivery across India.",
    creator: "@reveilfragrance",
    images: ["/luxury_perfume_hero_png_1775752819988.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here when you set up GSC.
    // google: 'paste-your-verification-code-here',
  },
  other: {
    'geo.region': 'IN-OR',
    'geo.placename': 'Brahmapur, Odisha',
    'geo.position': '19.3149;84.7941',
    'ICBM': '19.3149, 84.7941',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sitewide JSON-LD — Organization + WebSite + LocalBusiness + SiteNavigation
  // Google reads these to populate the knowledge panel, sitelinks search box, and local pack.
  const sitewideSchema = [
    organizationSchema(),
    websiteSchema(),
    localBusinessSchema(),
    siteNavigationElementSchema(),
  ]

  return (
    <html
      lang="en-IN"
      className={`${bungee.variable} ${bungeeHairline.variable} ${markoOne.variable} ${baskerville.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="canonical" href={SITE_URL} />
        <meta name="theme-color" content="#d4af37" />
        <meta name="format-detection" content="telephone=no" />
        {/* Explicit favicon links — Next.js auto-emits from metadata.icons,
            but Google occasionally needs the raw <link rel="icon"> tags to
            confidently associate the favicon with the search result. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sitewideSchema) }}
        />
      </head>
      <body className="antialiased selection:bg-black selection:text-white" suppressHydrationWarning>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
