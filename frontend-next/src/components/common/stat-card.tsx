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
    iconBg: "bg-gradient-to-br from-blue-100/60 to-indigo-100/40 backdrop-blur-sm dark:from-blue-500/10 dark:to-blue-500/5",
    iconText: "text-blue-500 dark:text-blue-400",
  },
  green: {
    iconBg: "bg-gradient-to-br from-emerald-100/60 to-teal-100/40 backdrop-blur-sm dark:from-emerald-500/10 dark:to-emerald-500/5",
    iconText: "text-emerald-500 dark:text-emerald-400",
  },
  amber: {
    iconBg: "bg-gradient-to-br from-amber-100/60 to-orange-100/40 backdrop-blur-sm dark:from-amber-500/10 dark:to-amber-500/5",
    iconText: "text-amber-500 dark:text-amber-400",
  },
  purple: {
    iconBg: "bg-gradient-to-br from-purple-100/60 to-violet-100/40 backdrop-blur-sm dark:from-purple-500/10 dark:to-purple-500/5",
    iconText: "text-purple-500 dark:text-purple-400",
  },
  red: {
    iconBg: "bg-gradient-to-br from-red-100/60 to-rose-100/40 backdrop-blur-sm dark:from-red-500/10 dark:to-red-500/5",
    iconText: "text-red-500 dark:text-red-400",
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
    <Card>
      <CardContent className="flex items-center gap-5 p-6">
        <div
          className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${colors.iconBg}`}
        >
          <Icon className={`h-6 w-6 ${colors.iconText}`} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-800 dark:text-foreground">
            {value}
          </span>
          <span className="text-xs font-medium text-slate-400 dark:text-muted-foreground">{title}</span>
        </div>
        {trend && (
          <div className="ml-auto text-right">
            <span
              className={`text-xs font-semibold ${
                trend.value >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
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
