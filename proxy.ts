import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/shared/') || pathname === '/login') {
    return NextResponse.next()
  }
  if (pathname.startsWith('/api/files/') && request.nextUrl.searchParams.has('share')) return NextResponse.next()

  // Public shared-note reads are capability links with an unguessable token.
  if (pathname === '/' && request.nextUrl.searchParams.has('share')) return NextResponse.next()

  // Local development keeps the existing no-auth workflow. Production always requires OAuth.
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Authentication is not configured for this deployment.' }, { status: 503 })
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (token?.sub) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|woff2?)$).*)'],
}
