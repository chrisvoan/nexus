"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { setUserRole } from "@/app/actions/users"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserRole } from "@/lib/types/database"

const ROLE_ITEMS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
]

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string
  role: UserRole
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticRole, setOptimisticRole] = useOptimistic(role)

  function change(next: UserRole) {
    startTransition(async () => {
      setOptimisticRole(next)
      const result = await setUserRole(userId, next)
      if ("error" in result)
        toast.error("Couldn't change role", { description: result.error })
      else toast.success(`Role changed to ${next}.`)
    })
  }

  return (
    <Select
      items={ROLE_ITEMS}
      value={optimisticRole}
      onValueChange={(value) => value && change(value as UserRole)}
      disabled={disabled || pending}
    >
      <SelectTrigger className="w-32" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
