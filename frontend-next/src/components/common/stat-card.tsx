"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  accent?: "blue" | "green" | "amber" | "purple" | "red"
}

const accentMap = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  accent = "blue",
}: StatCardProps) {
  const colors = accentMap[accent]

  return (
    <Card className="glass glass-hover cursor-default">
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}
        >
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
        <div className="flex flex-col">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-800 dark:text-foreground">
            {value}
          </span>
          <span className="text-xs text-slate-500 dark:text-muted-foreground">{title}</span>
        </div>
        {trend && (
          <div className="ml-auto text-right">
            <span
              className={`text-xs font-medium ${
                trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
            <p className="text-[10px] text-slate-400 dark:text-muted-foreground">{trend.label}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
