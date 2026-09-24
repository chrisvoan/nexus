"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Server } from "lucide-react"
import { toast } from "sonner"

import { createAgentEnvironment } from "@/app/actions/integrations"
import { IntegrationCard } from "@/components/integrations/integration-card"
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

export function AgentRuntimeCard({
  environmentId,
}: {
  environmentId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function create() {
    startTransition(async () => {
      const result = await createAgentEnvironment()
      if ("error" in result) {
        toast.error("Couldn't create the runtime", { description: result.error })
        return
      }
      toast.success("Agent runtime ready. Missions can now run.")
      router.refresh()
    })
  }

  return (
    <IntegrationCard
      icon={
        <span className="flex size-7 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
          <Server className="size-4" />
        </span>
      }
      title="Agent runtime"
      description="The Claude environment every mission runs in"
      status={
        environmentId
          ? { label: "Ready", tone: "connected" }
          : { label: "Not set up", tone: "idle" }
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {environmentId ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="outline" disabled={pending} />}
            >
              {pending ? "Creating…" : "Recreate"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Recreate the agent runtime?</AlertDialogTitle>
                <AlertDialogDescription>
                  New missions run in a fresh environment. Only do this if the
                  current one was deleted in the Claude Console. Past sessions
                  are unaffected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={create} disabled={pending}>
                  Recreate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={create} disabled={pending}>
            {pending ? "Creating…" : "Set up"}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {environmentId ? (
            <code className="font-mono text-xs">{environmentId}</code>
          ) : (
            "Required once before anyone can run a mission."
          )}
        </p>
      </div>
    </IntegrationCard>
  )
}
