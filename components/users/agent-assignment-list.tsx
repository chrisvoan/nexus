"use client"

import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { setAgentAssignment } from "@/app/actions/users"
import { Switch } from "@/components/ui/switch"

type AssignableAgent = {
  id: string
  name: string
  description: string | null
  assigned: boolean
}

export function AgentAssignmentList({
  userId,
  agents,
}: {
  userId: string
  agents: AssignableAgent[]
}) {
  const [, startTransition] = useTransition()
  const [optimisticAgents, setOptimistic] = useOptimistic(
    agents,
    (current, change: { id: string; assigned: boolean }) =>
      current.map((agent) =>
        agent.id === change.id ? { ...agent, assigned: change.assigned } : agent
      )
  )

  function toggle(agent: AssignableAgent, assigned: boolean) {
    startTransition(async () => {
      setOptimistic({ id: agent.id, assigned })
      const result = await setAgentAssignment(userId, agent.id, assigned)
      if ("error" in result)
        toast.error(`Couldn't update ${agent.name}`, {
          description: result.error,
        })
    })
  }

  if (agents.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No active agents yet.{" "}
        <Link href="/admin/agents/new" className="font-medium underline">
          Create one
        </Link>
        .
      </p>
    )

  return (
    <ul className="divide-y rounded-lg border">
      {optimisticAgents.map((agent) => (
        <li key={agent.id} className="flex items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <label htmlFor={`agent-${agent.id}`} className="font-medium">
              {agent.name}
            </label>
            {agent.description && (
              <p className="truncate text-sm text-muted-foreground">
                {agent.description}
              </p>
            )}
          </div>
          <Switch
            id={`agent-${agent.id}`}
            checked={agent.assigned}
            onCheckedChange={(checked) => toggle(agent, checked)}
          />
        </li>
      ))}
    </ul>
  )
}
