import { requireAdmin } from "@/lib/auth"

// proxy.ts already redirects non-admins; this is defense in depth. Admin route
// handlers and server actions must still call requireAdmin() themselves.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin()
  return children
}
