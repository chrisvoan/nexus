"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  updateCustomInstructions,
  type CustomInstructionsState,
} from "@/app/actions/squad"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CUSTOM_INSTRUCTIONS_LIMIT } from "@/lib/missions/types"

export function CustomInstructionsForm({
  agentId,
  initialValue,
}: {
  agentId: string
  initialValue: string
}) {
  const [state, formAction, pending] = useActionState<
    CustomInstructionsState,
    FormData
  >(updateCustomInstructions.bind(null, agentId), undefined)
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (state?.message) toast.success(state.message)
  }, [state])

  const dirty = value.trim() !== (state?.saved ?? initialValue.trim())

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea
        name="customInstructions"
        aria-label="Custom instructions"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          "Write in British English.\nKeep summaries under 300 words.\nI look after the EMEA region, so focus there."
        }
        maxLength={CUSTOM_INSTRUCTIONS_LIMIT}
        className="field-sizing-fixed h-56 max-h-[60vh] resize-y overflow-y-auto text-sm"
      />
      <div className="flex items-center gap-3">
        {state?.error ? (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {state.error}
          </p>
        ) : (
          <p className="mr-auto text-xs text-muted-foreground">
            {value.length.toLocaleString()} /{" "}
            {CUSTOM_INSTRUCTIONS_LIMIT.toLocaleString()}
          </p>
        )}
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save instructions"}
        </Button>
      </div>
    </form>
  )
}
