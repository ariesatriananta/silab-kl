import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"
import { getDashboardAccessRedirect } from "@/lib/auth/access-policy"

export default withAuth(
  function proxy(req) {
    const tokenRole = req.nextauth.token?.role
    const mustChangePassword = req.nextauth.token?.mustChangePassword
    const pathname = req.nextUrl.pathname
    const redirectPath = getDashboardAccessRedirect({
      role: tokenRole as "admin" | "mahasiswa" | "petugas_plp" | undefined,
      pathname,
      mustChangePassword: Boolean(mustChangePassword),
    })

    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, req.url))
    }

    return NextResponse.next()
  },
  {
    secret: process.env.AUTH_SECRET,
    pages: {
      signIn: "/",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export const config = {
  matcher: ["/dashboard/:path*"],
}
