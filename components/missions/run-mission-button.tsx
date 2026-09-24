"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { runMission } from "@/app/actions/missions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function RunMissionButton({
  missionId,
  retry = false,
  className,
}: {
  missionId: string
  retry?: boolean
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const result = await runMission(missionId)
      if ("error" in result) {
        toast.error("Couldn't start the mission", { description: result.error })
        return
      }
      toast.success("Mission started. It moves to Completed when it's done.")
      router.refresh()
    })
  }

  return (
    <Button onClick={run} disabled={pending} className={cn("w-full", className)}>
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        retry && <RotateCcw />
      )}
      {pending ? "Starting…" : retry ? "Retry" : "Run"}
    </Button>
  )
}
