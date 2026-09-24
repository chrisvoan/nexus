"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Eye,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Search,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAgentKnowledge,
  fetchDriveFiles,
  previewKnowledgeFile,
  setAgentKnowledgeFile,
} from "@/app/actions/knowledge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  driveFileKind,
  driveFileTypeLabel,
  isUnreadableDriveType,
  type AgentKnowledgeFile,
  type DriveFile,
  type DriveFileKind,
} from "@/lib/drive/types"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 300

type AgentKnowledgeEditorProps = {
  agentId: string
  driveConnected: boolean
  readOnly?: boolean
}

export function AgentKnowledgeEditor({
  agentId,
  driveConnected,
  readOnly = false,
}: AgentKnowledgeEditorProps) {
  const [pinned, setPinned] = useState<AgentKnowledgeFile[]>([])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(driveConnected)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    fileName: string
    text: string | null
  } | null>(null)

  // Guards against a slow first search resolving after a later one.
  const requestId = useRef(0)

  const loadFiles = useCallback(
    async (term: string) => {
      const id = ++requestId.current
      setLoading(true)
      setError(null)
      const result = await fetchDriveFiles({ search: term })
      if (id !== requestId.current) return

      if ("error" in result) {
        setError(result.error)
        setFiles([])
        setNextPageToken(null)
      } else {
        setFiles(result.files)
        setNextPageToken(result.nextPageToken)
      }
      setLoading(false)
    },
    []
  )

  useEffect(() => {
    if (!driveConnected) return
    let active = true
    fetchAgentKnowledge(agentId).then((result) => {
      if (active && "ok" in result) setPinned(result.files)
    })
    return () => {
      active = false
    }
  }, [agentId, driveConnected])

  useEffect(() => {
    if (!driveConnected) return
    const timer = setTimeout(() => loadFiles(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [driveConnected, loadFiles, search])

  async function loadMore() {
    if (!nextPageToken) return
    setLoadingMore(true)
    const result = await fetchDriveFiles({ search, pageToken: nextPageToken })
    if ("error" in result) {
      toast.error("Couldn't load more files", { description: result.error })
    } else {
      // Drive can repeat a file across pages when something is edited mid-scan.
      setFiles((current) => {
        const seen = new Set(current.map((file) => file.id))
        return [...current, ...result.files.filter((file) => !seen.has(file.id))]
      })
      setNextPageToken(result.nextPageToken)
    }
    setLoadingMore(false)
  }

  async function toggle(file: DriveFile, pin: boolean) {
    setSaving((current) => [...current, file.id])
    // Optimistic: the list reflects the click straight away and is replaced by
    // the server's copy once it answers.
    setPinned((current) =>
      pin
        ? [
            ...current,
            {
              id: `pending-${file.id}`,
              file_id: file.id,
              file_name: file.name,
              file_mime_type: file.mimeType,
            },
          ]
        : current.filter((entry) => entry.file_id !== file.id)
    )

    const result = await setAgentKnowledgeFile(
      agentId,
      { fileId: file.id, fileName: file.name, mimeType: file.mimeType },
      pin
    )
    setSaving((current) => current.filter((id) => id !== file.id))

    if ("error" in result) {
      toast.error(pin ? "Couldn't pin file" : "Couldn't remove file", {
        description: result.error,
      })
      const revert = await fetchAgentKnowledge(agentId)
      if ("ok" in revert) setPinned(revert.files)
      return
    }
    setPinned(result.files)
  }

  async function showPreview(fileId: string, fileName: string) {
    setPreview({ fileName, text: null })
    const result = await previewKnowledgeFile(agentId, fileId)
    if ("error" in result) {
      setPreview(null)
      toast.error("Couldn't read that file", { description: result.error })
      return
    }
    setPreview({ fileName: result.fileName, text: result.text })
  }

  const pinnedIds = new Set(pinned.map((entry) => entry.file_id))
  const unreadablePinned = pinned.filter((entry) =>
    isUnreadableDriveType(entry.file_mime_type)
  )
  // Pinned files that this page of Drive results doesn't include — usually
  // filtered out by the search box, sometimes deleted in Drive.
  const offListPinned = pinned.filter(
    (entry) => !files.some((file) => file.id === entry.file_id)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge</CardTitle>
        <CardDescription>
          Drive files this agent reads on every mission. Nexus stores only the
          file names — contents are read from Drive each time it runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!driveConnected ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Google Drive isn&apos;t connected.{" "}
            <Link
              href="/admin/integrations"
              className="font-medium text-foreground underline"
            >
              Connect it under Integrations
            </Link>{" "}
            to pin knowledge files.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Drive by file name…"
                className="pl-9"
                disabled={readOnly}
                aria-label="Search Drive files"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <>
                <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                  {offListPinned.map((entry) => (
                    <FileRow
                      key={entry.file_id}
                      name={entry.file_name}
                      mimeType={entry.file_mime_type}
                      meta="Pinned"
                      checked
                      saving={saving.includes(entry.file_id)}
                      disabled={readOnly}
                      onCheckedChange={() =>
                        toggle(
                          {
                            id: entry.file_id,
                            name: entry.file_name,
                            mimeType: entry.file_mime_type,
                            modifiedTime: null,
                            webViewLink: null,
                          },
                          false
                        )
                      }
                      onPreview={() =>
                        showPreview(entry.file_id, entry.file_name)
                      }
                    />
                  ))}
                  {files.map((file) => (
                    <FileRow
                      key={file.id}
                      name={file.name}
                      mimeType={file.mimeType}
                      meta={formatModified(file.modifiedTime)}
                      checked={pinnedIds.has(file.id)}
                      saving={saving.includes(file.id)}
                      disabled={readOnly}
                      onCheckedChange={(checked) => toggle(file, checked)}
                      onPreview={() => showPreview(file.id, file.name)}
                    />
                  ))}
                  {files.length === 0 && offListPinned.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {search
                        ? `No Drive files match “${search}”.`
                        : "No supported files found in Drive."}
                    </li>
                  )}
                </ul>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {pinned.length === 0
                      ? "No files pinned yet."
                      : `${pinned.length} file${pinned.length === 1 ? "" : "s"} pinned.`}
                  </p>
                  {nextPageToken && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </Button>
                  )}
                </div>
              </>
            )}

            {unreadablePinned.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Excel files can&apos;t be read. Convert{" "}
                  {unreadablePinned.map((entry) => entry.file_name).join(", ")}{" "}
                  to a Google Sheet in Drive so the agent can use it.
                </span>
              </p>
            )}
          </>
        )}
      </CardContent>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.fileName}</DialogTitle>
            <DialogDescription>
              The text the agent receives for this file, extracted from Drive
              just now.
            </DialogDescription>
          </DialogHeader>
          {preview?.text == null ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading from Drive…
            </div>
          ) : (
            <>
              <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                {preview.text}
              </pre>
              <p className="text-xs text-muted-foreground">
                {preview.text.length.toLocaleString()} characters
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const KIND_STYLES: Record<
  DriveFileKind,
  { icon: typeof FileText; className: string }
> = {
  doc: { icon: FileText, className: "text-blue-600 dark:text-blue-400" },
  sheet: {
    icon: FileSpreadsheet,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  pdf: { icon: FileType2, className: "text-orange-600 dark:text-orange-400" },
  text: { icon: FileText, className: "text-muted-foreground" },
}

type FileRowProps = {
  name: string
  mimeType: string
  meta: string | null
  checked: boolean
  saving: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  onPreview: () => void
}

function FileRow({
  name,
  mimeType,
  meta,
  checked,
  saving,
  disabled,
  onCheckedChange,
  onPreview,
}: FileRowProps) {
  const { icon: Icon, className } = KIND_STYLES[driveFileKind(mimeType)]

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 transition-colors",
        disabled ? "opacity-70" : "hover:bg-muted/50"
      )}
    >
      <label
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3",
          !disabled && "cursor-pointer"
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled || saving}
        />
        <Icon className={cn("size-4 shrink-0", className)} />
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      </label>
      {saving && (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      )}
      <Badge variant="outline" className="shrink-0">
        {driveFileTypeLabel(mimeType)}
      </Badge>
      {meta && (
        <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
          {meta}
        </span>
      )}
      {/* Only pinned files can be previewed: the text is read through the
          agent's own knowledge row, not from an arbitrary Drive id. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("shrink-0", !checked && "invisible")}
        onClick={onPreview}
        aria-label={`Preview extracted text from ${name}`}
      >
        <Eye />
      </Button>
    </li>
  )
}

function formatModified(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
