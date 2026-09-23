import type { CompanySettings } from "@/lib/types/database"

export type CompanyProfile = Pick<
  CompanySettings,
  "company_name" | "company_overview" | "brand_voice" | "reusable_instructions"
>

// One definition of each field, shared by the Company form, prompt generation,
// and (Phase 4) the mission kickoff message, so the headings agents see always
// match what admins were editing.
export const COMPANY_FIELDS = [
  {
    key: "company_overview",
    name: "companyOverview",
    label: "About the company",
    heading: "About the company",
    description:
      "What the company does, its products, and who it sells to. Gives agents the background a new hire would get.",
    placeholder:
      "Northwind Robotics builds warehouse automation for mid-size distributors…",
    limit: 50_000,
  },
  {
    key: "brand_voice",
    name: "brandVoice",
    label: "Brand voice",
    heading: "Brand voice",
    description:
      "Tone and style rules for anything an agent writes: how the company sounds, and what it avoids.",
    placeholder:
      "Plain-spoken and concrete. Lead with the result.\nNo exclamation marks, no hype words (revolutionary, game-changing)…",
    limit: 20_000,
  },
  {
    key: "reusable_instructions",
    name: "reusableInstructions",
    label: "Standing instructions",
    heading: "Standing instructions",
    description:
      "Rules every agent follows on every mission, on top of its own system prompt: formatting, approvals, things never to claim.",
    placeholder:
      "Use British English.\nNever quote prices or delivery dates — link to the pricing page instead.\nEnd longer documents with a short summary…",
    limit: 20_000,
  },
] as const satisfies readonly {
  key: keyof CompanyProfile
  name: string
  label: string
  heading: string
  description: string
  placeholder: string
  limit: number
}[]

export function hasCompanyProfile(profile: Partial<CompanyProfile> | null) {
  if (!profile) return false
  return COMPANY_FIELDS.some((field) => Boolean(profile[field.key]?.trim()))
}

// The markdown block agents receive verbatim. Empty fields are left out
// entirely rather than sent as empty headings.
export function composeCompanyContext(profile: Partial<CompanyProfile> | null) {
  if (!profile) return ""

  const name = profile.company_name?.trim()
  const sections = COMPANY_FIELDS.flatMap((field) => {
    const value = profile[field.key]?.trim()
    if (!value) return []
    const heading =
      field.key === "company_overview" && name ? `About ${name}` : field.heading
    return [`## ${heading}\n\n${value}`]
  })

  return sections.join("\n\n")
}
