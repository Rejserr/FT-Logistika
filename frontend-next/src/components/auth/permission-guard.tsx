"use client"

import { type ReactNode } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { ShieldAlert } from "lucide-react"

interface PermissionGuardProps {
  permission: string
  children: ReactNode
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive/50" />
          <h2 className="text-lg font-semibold">Pristup odbijen</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Nemate dozvolu za pristup ovoj stranici. Obratite se administratoru.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
