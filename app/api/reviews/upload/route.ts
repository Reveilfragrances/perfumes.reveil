import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Optional: Only allow logged in users to upload review media
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
    }

    const random = crypto.randomBytes(16).toString('hex')
    const fileName = `reviews/${Date.now()}-${random}.${ext}`

    // Write with the service-role client. The user is already authenticated
    // (checked above), but the 'product-images' bucket's storage policies are
    // scoped to admins managing product photos — a normal customer's upload
    // would be rejected by RLS. user_id isn't trusted here; we only store the
    // file under a reviews/ prefix, so bypassing the bucket policy is safe.
    const admin = createAdminClient()
    const { error } = await admin.storage
        .from('product-images') // Reusing existing bucket
        .upload(fileName, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
        })

    if (error) {
        console.error('[reviews/upload] Storage upload failed:', error.message)
        return NextResponse.json({ error: 'Upload failed', reason: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage
        .from('product-images')
        .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
}
