"use server"

import { revalidatePath } from "next/cache"

import { getAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/database"

type ActionResult = { ok: true } | { error: string }

function revalidateUser(userId: string) {
  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${userId}`)
  // The assigned user's sidebar lists their squad.
  revalidatePath("/", "layout")
}

export async function setAgentAssignment(
  userId: string,
  agentId: string,
  assigned: boolean
): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can assign agents." }

  const supabase = await createClient()

  if (assigned) {
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .is("archived_at", null)
      .maybeSingle()
    if (!agent) return { error: "Agent not found or archived." }

    const { error } = await supabase
      .from("user_agents")
      .upsert(
        { user_id: userId, agent_id: agentId, assigned_by: admin.id },
        { onConflict: "user_id,agent_id", ignoreDuplicates: true }
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("user_agents")
      .delete()
      .eq("user_id", userId)
      .eq("agent_id", agentId)
    if (error) return { error: error.message }
  }

  revalidateUser(userId)
  return { ok: true }
}

export async function setUserRole(
  userId: string,
  role: UserRole
): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { error: "Only admins can change roles." }
  if (role !== "admin" && role !== "user") return { error: "Unknown role." }
  // Prevents the last admin from locking everyone out.
  if (userId === admin.id) return { error: "You can't change your own role." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id")
  if (error) return { error: error.message }
  if (!data?.length) return { error: "User not found." }

  revalidateUser(userId)
  return { ok: true }
}
