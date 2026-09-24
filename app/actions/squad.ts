"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { CUSTOM_INSTRUCTIONS_LIMIT } from "@/lib/missions/types"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/utils"

export type CustomInstructionsState =
  // `saved` is what is now stored, so the form knows when it is dirty.
  | { error?: string; message?: string; saved?: string }
  | undefined

export async function updateCustomInstructions(
  agentId: string,
  _state: CustomInstructionsState,
  formData: FormData
): Promise<CustomInstructionsState> {
  const user = await getCurrentUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  if (!isUuid(agentId)) return { error: "Agent not found." }

  const instructions = String(formData.get("customInstructions") ?? "").trim()
  if (instructions.length > CUSTOM_INSTRUCTIONS_LIMIT)
    return {
      error: `Instructions must be ${CUSTOM_INSTRUCTIONS_LIMIT.toLocaleString()} characters or fewer.`,
    }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_agents")
    .update({ custom_instructions: instructions || null })
    .eq("user_id", user.id)
    .eq("agent_id", agentId)
    .select("agent_id")
  if (error) return { error: error.message }
  // No row back means the agent isn't assigned, or RLS refused the update
  // because migration 007 hasn't been applied.
  if (!data?.length)
    return {
      error: "Couldn't save. The agent may have left your squad, or migration 007 hasn't been applied.",
    }

  revalidatePath(`/squad/${agentId}`)
  return {
    message: instructions ? "Instructions saved." : "Instructions cleared.",
    saved: instructions,
  }
}
