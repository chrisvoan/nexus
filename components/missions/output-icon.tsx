import type { MissionOutputType } from "@/lib/types/database"
import { outputTypeLabel } from "@/lib/missions/types"
import { cn } from "@/lib/utils"

const PAGE = "M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
const FOLD = "M14 2v5h5z"

const COLORS: Record<MissionOutputType, { page: string; fold: string }> = {
  doc: { page: "#4285F4", fold: "#A1C2FA" },
  sheet: { page: "#0F9D58", fold: "#87CEAC" },
  pdf: { page: "#EA4335", fold: "#F6AEA9" },
}

// Google-style file marks for the three output formats. Inline so they stay
// crisp at card size and in both themes.
export function OutputIcon({
  type,
  className,
}: {
  type: MissionOutputType
  className?: string
}) {
  const color = COLORS[type]
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={outputTypeLabel(type)}
      className={cn("size-5 shrink-0", className)}
    >
      <path fill={color.page} d={PAGE} />
      <path fill={color.fold} d={FOLD} />
      {type === "sheet" ? (
        <g fill="none" stroke="#fff" strokeWidth="1.3">
          <rect x="7.5" y="11" width="9" height="7" rx=".4" />
          <path d="M12 11v7M7.5 14.5h9" />
        </g>
      ) : type === "pdf" ? (
        <text
          x="12"
          y="17.6"
          fill="#fff"
          fontSize="5.4"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
        >
          PDF
        </text>
      ) : (
        <g fill="#fff">
          <rect x="7.5" y="11" width="9" height="1.3" rx=".4" />
          <rect x="7.5" y="13.8" width="9" height="1.3" rx=".4" />
          <rect x="7.5" y="16.6" width="6" height="1.3" rx=".4" />
        </g>
      )}
    </svg>
  )
}
