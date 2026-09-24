"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Check, Copy, Pencil } from "lucide-react"

import { MissionDialog } from "@/components/missions/mission-dialog"
import { Button } from "@/components/ui/button"
import type { DriveTarget } from "@/lib/drive/types"
import type { MissionSummary, SquadAgent } from "@/lib/missions/types"

/** Edit (and delete, from inside the dialog) for a mission that hasn't run. */
export function EditMissionButton({
  mission,
  squad,
  driveTarget,
}: {
  mission: MissionSummary
  squad: SquadAgent[]
  driveTarget: DriveTarget | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <MissionDialog
        open={open}
        onOpenChange={setOpen}
        squad={squad}
        driveTarget={driveTarget}
        mission={mission}
        onDeleted={() => router.push("/missions")}
      />
    </>
  )
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      // Clipboard access denied (insecure origin or browser setting).
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  )
}
