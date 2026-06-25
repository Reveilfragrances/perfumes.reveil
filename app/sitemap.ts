import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/seo/keywords'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = await createClient()
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '')

    // 1. All product slugs — highest SEO value, weekly refresh. Include the
    //    primary product image so Google Images can index it (image sitemap).
    const { data: products } = await supabase
        .from('products')
        .select('slug, updated_at, images')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

    const productEntries: MetadataRoute.Sitemap = (products || []).map((product) => {
        const firstImage = Array.isArray(product.images) ? product.images[0] : undefined
        const absoluteImage = typeof firstImage === 'string' && /^https?:\/\//i.test(firstImage)
            ? firstImage
            : undefined
        return {
            url: `${baseUrl}/products/${product.slug}`,
            lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
            ...(absoluteImage ? { images: [absoluteImage] } : {}),
        }
    })

    // 2. Category landing pages — high-traffic listing pages
    const categories = [
        'PERFUMES',
        'DEODRANTS',
        'ATTARS',
        'AIRFRESHNER',
        'OUDH',
        'MUSK',
        'FLORAL',
    ]
    const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
        url: `${baseUrl}/products?category=${cat}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.85,
    }))

    // 3. Main public pages
    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/products`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.95,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/shipping`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/refund`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/track-order`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/orders`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/profile`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/wishlist`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
    ]

    return [...staticEntries, ...categoryEntries, ...productEntries]
}
