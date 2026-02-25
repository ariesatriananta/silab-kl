import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    const tokenRole = req.nextauth.token?.role
    const mustChangePassword = req.nextauth.token?.mustChangePassword
    const pathname = req.nextUrl.pathname

    if (mustChangePassword) {
      if (pathname !== "/dashboard/account/security") {
        return NextResponse.redirect(new URL("/dashboard/account/security", req.url))
      }
      return NextResponse.next()
    }

    if (tokenRole === "mahasiswa") {
      if (pathname === "/dashboard") {
        return NextResponse.redirect(new URL("/dashboard/student-tools", req.url))
      }

      if (pathname !== "/dashboard/student-tools" && pathname !== "/dashboard/account/security") {
        return NextResponse.redirect(new URL("/dashboard/student-tools", req.url))
      }
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
