import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { agentIconFor } from "@/components/agents/agent-icon"
import { CustomInstructionsForm } from "@/components/agents/custom-instructions-form"
import { ModelPill } from "@/components/agents/model-pill"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"
import { OutputIcon } from "@/components/missions/output-icon"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth"
import { formatMissionDate } from "@/lib/missions/types"
import { createClient } from "@/lib/supabase/server"
import { cn, isUuid } from "@/lib/utils"

export const metadata: Metadata = { title: "Agent" }

export default async function SquadAgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const user = await requireUser()
  const supabase = await createClient()
  const [{ data: assignment }, { data: missions }] = await Promise.all([
    supabase
      .from("user_agents")
      .select("custom_instructions, created_at, agents(id, name, description, model, archived_at)")
      .eq("user_id", user.id)
      .eq("agent_id", id)
      .maybeSingle(),
    supabase
      .from("missions")
      .select("id, title, status, output_type, created_at")
      .eq("user_id", user.id)
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ])
  const agent = assignment?.agents
  if (!assignment || !agent || agent.archived_at) notFound()

  return (
    <>
      <PageHeader
        title={agent.name}
        description="In your squad"
        actions={
          <Link
            href="/missions"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Missions
            <ChevronRight />
          </Link>
        }
      />
      <div className="grid max-w-5xl gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Custom instructions</CardTitle>
            <CardDescription>
              Your personal guidance for {agent.name}, added to every mission
              you give it. Only you see these; the rest of your team is
              unaffected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomInstructionsForm
              agentId={agent.id}
              initialValue={assignment.custom_instructions ?? ""}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-start gap-4">
              <NavIcon
                item={agentIconFor(agent.name)}
                className="size-10 shrink-0 rounded-lg [&_svg]:size-5"
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">{agent.name}</CardTitle>
                <CardDescription>
                  {agent.description || "No description yet."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
                <dt className="text-muted-foreground">Model</dt>
                <dd>
                  <ModelPill model={agent.model} />
                </dd>
                <dt className="text-muted-foreground">In squad since</dt>
                <dd suppressHydrationWarning>
                  {formatMissionDate(assignment.created_at)}
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent missions</CardTitle>
            </CardHeader>
            <CardContent>
              {missions?.length ? (
                <ul className="-mx-2 flex flex-col">
                  {missions.map((mission) => (
                    <li key={mission.id}>
                      <Link
                        href={`/missions/${mission.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                      >
                        <OutputIcon
                          type={mission.output_type}
                          className="size-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {mission.title}
                        </span>
                        <span
                          className="shrink-0 text-xs text-muted-foreground"
                          suppressHydrationWarning
                        >
                          {formatMissionDate(mission.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No missions with {agent.name} yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
