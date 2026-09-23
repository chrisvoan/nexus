"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Loader2, Sparkles } from "lucide-react"

import { generateAgentPrompt } from "@/app/actions/agents"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type GeneratePromptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (systemPrompt: string) => void
  agentName: string
  hasCompanyContext: boolean
  replacesExisting: boolean
}

export function GeneratePromptDialog({
  open,
  onOpenChange,
  onGenerated,
  agentName,
  hasCompanyContext,
  replacesExisting,
}: GeneratePromptDialogProps) {
  const [role, setRole] = useState("")
  const [tasks, setTasks] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (pending) return
    if (!next) {
      setRole("")
      setTasks("")
      setError(null)
    }
    onOpenChange(next)
  }

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await generateAgentPrompt({ role, tasks, agentName })
      if ("error" in result) {
        setError(result.error)
        return
      }
      onGenerated(result.systemPrompt)
      setRole("")
      setTasks("")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate system prompt</DialogTitle>
          <DialogDescription>
            Describe the agent and Claude drafts a system prompt using your
            company context.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!hasCompanyContext && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              No company context is saved yet, so the prompt will be generic.{" "}
              <Link href="/admin/company" className="font-medium underline">
                Add company context
              </Link>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="generate-role">Role</Label>
            <Textarea
              id="generate-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Social media manager for our B2B product launches"
              rows={2}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="generate-tasks">Tasks</Label>
            <Textarea
              id="generate-tasks"
              value={tasks}
              onChange={(event) => setTasks(event.target.value)}
              placeholder={
                "Draft LinkedIn posts from release notes\nPlan a monthly content calendar"
              }
              rows={4}
              disabled={pending}
            />
          </div>
          {replacesExisting && (
            <p className="text-sm text-muted-foreground">
              This replaces the current system prompt. You can still edit it
              before saving.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={generate}
            disabled={pending || !role.trim() || !tasks.trim()}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
