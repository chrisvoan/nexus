"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { CheckCircle2, HardDrive, Link2, Unplug } from "lucide-react"
import { toast } from "sonner"

import {
  completeDriveConnection,
  createDriveConnectToken,
  disconnectDrive,
} from "@/app/actions/integrations"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GOOGLE_DRIVE_APP_SLUG } from "@/lib/drive/types"

type GoogleDriveCardProps = {
  connected: boolean
  configured: boolean
  connectedAt: string | null
  connectedByName: string | null
}

export function GoogleDriveCard({
  connected,
  configured,
  connectedAt,
  connectedByName,
}: GoogleDriveCardProps) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, startDisconnect] = useTransition()

  async function connect() {
    setConnecting(true)
    const session = await createDriveConnectToken()
    if ("error" in session) {
      toast.error("Couldn't start Google sign-in", {
        description: session.error,
      })
      setConnecting(false)
      return
    }

    try {
      // Loaded on demand: the Connect SDK is only needed the one time an admin
      // links Drive, and it should not sit in the dashboard bundle.
      const { createFrontendClient } = await import("@pipedream/sdk/browser")
      const client = createFrontendClient({
        externalUserId: session.externalUserId,
        token: session.token,
        tokenCallback: async () => ({
          token: session.token,
          expiresAt: new Date(session.expiresAt),
          connectLinkUrl: "",
        }),
      })

      await client.connectAccount({
        app: GOOGLE_DRIVE_APP_SLUG,
        token: session.token,
        onSuccess: async () => {
          // Pipedream does not report the new account id here, so the server
          // looks it up and verifies it before saving.
          const result = await completeDriveConnection()
          setConnecting(false)
          if ("error" in result) {
            toast.error("Couldn't save the connection", {
              description: result.error,
            })
            return
          }
          toast.success("Google Drive connected.")
          router.refresh()
        },
        onError: (error) => {
          setConnecting(false)
          toast.error("Google sign-in failed", { description: error.message })
        },
        onClose: (status) => {
          if (!status.successful) setConnecting(false)
        },
      })
    } catch (error) {
      setConnecting(false)
      toast.error("Couldn't open Google sign-in", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  function disconnect() {
    startDisconnect(async () => {
      const result = await disconnectDrive()
      if ("error" in result) {
        toast.error("Couldn't disconnect", { description: result.error })
        return
      }
      toast.success("Google Drive disconnected.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <HardDrive className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              Google Drive
              {connected && (
                <Badge variant="secondary">
                  <CheckCircle2 />
                  Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Connected once for the whole company. Agents read pinned files
              from here, and missions save their output back to it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        {!configured ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            Pipedream isn&apos;t configured. Set{" "}
            <code className="font-mono">PIPEDREAM_PROJECT_ID</code>,{" "}
            <code className="font-mono">PIPEDREAM_CLIENT_ID</code>, and{" "}
            <code className="font-mono">PIPEDREAM_CLIENT_SECRET</code> in
            <code className="font-mono"> .env.local</code>, then restart the
            server.
          </p>
        ) : connected ? (
          <p>
            {connectedByName
              ? `Connected by ${connectedByName}`
              : "Connected"}
            {connectedAt && ` on ${formatDate(connectedAt)}`}. Nexus stores only
            the connection id — Google credentials stay in Pipedream, and file
            contents are read fresh on every run.
          </p>
        ) : (
          <p>
            Not connected. Until an admin links Drive, agents have no knowledge
            files and missions can only return plain text.
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        {connected ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnecting}
                />
              }
            >
              <Unplug />
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                <AlertDialogDescription>
                  Agents keep their pinned files listed, but nothing can be read
                  from Drive until it is reconnected. Nothing in Drive is
                  changed or deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={disconnect}
                  disabled={disconnecting}
                >
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button size="sm" onClick={connect} disabled={!configured || connecting}>
            <Link2 />
            {connecting ? "Waiting for Google…" : "Connect Google Drive"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
