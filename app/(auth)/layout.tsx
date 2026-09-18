import { NexusLogo } from "@/components/nexus-logo"

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <NexusLogo />
      {children}
    </div>
  )
}
