import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AgentAssignmentList } from "@/components/users/agent-assignment-list"
import { RoleSelect } from "@/components/users/role-select"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cn, isUuid } from "@/lib/utils"

export const metadata: Metadata = { title: "Manage user" }

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const admin = await requireAdmin()
  const supabase = await createClient()
  const [{ data: user }, { data: agents }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("agents")
        .select("id, name, description")
        .is("archived_at", null)
        .order("name"),
      supabase.from("user_agents").select("agent_id").eq("user_id", id),
    ])
  if (!user) notFound()

  const assigned = new Set(assignments?.map((row) => row.agent_id))
  const isSelf = user.id === admin.id
  const title = user.display_name || user.email || "Unnamed user"

  return (
    <>
      <PageHeader
        title={title}
        description={user.display_name ? (user.email ?? undefined) : undefined}
        actions={
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ChevronLeft />
            All users
          </Link>
        }
      />
      <div className="flex max-w-3xl flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>
              {isSelf
                ? "You can't change your own role."
                : "Admins configure agents, the company, users, and integrations."}
            </CardDescription>
            <CardAction>
              <RoleSelect userId={user.id} role={user.role} disabled={isSelf} />
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>My Squad</CardTitle>
            <CardDescription>
              Agents this person can run missions with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentAssignmentList
              userId={user.id}
              agents={(agents ?? []).map((agent) => ({
                ...agent,
                assigned: assigned.has(agent.id),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
