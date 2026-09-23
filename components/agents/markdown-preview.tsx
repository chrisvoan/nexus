import ReactMarkdown from "react-markdown"

import { cn } from "@/lib/utils"

export function MarkdownPreview({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  if (!content.trim())
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Nothing to preview yet.
      </p>
    )

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold",
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
