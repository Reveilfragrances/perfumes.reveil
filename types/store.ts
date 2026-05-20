export type Product = {
    id: string
    name: string
    slug: string
    price: number
    images: string[]
    category: string | null
    rating: number
    stock: number
    description?: string
    scent_profile?: {
        top: string
        heart: string
        base: string
    }
    technical_specs?: {
        volume?: string
        concentration?: string
        longevity?: string
        sizes?: string[]
    }
}

export type Collection = {
    id: string
    name: string
    type: string
    image_url: string
    price: number
    display_order: number
    created_at?: string
}
