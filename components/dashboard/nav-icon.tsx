import type { NavItem } from "@/components/dashboard/nav"
import { cn } from "@/lib/utils"

export function NavIcon({
  item,
  className,
}: {
  item: Pick<NavItem, "icon" | "tone">
  className?: string
}) {
  const Icon = item.icon
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md",
        item.tone,
        className
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  )
}
