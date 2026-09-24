import type { Metadata } from "next"
import Link from "next/link"

import { navItem } from "@/components/dashboard/nav"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { PageHeader } from "@/components/dashboard/page-header"
import { MissionBoard } from "@/components/missions/mission-board"
import { NewMissionButton } from "@/components/missions/new-mission-button"
import { requireUser } from "@/lib/auth"
import { getOutputDrive } from "@/lib/drive/connection"
import { listMissions, getSquad } from "@/lib/missions/queries"
import { failStaleMissions } from "@/lib/missions/run"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Missions" }

// Run is a Server Action on this page; its Claude session finishes in
// `after()`, which is bounded by this limit (see RUN_BUDGET_MS).
export const maxDuration = 300

export default async function MissionsPage() {
  const user = await requireUser()
  await failStaleMissions(await createClient(), user.id)

  const [missions, squad, drive] = await Promise.all([
    listMissions(user.id),
    getSquad(user.id),
    getOutputDrive(user.id),
  ])

  return (
    <>
      <PageHeader
        title="Missions"
        description="Assign work to your squad and track progress."
        actions={
          <NewMissionButton
            squad={squad}
            driveTarget={drive?.target ?? null}
          />
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {squad.length === 0 && (
          <EmptySquadNotice isAdmin={user.profile.role === "admin"} />
        )}
        <MissionBoard
          missions={missions}
          squad={squad}
          driveTarget={drive?.target ?? null}
        />
      </div>
    </>
  )
}

function EmptySquadNotice({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed p-4">
      <NavIcon
        item={navItem("/missions")}
        className="size-10 rounded-lg [&_svg]:size-5"
      />
      <div className="text-sm">
        <p className="font-medium">No agents in your squad yet</p>
        <p className="text-muted-foreground">
          {isAdmin ? (
            <>
              Assign yourself agents under{" "}
              <Link href="/admin/users" className="underline">
                Users
              </Link>{" "}
              to start briefing them.
            </>
          ) : (
            "An admin assigns agents to your squad. Once they do, you can brief them here."
          )}
        </p>
      </div>
    </div>
  )
}
