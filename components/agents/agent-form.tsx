"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  createAgent,
  updateAgent,
  type AgentFormState,
} from "@/app/actions/agents"
import { GeneratePromptDialog } from "@/components/agents/generate-prompt-dialog"
import { MarkdownPreview } from "@/components/agents/markdown-preview"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ModelOption } from "@/lib/anthropic/models"
import type { Agent } from "@/lib/types/database"
import { cn } from "@/lib/utils"

type AgentFormProps = {
  agent?: Pick<Agent, "id" | "name" | "description" | "system_prompt" | "model">
  models: ModelOption[]
  defaultModel: string
  hasCompanyContext: boolean
  readOnly?: boolean
  // Rendered under Details on the edit page. A new agent has no id yet, so
  // there is nothing to pin files to until it is saved.
  knowledge?: React.ReactNode
}

export function AgentForm({
  agent,
  models,
  defaultModel,
  hasCompanyContext,
  readOnly = false,
  knowledge,
}: AgentFormProps) {
  const action = agent ? updateAgent.bind(null, agent.id) : createAgent
  const [state, formAction, pending] = useActionState<AgentFormState, FormData>(
    action,
    undefined
  )
  const [name, setName] = useState(agent?.name ?? "")
  const [model, setModel] = useState(agent?.model ?? defaultModel)
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? "")
  const [tab, setTab] = useState("edit")
  const [generateOpen, setGenerateOpen] = useState(false)

  useEffect(() => {
    if (state?.syncError)
      toast.warning(state.message, { description: state.syncError })
    else if (state?.message) toast.success(state.message)
  }, [state])

  const modelItems = models.map((option) => ({
    value: option.id,
    label: option.label,
  }))

  return (
    <>
      <form
        action={formAction}
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      >
        <div className="flex h-fit flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              What employees see when picking this agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Social Media Manager"
                maxLength={100}
                required
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={agent?.description ?? ""}
                placeholder="Drafts on-brand posts and content calendars."
                maxLength={500}
                rows={3}
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Model</Label>
              <Select
                name="model"
                items={modelItems}
                value={model}
                onValueChange={(value) => value && setModel(value)}
                disabled={readOnly}
              >
                <SelectTrigger id="model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Models available to your Anthropic account.
              </p>
            </div>
          </CardContent>
        </Card>
        {knowledge}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System prompt</CardTitle>
            <CardDescription>
              Instructions Claude follows on every mission. Markdown supported.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
              <div className="flex items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGenerateOpen(true)}
                  >
                    <Sparkles />
                    Generate with AI
                  </Button>
                )}
              </div>
              <TabsContent value="edit" keepMounted>
                <Textarea
                  name="systemPrompt"
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  placeholder={"You are the company's social media manager…"}
                  // Fixed box that scrolls and can be dragged taller;
                  // auto-sizing stops growing on a long prompt and hides it.
                  className="field-sizing-fixed h-96 max-h-[70vh] resize-y overflow-y-auto font-mono text-sm"
                  disabled={readOnly}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="min-h-96 rounded-lg border px-4 py-3">
                  <MarkdownPreview content={systemPrompt} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 lg:col-span-2">
          {state?.error && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Link
            href="/admin/agents"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {readOnly ? "Back" : "Cancel"}
          </Link>
          {!readOnly && (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : agent ? "Save changes" : "Create agent"}
            </Button>
          )}
        </div>
      </form>

      <GeneratePromptDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(prompt) => {
          setSystemPrompt(prompt)
          setTab("edit")
          toast.success("System prompt generated. Review it, then save.")
        }}
        agentName={name}
        hasCompanyContext={hasCompanyContext}
        replacesExisting={Boolean(systemPrompt.trim())}
      />
    </>
  )
}
