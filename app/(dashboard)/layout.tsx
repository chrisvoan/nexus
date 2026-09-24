import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"
import { getSquad } from "@/lib/missions/queries"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()
  const squad = await getSquad(user.id)

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
