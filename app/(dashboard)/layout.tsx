import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()

  const supabase = await createClient()
  const { data: squadRows } = await supabase
    .from("user_agents")
    .select("agents(id, name, archived_at)")
    .eq("user_id", user.id)
  const squad = (squadRows ?? [])
    .flatMap((row) =>
      row.agents && !row.agents.archived_at ? [row.agents] : []
    )
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <SidebarProvider>
      <AppSidebar
        role={user.profile.role}
        displayName={user.profile.display_name || user.email}
        email={user.email}
        avatarUrl={user.profile.avatar_url}
        squad={squad}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
