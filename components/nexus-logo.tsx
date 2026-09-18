import { cn } from "@/lib/utils"

// The PNG is used as a mask so the mark takes the current text color and
// stays visible on dark tiles and in dark mode.
export function NexusMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 bg-current [mask-image:url(/nexus-icon.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className
      )}
    />
  )
}

export function NexusLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <NexusMark className="size-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">Nexus</span>
    </div>
  )
}
