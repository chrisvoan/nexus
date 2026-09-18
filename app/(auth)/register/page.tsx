import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Create account" }

export default function RegisterPage() {
  return <AuthForm mode="register" configured={isSupabaseConfigured()} />
}
