import { handleUpload } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { currentUserId } from '@/lib/session'

export const runtime = 'nodejs'

const MAX_VIDEO_BYTES = 120 * 1024 * 1024

export async function POST(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const body = await request.json()
  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const prefix = `uploads/${userId}/`
        if (!pathname.startsWith(prefix) || pathname.includes('..')) throw new Error('Invalid upload path.')
        return {
          allowedContentTypes: ['video/*', 'application/octet-stream'],
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId }),
        }
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload authorization failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
