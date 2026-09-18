import {
  BarChart3,
  Building2,
  Cpu,
  Settings,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  // Two-tone tile: tinted background + saturated glyph.
  tone: string
}

export const mainNav: NavItem[] = [
  {
    href: "/missions",
    label: "Missions",
    icon: Target,
    tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
  {
    href: "/usage",
    label: "Usage",
    icon: BarChart3,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
]

export const adminNav: NavItem[] = [
  {
    href: "/admin/agents",
    label: "Agents",
    icon: Cpu,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    href: "/admin/company",
    label: "Company",
    icon: Building2,
    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    tone: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  },
  {
    href: "/admin/integrations",
    label: "Integrations",
    icon: Workflow,
    tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
]

export const settingsNav: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
  tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
}

export const allNav = [...mainNav, ...adminNav, settingsNav]

export function navItem(href: string) {
  const item = allNav.find((entry) => entry.href === href)
  if (!item) throw new Error(`Unknown nav item: ${href}`)
  return item
}
