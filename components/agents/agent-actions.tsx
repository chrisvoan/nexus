"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Archive, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { archiveAgent, retryAgentSync } from "@/app/actions/agents"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type AgentActionsProps = {
  agentId: string
  agentName: string
  needsSync: boolean
}

export function AgentActions({
  agentId,
  agentName,
  needsSync,
}: AgentActionsProps) {
  const router = useRouter()
  const [syncing, startSync] = useTransition()
  const [archiving, startArchive] = useTransition()

  function sync() {
    startSync(async () => {
      const result = await retryAgentSync(agentId)
      if ("error" in result)
        toast.error("Sync failed", { description: result.error })
      else toast.success("Agent synced to Claude.")
    })
  }

  function archive() {
    startArchive(async () => {
      const result = await archiveAgent(agentId)
      if ("error" in result) {
        toast.error("Couldn't archive agent", { description: result.error })
        return
      }
      toast.success(`${agentName} archived.`)
      router.push("/admin/agents")
    })
  }

  return (
    <div className="flex items-center gap-2">
      {needsSync && (
        <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
          <RefreshCw className={syncing ? "animate-spin" : undefined} />
          {syncing ? "Syncing…" : "Retry sync"}
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="destructive" size="sm" disabled={archiving} />
          }
        >
          <Archive />
          Archive
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {agentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent is removed from every employee&apos;s squad and its
              Claude Managed Agent is archived. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={archive}
              disabled={archiving}
            >
              Archive agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
