import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/types/database"

export type CurrentUser = {
  id: string
  email: string
  profile: Profile
}

// Deduplicated per request so layouts and pages can both call it.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()
  // Returning null here would loop: proxy sends signed-in users away from /login.
  if (!profile)
    throw new Error(
      "Signed in, but no profile row exists. Apply supabase/migrations/001_foundation.sql."
    )

  return { id: user.id, email: user.email ?? "", profile }
})

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.profile.role !== "admin") redirect("/missions")
  return user
}
