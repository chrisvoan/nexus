import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/types/database"

export const metadata: Metadata = { title: "Users" }

type UserRow = Pick<
  Profile,
  "id" | "display_name" | "email" | "role" | "created_at"
> & {
  user_agents: { agents: { name: string; archived_at: string | null } | null }[]
}

export default async function UsersPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select(
      // user_agents references profiles twice (user_id, assigned_by); name the FK.
      "id, display_name, email, role, created_at, user_agents!user_agents_user_id_fkey(agents(name, archived_at))"
    )
    .order("created_at")
  if (error) throw new Error(error.message)

  const users = data as unknown as UserRow[]

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage roles and each employee's squad of agents."
      />
      <div className="p-4 md:p-6">
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const squad = user.user_agents
                  .map((entry) => entry.agents)
                  .filter((agent) => agent && !agent.archived_at)
                  .map((agent) => agent!.name)
                  .sort()
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">
                        {user.display_name || user.email || "Unnamed user"}
                      </div>
                      {user.display_name && user.email && (
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                        className="capitalize"
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-muted-foreground">
                      {squad.length ? squad.join(", ") : "No agents"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        Manage
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
