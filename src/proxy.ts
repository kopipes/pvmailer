import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isRsvpPage = request.nextUrl.pathname.startsWith('/rsvp/')
  const isRsvpApi = request.nextUrl.pathname.startsWith('/api/rsvp/')

  if (!token && !isLoginPage && !isRsvpPage && !isRsvpApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico).*)'],
}
