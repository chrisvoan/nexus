import { navItem } from "@/components/dashboard/nav"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"

type PlaceholderPageProps = {
  href: string
  description: string
  phase: string
}

export function PlaceholderPage({ href, description, phase }: PlaceholderPageProps) {
  const item = navItem(href)

  return (
    <>
      <PageHeader title={item.label} description={description} />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed px-8 py-12 text-center">
          <NavIcon item={item} className="size-10 rounded-lg [&_svg]:size-5" />
          <h2 className="font-medium">{item.label} is coming soon</h2>
          <p className="text-sm text-muted-foreground">
            This screen is built in {phase} of the roadmap.
          </p>
        </div>
      </div>
    </>
  )
}
