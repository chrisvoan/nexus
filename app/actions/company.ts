"use server"

import { revalidatePath } from "next/cache"

import { getAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { COMPANY_FIELDS, type CompanyProfile } from "@/lib/company-context"

export type CompanyFormState = { error?: string; message?: string } | undefined

export async function saveCompanySettings(
  _state: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can edit company settings." }

  const companyName = String(formData.get("companyName") ?? "").trim()
  if (companyName.length > 200)
    return { error: "Company name must be 200 characters or fewer." }

  const update: CompanyProfile = {
    company_name: companyName || null,
    company_overview: null,
    brand_voice: null,
    reusable_instructions: null,
  }

  for (const field of COMPANY_FIELDS) {
    const value = String(formData.get(field.name) ?? "").trim()
    if (value.length > field.limit)
      return {
        error: `${field.label} must be ${field.limit.toLocaleString()} characters or fewer.`,
      }
    update[field.key] = value || null
  }

  const supabase = await createClient()
  const row = { ...update, updated_by: admin.id }
  const { data, error } = await supabase
    .from("company_settings")
    .update(row)
    .eq("id", true)
    .select("id")
  if (error) return { error: error.message }

  // The singleton row is seeded by migration 002, but recreate it rather than
  // silently saving nothing if it ever goes missing (needs migration 004).
  if (!data?.length) {
    const { error: insertError } = await supabase
      .from("company_settings")
      .insert({ id: true, ...row })
    if (insertError) return { error: insertError.message }
  }

  revalidatePath("/admin/company")
  return { message: "Company settings saved." }
}
