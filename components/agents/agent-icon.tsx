import {
  Bot,
  ChartLine,
  CircleDollarSign,
  Handshake,
  Megaphone,
  MessagesSquare,
  PenTool,
  Scale,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

// Agents are free-text named, so the role is guessed from the name. First match
// wins; add new roles above the fallback.
const ROLES: {
  match: RegExp
  icon: LucideIcon
  color: string
  tone: string
}[] = [
  {
    match: /social|community|comms/i,
    icon: MessagesSquare,
    color: "text-violet-500",
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    match: /marketing|brand|campaign|growth|advertis/i,
    icon: Megaphone,
    color: "text-amber-500",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    match: /financ|account|budget|revenue|invoic|payroll/i,
    icon: CircleDollarSign,
    color: "text-emerald-500",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    match: /sales|partner|deal|pipeline/i,
    icon: Handshake,
    color: "text-sky-500",
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    match: /legal|complian|policy|contract/i,
    icon: Scale,
    color: "text-slate-500",
    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
  {
    match: /research|analy|data|report|insight/i,
    icon: ChartLine,
    color: "text-cyan-500",
    tone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
  {
    match: /writ|editor|content|copy|blog/i,
    icon: PenTool,
    color: "text-rose-500",
    tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
]

const FALLBACK = {
  icon: Bot,
  color: "text-indigo-500",
  tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
}

// `tone` matches the NavItem shape so squad entries can reuse <NavIcon>.
export function agentIconFor(name: string) {
  return ROLES.find((role) => role.match.test(name)) ?? FALLBACK
}

export function AgentIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const role = agentIconFor(name)
  const Icon = role.icon
  return (
    <Icon
      aria-hidden
      strokeWidth={2.25}
      className={cn("size-6", role.color, className)}
    />
  )
}
