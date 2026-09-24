"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { MissionDialog } from "@/components/missions/mission-dialog"
import { Button } from "@/components/ui/button"
import type { DriveTarget } from "@/lib/drive/types"
import type { SquadAgent } from "@/lib/missions/types"

export function NewMissionButton({
  squad,
  driveTarget,
}: {
  squad: SquadAgent[]
  driveTarget: DriveTarget | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!squad.length}
        title={squad.length ? undefined : "No agents in your squad yet"}
      >
        <Plus />
        New mission
      </Button>
      <MissionDialog
        open={open}
        onOpenChange={setOpen}
        squad={squad}
        driveTarget={driveTarget}
      />
    </>
  )
}
