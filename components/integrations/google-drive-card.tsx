"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  completeMyDriveConnection,
  createMyDriveConnectToken,
  disconnectMyDrive,
} from "@/app/actions/drive"
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
import { GoogleDriveLogo } from "@/components/integrations/google-drive-logo"
import { IntegrationCard } from "@/components/integrations/integration-card"
import { Button } from "@/components/ui/button"
import { GOOGLE_DRIVE_APP_SLUG } from "@/lib/drive/types"

// The company Drive feeds agent knowledge and is managed by admins; a
// personal Drive is where one employee's mission outputs are saved. Same
// OAuth flow, different actions and copy.
const SCOPES = {
  company: {
    createToken: createDriveConnectToken,
    complete: completeDriveConnection,
    disconnect: disconnectDrive,
    description: "Let agents read your Drive files",
    disconnectDescription:
      "Agents keep their pinned files listed, but nothing can be read from Drive until it is reconnected. Nothing in Drive is changed or deleted.",
  },
  personal: {
    createToken: createMyDriveConnectToken,
    complete: completeMyDriveConnection,
    disconnect: disconnectMyDrive,
    description: "Save your mission outputs to your Drive",
    disconnectDescription:
      "New mission outputs won't be saved to your Drive until you reconnect it. Files already in your Drive are not changed or deleted.",
  },
}

type GoogleDriveCardProps = {
  scope: keyof typeof SCOPES
  connected: boolean
  configured: boolean
  connectedAt: string | null
  /** "Connected by Ada" or "Connected as ada@example.com". */
  connectedLabel: string | null
}

export function GoogleDriveCard({
  scope,
  connected,
  configured,
  connectedAt,
  connectedLabel,
}: GoogleDriveCardProps) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, startDisconnect] = useTransition()
  const actions = SCOPES[scope]

  async function connect() {
    setConnecting(true)
    const session = await actions.createToken()
    if ("error" in session) {
      toast.error("Couldn't start Google sign-in", {
        description: session.error,
      })
      setConnecting(false)
      return
    }

    try {
      // Loaded on demand: the Connect SDK is only needed the one time Drive
      // is linked, and it should not sit in the dashboard bundle.
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
          const result = await actions.complete()
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
      const result = await actions.disconnect()
      if ("error" in result) {
        toast.error("Couldn't disconnect", { description: result.error })
        return
      }
      toast.success("Google Drive disconnected.")
      router.refresh()
    })
  }

  return (
    <IntegrationCard
      icon={<GoogleDriveLogo className="size-7" />}
      title="Google Drive"
      description={actions.description}
      status={
        connected
          ? { label: "Connected", tone: "connected" }
          : { label: "Not connected", tone: "idle" }
      }
    >
      {!configured && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {scope === "company" ? (
            <>
              Pipedream isn&apos;t configured. Set{" "}
              <code className="font-mono">PIPEDREAM_PROJECT_ID</code>,{" "}
              <code className="font-mono">PIPEDREAM_CLIENT_ID</code>, and{" "}
              <code className="font-mono">PIPEDREAM_CLIENT_SECRET</code> in
              <code className="font-mono"> .env.local</code>, then restart the
              server.
            </>
          ) : (
            "Google sign-in isn't set up on this workspace yet. Ask an admin to configure Pipedream."
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {connected ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="outline" disabled={disconnecting} />}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                <AlertDialogDescription>
                  {actions.disconnectDescription}
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
          <Button onClick={connect} disabled={!configured || connecting}>
            {connecting ? "Waiting for Google…" : "Connect"}
          </Button>
        )}

        {connected && (
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {connectedLabel ?? "Connected"}
            {connectedAt && ` on ${formatDate(connectedAt)}`}
          </p>
        )}
      </div>
    </IntegrationCard>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
