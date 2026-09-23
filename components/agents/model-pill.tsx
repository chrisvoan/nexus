import { cn } from "@/lib/utils"

// claude-sonnet-4-6 → SONNET-4-6; dated ids drop the snapshot suffix.
export function formatModelLabel(model: string) {
  return model
    .replace(/^claude-/, "")
    .replace(/-\d{8}$/, "")
    .toUpperCase()
}

export function ModelPill({
  model,
  className,
}: {
  model: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground",
        className
      )}
    >
      {formatModelLabel(model)}
    </span>
  )
}
