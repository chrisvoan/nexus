"use client"

import Link from "next/link"
import { useActionState, useEffect, useState, useTransition } from "react"
import { Globe, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createMission,
  deleteMission,
  updateMission,
  type MissionFormState,
} from "@/app/actions/missions"
import { agentIconFor } from "@/components/agents/agent-icon"
import { NavIcon } from "@/components/dashboard/nav-icon"
import { OutputIcon } from "@/components/missions/output-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { DriveTarget } from "@/lib/drive/types"
import {
  MISSION_LIMITS,
  OUTPUT_TYPES,
  type MissionSummary,
  type SquadAgent,
} from "@/lib/missions/types"
import type { MissionOutputType } from "@/lib/types/database"
import { cn } from "@/lib/utils"

type MissionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  squad: SquadAgent[]
  driveTarget: DriveTarget | null
  /** Editing when set; creating otherwise. */
  mission?: MissionSummary
  /** Called after the mission is deleted from the edit dialog. */
  onDeleted?: () => void
}

// The dialog content unmounts on close, so each open starts with a fresh form
// and action state.
export function MissionDialog(props: MissionDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <MissionForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function MissionForm({
  onOpenChange,
  squad,
  driveTarget,
  mission,
  onDeleted,
}: MissionDialogProps) {
  const action = mission ? updateMission.bind(null, mission.id) : createMission
  const [state, formAction, pending] = useActionState<
    MissionFormState,
    FormData
  >(action, undefined)
  const [deleting, startDelete] = useTransition()

  // An agent removed from the squad since the mission was written can't be
  // kept; the employee has to pick a current one.
  const initialAgent =
    mission?.agent && squad.some((agent) => agent.id === mission.agent?.id)
      ? mission.agent.id
      : squad.length === 1
        ? squad[0].id
        : ""
  const [agentId, setAgentId] = useState(initialAgent)
  const [outputType, setOutputType] = useState<MissionOutputType>(
    mission?.output_type ?? "doc"
  )
  const [webSearch, setWebSearch] = useState(mission?.web_search ?? false)

  useEffect(() => {
    if (!state?.ok) return
    toast.success(mission ? "Mission updated." : "Mission added to the queue.")
    onOpenChange(false)
  }, [state, mission, onOpenChange])

  function remove() {
    if (!mission) return
    startDelete(async () => {
      const result = await deleteMission(mission.id)
      if ("error" in result) {
        toast.error("Couldn't delete the mission", { description: result.error })
        return
      }
      toast.success("Mission deleted.")
      onOpenChange(false)
      onDeleted?.()
    })
  }

  const agentItems = squad.map((agent) => ({ value: agent.id, label: agent.name }))
  const busy = pending || deleting

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{mission ? "Edit mission" : "New mission"}</DialogTitle>
        <DialogDescription>
          Brief an agent from your squad. It runs when you press Run.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mission-agent">Agent</Label>
        <Select
          name="agentId"
          items={agentItems}
          value={agentId || null}
          onValueChange={(value) => setAgentId(value ?? "")}
          disabled={busy}
        >
          <SelectTrigger id="mission-agent" className="w-full">
            <SelectValue placeholder="Choose an agent" />
          </SelectTrigger>
          <SelectContent>
            {squad.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <NavIcon
                  item={agentIconFor(agent.name)}
                  className="size-5 rounded [&_svg]:size-3"
                />
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mission-title">Title</Label>
        <Input
          id="mission-title"
          name="title"
          defaultValue={mission?.title}
          placeholder="Founder content pack"
          maxLength={MISSION_LIMITS.title}
          required
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mission-brief">Brief</Label>
        <Textarea
          id="mission-brief"
          name="brief"
          defaultValue={mission?.brief}
          placeholder="Create 10 LinkedIn posts for the CEO this month, each tied to one of our Q3 launches."
          maxLength={MISSION_LIMITS.brief}
          rows={5}
          className="field-sizing-fixed max-h-72 min-h-28 resize-y"
          required
          disabled={busy}
        />
      </div>

      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="mb-2 text-sm leading-none font-medium">Output</legend>
        <input type="hidden" name="outputType" value={outputType} />
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {OUTPUT_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={outputType === option.value}
              onClick={() => setOutputType(option.value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                outputType === option.value
                  ? "border-primary bg-muted/60 ring-1 ring-primary"
                  : "hover:bg-muted/40"
              )}
            >
              <OutputIcon type={option.value} className="size-6" />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </button>
          ))}
        </div>
        {driveTarget === "company" && (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            The output will be saved to the company Google Drive.{" "}
            <Link href="/settings" className="underline">
              Connect your own Drive
            </Link>{" "}
            to keep outputs in yours.
          </p>
        )}
        {!driveTarget && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Google Drive isn&apos;t connected yet, so the output will be saved
            in Nexus instead of Drive.{" "}
            <Link href="/settings" className="underline">
              Connect your Drive
            </Link>{" "}
            to save it there.
          </p>
        )}
      </fieldset>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="flex gap-3">
          <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <Label htmlFor="mission-web-search">Web search</Label>
            <p className="text-xs text-muted-foreground">
              Let the agent search and read the web. Leave off to work only
              from company context and knowledge files.
            </p>
          </div>
        </div>
        <Switch
          id="mission-web-search"
          checked={webSearch}
          onCheckedChange={setWebSearch}
          disabled={busy}
        />
        {webSearch && <input type="hidden" name="webSearch" value="on" />}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        {mission && (
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 />
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !agentId}>
          {pending ? "Saving…" : mission ? "Save changes" : "Add mission"}
        </Button>
      </DialogFooter>
    </form>
  )
}
