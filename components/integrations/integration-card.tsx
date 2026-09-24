import { DetailCard } from "@/components/dashboard/detail-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type IntegrationCardProps = {
  icon: React.ReactNode
  title: string
  description: string
  /** Right-aligned status pill. Omit it while the status is unknown. */
  status?: { label: string; tone: "connected" | "idle" }
  children?: React.ReactNode
}

export function IntegrationCard({
  icon,
  title,
  description,
  status,
  children,
}: IntegrationCardProps) {
  return (
    <DetailCard
      icon={icon}
      title={title}
      description={description}
      badge={
        status && (
          <Badge
            className={cn(
              "h-6 px-2.5",
              status.tone === "connected"
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {status.label}
          </Badge>
        )
      }
    >
      {children}
    </DetailCard>
  )
}
