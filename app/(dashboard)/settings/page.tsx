import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { GoogleDriveCard } from "@/components/integrations/google-drive-card"
import { requireUser } from "@/lib/auth"
import { getDriveConnection, getUserDriveStatus } from "@/lib/drive/connection"
import { isPipedreamConfigured } from "@/lib/pipedream/client"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const user = await requireUser()
  const [{ connection, accountName, connectedAt }, companyDrive] =
    await Promise.all([getUserDriveStatus(user.id), getDriveConnection()])

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile and preferences."
      />
      <div className="flex max-w-5xl flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Connected accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            {connection
              ? "Your mission outputs are saved to your own Google Drive."
              : companyDrive
                ? "Until you connect your own Google Drive, your mission outputs are saved to the company Drive."
                : "Connect your Google Drive to save mission outputs as Docs, Sheets, and PDFs. Until then, outputs are kept in Nexus only."}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <GoogleDriveCard
            scope="personal"
            connected={Boolean(connection)}
            configured={isPipedreamConfigured()}
            connectedAt={connectedAt}
            connectedLabel={accountName ? `Connected as ${accountName}` : null}
          />
        </div>
      </div>
    </>
  )
}
