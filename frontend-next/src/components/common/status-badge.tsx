"use client"

import { Badge } from "@/components/ui/badge"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nacrt", className: "bg-slate-100 text-slate-600 font-medium border-transparent dark:bg-muted dark:text-muted-foreground dark:border-border" },
  PLANNED: { label: "Planirano", className: "bg-blue-100 text-blue-700 font-medium border-transparent dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20" },
  IN_PROGRESS: { label: "U tijeku", className: "bg-amber-100 text-amber-700 font-medium border-transparent dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20" },
  COMPLETED: { label: "Završeno", className: "bg-emerald-100 text-emerald-700 font-medium border-transparent dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20" },
  CANCELLED: { label: "Otkazano", className: "bg-red-100 text-red-700 font-medium border-transparent dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20" },
  PENDING: { label: "Na čekanju", className: "bg-slate-100 text-slate-600 font-medium border-transparent dark:bg-muted dark:text-muted-foreground dark:border-border" },
  ARRIVED: { label: "Stigao", className: "bg-blue-100 text-blue-700 font-medium border-transparent dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20" },
  DELIVERED: { label: "Dostavljeno", className: "bg-emerald-100 text-emerald-700 font-medium border-transparent dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20" },
  FAILED: { label: "Neuspjelo", className: "bg-red-100 text-red-700 font-medium border-transparent dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20" },
  SKIPPED: { label: "Preskočeno", className: "bg-orange-100 text-orange-700 font-medium border-transparent dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20" },
}

interface StatusBadgeProps {
  status: string | null | undefined
  className?: string
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>

  const config = statusConfig[status.toUpperCase()] || {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  }

  return (
    <Badge
      variant="outline"
      className={`rounded-full text-[11px] font-medium ${config.className} ${className}`}
    >
      {config.label}
    </Badge>
  )
}
