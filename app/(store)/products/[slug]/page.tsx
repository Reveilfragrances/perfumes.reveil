import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProductContent } from './ProductContent'
import { notFound } from 'next/navigation'
import { SITE_URL, BRAND_NAME, keywordsForProduct } from '@/lib/seo/keywords'
import { breadcrumbSchema } from '@/lib/seo/schema'

interface Props {
    params: Promise<{ slug: string }>
}

// ── DYNAMIC METADATA ────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createClient()

    const { data: product } = await supabase
        .from('products')
        .select('name, description, category, images, price, slug')
        .eq('slug', slug)
        .single()

    if (!product) {
        return {
            title: { absolute: 'Product Not Found | Reveil Fragrance' },
            robots: { index: false, follow: false },
        }
    }

    const title = `${product.name} — Buy Online India | ${product.category || 'Luxury Perfume'} | Reveil Fragrance`
    const description = product.description
        ? `${product.description.slice(0, 140)} — Buy ${product.name} online in India at ₹${product.price}. Long lasting, original, free shipping above ₹250.`
        : `Buy ${product.name} online in India at Reveil Fragrance. Long lasting ${product.category?.toLowerCase() || 'perfume'} — ₹${product.price}. Original product, cash on delivery, pan-India delivery.`

    const rawImage = product.images?.[0] || '/luxury_perfume_hero_png_1775752819988.png'
    const image = /^https?:\/\//i.test(rawImage) ? rawImage : `${SITE_URL}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
    const url = `${SITE_URL}/products/${product.slug}`

    return {
        title: { absolute: title },
        description,
        keywords: keywordsForProduct(product.name, product.category),
        openGraph: {
            title,
            description,
            type: 'website',
            url,
            siteName: 'Reveil Fragrance',
            locale: 'en_IN',
            images: [{ url: image, width: 1200, height: 1200, alt: product.name }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
        alternates: { canonical: url },
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
        },
        other: {
            'product:price:amount': String(product.price),
            'product:price:currency': 'INR',
            'product:brand': BRAND_NAME,
            'product:availability': 'instock',
        },
    }
}

// ── SERVER PAGE ──────────────────────────────────────────────────────────────
export default async function ProductExperiencePage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Fetch Product
    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error || !product) {
        notFound()
    }

    // 2. Fetch Reviews — exclude reviews authored by admins (test/seeded entries)
    const { data: allReviews } = await adminClient
        .from('reviews')
        .select(`
            id,
            rating,
            comment,
            created_at,
            reviewer_name,
            reviewer_avatar,
            heading,
            media_urls,
            user_id,
            profiles ( first_name, last_name, role )
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })

    const reviews = (allReviews ?? []).filter((r: any) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        if (profile?.role === 'admin') return false
        // Heuristic fallback for seeded test data where the role flag may not
        // be set: hide reviews whose reviewer_name signals admin/test entries.
        const name = (r.reviewer_name || '').toLowerCase()
        if (name.includes('admin') || name.includes('test')) return false
        return true
    })

    // 3. Fetch related products — same category first, then top up with others
    const { data: sameCategory } = await supabase
        .from('products')
        .select('id, name, slug, price, images, category, rating, stock')
        .eq('category', product.category)
        .neq('id', product.id)
        .gt('stock', 0)
        .limit(8)

    let related = sameCategory ?? []
    if (related.length < 4) {
        const { data: filler } = await supabase
            .from('products')
            .select('id, name, slug, price, images, category, rating, stock')
            .neq('id', product.id)
            .gt('stock', 0)
            .limit(8 - related.length)
        related = [...related, ...(filler ?? [])]
    }

    // 3. Build rich Product + BreadcrumbList JSON-LD
    const productUrl = `${SITE_URL}/products/${product.slug}`
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.images,
        sku: product.slug,
        mpn: product.id,
        category: product.category,
        brand: {
            '@type': 'Brand',
            name: BRAND_NAME,
        },
        offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'INR',
            availability: product.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: productUrl,
            priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            seller: {
                '@type': 'Organization',
                name: BRAND_NAME,
            },
            shippingDetails: {
                '@type': 'OfferShippingDetails',
                shippingRate: {
                    '@type': 'MonetaryAmount',
                    value: product.price >= 250 ? 0 : 60,
                    currency: 'INR',
                },
                shippingDestination: {
                    '@type': 'DefinedRegion',
                    addressCountry: 'IN',
                },
                deliveryTime: {
                    '@type': 'ShippingDeliveryTime',
                    handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
                    transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' },
                },
            },
        },
        ...(reviews && reviews.length > 0 && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating || 5,
                reviewCount: reviews.length,
                bestRating: 5,
                worstRating: 1,
            },
            review: reviews.slice(0, 5).map((r: any) => ({
                '@type': 'Review',
                reviewRating: {
                    '@type': 'Rating',
                    ratingValue: r.rating,
                    bestRating: 5,
                },
                author: {
                    '@type': 'Person',
                    name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : 'Verified Buyer',
                },
                reviewBody: r.comment,
            })),
        }),
    }

    const breadcrumb = breadcrumbSchema([
        { name: 'Home', url: SITE_URL },
        { name: 'Shop', url: `${SITE_URL}/products` },
        ...(product.category
            ? [{ name: product.category, url: `${SITE_URL}/products?category=${product.category}` }]
            : []),
        { name: product.name, url: productUrl },
    ])

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify([productSchema, breadcrumb]) }}
            />
            {/* Hidden SEO content — keywords-rich product copy crawlable by Google */}
            <div className="sr-only">
                <h1>{`Buy ${product.name} Online India — ${product.category || 'Luxury Perfume'} | ₹${product.price} | Reveil Fragrance`}</h1>
                <h2>{`${product.name} Price India — Long Lasting, Original, Cash on Delivery`}</h2>
                <p>
                    {`${product.name} is a long-lasting ${product.category?.toLowerCase() || 'fragrance'} from the Reveil collection, available online in India at ₹${product.price}. Free shipping above ₹250. Cash on delivery available pan-India. 100% original product.`}
                </p>
            </div>
            <ProductContent product={product} initialReviews={reviews || []} relatedProducts={related} />
        </>
    )
}
