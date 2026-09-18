import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()

  return (
    <SidebarProvider>
      <AppSidebar
        role={user.profile.role}
        displayName={user.profile.display_name || user.email}
        email={user.email}
        avatarUrl={user.profile.avatar_url}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
