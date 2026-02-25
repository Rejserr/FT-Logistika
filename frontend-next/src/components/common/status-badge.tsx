"use client"

import { Badge } from "@/components/ui/badge"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nacrt", className: "bg-slate-50 text-slate-500 border-transparent dark:bg-slate-700/60 dark:text-slate-300" },
  PLANNED: { label: "Planirano", className: "bg-blue-50 text-blue-600 border-transparent dark:bg-blue-500/30 dark:text-blue-300" },
  IN_PROGRESS: { label: "U tijeku", className: "bg-amber-50 text-amber-600 border-transparent dark:bg-amber-500/30 dark:text-amber-300" },
  COMPLETED: { label: "Završeno", className: "bg-emerald-50 text-emerald-600 border-transparent dark:bg-emerald-500/30 dark:text-emerald-300" },
  CANCELLED: { label: "Otkazano", className: "bg-red-50 text-red-500 border-transparent dark:bg-red-500/30 dark:text-red-300" },
  PENDING: { label: "Na čekanju", className: "bg-slate-50 text-slate-500 border-transparent dark:bg-slate-700/60 dark:text-slate-300" },
  ARRIVED: { label: "Stigao", className: "bg-cyan-50 text-cyan-600 border-transparent dark:bg-cyan-500/30 dark:text-cyan-300" },
  DELIVERED: { label: "Dostavljeno", className: "bg-emerald-50 text-emerald-600 border-transparent dark:bg-emerald-500/30 dark:text-emerald-300" },
  FAILED: { label: "Neuspjelo", className: "bg-red-50 text-red-500 border-transparent dark:bg-red-500/30 dark:text-red-300" },
  SKIPPED: { label: "Preskočeno", className: "bg-orange-50 text-orange-500 border-transparent dark:bg-orange-500/30 dark:text-orange-300" },
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
