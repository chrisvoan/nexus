"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  saveCompanySettings,
  type CompanyFormState,
} from "@/app/actions/company"
import { MarkdownPreview } from "@/components/agents/markdown-preview"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  COMPANY_FIELDS,
  composeCompanyContext,
  type CompanyProfile,
} from "@/lib/company-context"
import { cn } from "@/lib/utils"

type CompanyFormProps = {
  profile: CompanyProfile
  updatedAt: string | null
}

export function CompanyForm({ profile, updatedAt }: CompanyFormProps) {
  const [state, formAction, pending] = useActionState<
    CompanyFormState,
    FormData
  >(saveCompanySettings, undefined)
  const [draft, setDraft] = useState<CompanyProfile>(profile)

  useEffect(() => {
    if (state?.message) toast.success(state.message)
  }, [state])

  function update(key: keyof CompanyProfile, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const overLimit = COMPANY_FIELDS.some(
    (field) => (draft[field.key]?.length ?? 0) > field.limit
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>
            Agents receive this on every mission, and &ldquo;Generate with
            AI&rdquo; writes system prompts from it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex max-w-md flex-col gap-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              name="companyName"
              value={draft.company_name ?? ""}
              onChange={(event) => update("company_name", event.target.value)}
              placeholder="Acme Inc."
            />
          </div>

          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent
              value="edit"
              keepMounted
              className="flex flex-col gap-6"
            >
              {COMPANY_FIELDS.map((field) => {
                const length = draft[field.key]?.length ?? 0
                const over = length > field.limit
                return (
                  <div key={field.key} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <Label htmlFor={field.name}>{field.label}</Label>
                      {/* Pasting a long file is the normal case here, so show
                          exactly how much arrived rather than truncating it. */}
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          over ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {length.toLocaleString()} /{" "}
                        {field.limit.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {field.description}
                    </p>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={draft[field.key] ?? ""}
                      onChange={(event) =>
                        update(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
                      aria-invalid={over || undefined}
                      // Fixed box that scrolls and can be dragged taller;
                      // auto-sizing stops growing on long text and hides it.
                      className="field-sizing-fixed h-72 max-h-[70vh] resize-y overflow-y-auto font-mono text-sm"
                    />
                    {over && (
                      <p role="alert" className="text-sm text-destructive">
                        {(length - field.limit).toLocaleString()} characters
                        over the limit. Trim it, or move long reference
                        documents to agent knowledge.
                      </p>
                    )}
                  </div>
                )
              })}
            </TabsContent>

            <TabsContent value="preview">
              <div className="rounded-lg border px-4 py-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  Exactly what every agent receives:
                </p>
                <MarkdownPreview content={composeCompanyContext(draft)} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {state?.error ? (
              <span role="alert" className="text-destructive">
                {state.error}
              </span>
            ) : updatedAt ? (
              // Server and browser time zones differ; the browser's wins.
              <time dateTime={updatedAt} suppressHydrationWarning>
                Last saved {new Date(updatedAt).toLocaleString()}
              </time>
            ) : (
              "Not saved yet"
            )}
          </p>
          <Button type="submit" disabled={pending || overLimit}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
