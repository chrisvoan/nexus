import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return <AuthForm mode="login" configured={isSupabaseConfigured()} />
}
