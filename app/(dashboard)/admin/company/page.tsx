import type { Metadata } from "next"

import { CompanyForm } from "@/components/company/company-form"
import { PageHeader } from "@/components/dashboard/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Company" }

export default async function CompanyPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: company } = await supabase
    .from("company_settings")
    .select(
      "company_name, company_overview, brand_voice, reusable_instructions, updated_by, updated_at"
    )
    .maybeSingle()

  return (
    <>
      <PageHeader
        title="Company"
        description="Context every agent works from."
      />
      <div className="max-w-4xl p-4 md:p-6">
        <CompanyForm
          profile={{
            company_name: company?.company_name ?? null,
            company_overview: company?.company_overview ?? null,
            brand_voice: company?.brand_voice ?? null,
            reusable_instructions: company?.reusable_instructions ?? null,
          }}
          updatedAt={company?.updated_by ? company.updated_at : null}
        />
      </div>
    </>
  )
}
