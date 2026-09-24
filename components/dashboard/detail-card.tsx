import Link from "next/link"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DetailCardProps = {
  /** Brand mark or icon tile, sized by the caller. */
  icon: React.ReactNode
  title: string
  description?: string | null
  /** Status pill, pinned to the top-right. */
  badge?: React.ReactNode
  /** When set, the whole card becomes a link. */
  href?: string
  className?: string
  /** Footer row — actions, metadata, a model pill. */
  children?: React.ReactNode
}

/**
 * The card shape shared by Integrations and Agents: icon top-left, title and
 * one- or two-line description beside it, status pill top-right, and an
 * optional footer row pinned to the bottom so cards in a grid line up.
 */
export function DetailCard({
  icon,
  title,
  description,
  badge,
  href,
  className,
  children,
}: DetailCardProps) {
  const card = (
    <Card
      className={cn(
        "h-full [--card-spacing:--spacing(5)]",
        href && "transition-colors group-hover/card-link:bg-muted/40",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start gap-4">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-base leading-snug font-semibold">
            {title}
          </div>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {badge && <span className="shrink-0">{badge}</span>}
      </CardHeader>
      {children && <CardContent className="mt-auto">{children}</CardContent>}
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className="group/card-link block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  )
}
