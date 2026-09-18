import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/types/database"
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/env"

const AUTH_ROUTES = ["/login", "/register"]

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  // Until env vars are set, keep everyone on the login page, which explains the setup.
  if (!isSupabaseConfigured()) {
    return isAuthRoute ? NextResponse.next() : redirectTo(request, "/login")
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getClaims — it refreshes the session.
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  // Carry any refreshed session cookies onto redirects, or the refresh is lost.
  const redirectWithSession = (pathname: string) => {
    const redirect = redirectTo(request, pathname)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!userId) return isAuthRoute ? response : redirectTo(request, "/login")
  if (isAuthRoute) return redirectWithSession("/")

  // Role routing happens here so it's a real 307 before any rendering; a
  // redirect() under loading.tsx would stream the skeleton first.
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  if (pathname === "/" || isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()
    const isAdmin = profile?.role === "admin"

    if (pathname === "/")
      return redirectWithSession(isAdmin ? "/admin/agents" : "/missions")
    if (!isAdmin) return redirectWithSession("/missions")
  }

  return response
}
