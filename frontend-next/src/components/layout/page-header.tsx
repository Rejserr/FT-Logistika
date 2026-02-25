"use client"

import type { ReactNode } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-8">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1 text-slate-300 hover:text-slate-500 dark:text-muted-foreground dark:hover:text-foreground" />
        <Separator orientation="vertical" className="h-6 bg-slate-200 dark:bg-border" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-400 dark:text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
