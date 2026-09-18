"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string; message?: string } | undefined

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? "").trim(),
  }
}

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData)
  if (!email || !password) return { error: "Email and password are required." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect("/")
}

export async function register(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password, displayName } = readCredentials(formData)
  if (!email || !password) return { error: "Email and password are required." }
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`,
    },
  })
  if (error) return { error: error.message }

  // Email confirmation enabled: no session until the link is clicked.
  if (!data.session)
    return { message: "Check your email to confirm your account, then sign in." }

  redirect("/")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
