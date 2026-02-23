"use client"

import { useCallback } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useServerPref } from "@/hooks/useServerPref"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useServerPref("sidebar-open", true)

  const handleOpenChange = useCallback(
    (open: boolean) => setSidebarOpen(open),
    [setSidebarOpen],
  )

  return (
    <ProtectedRoute>
      <SidebarProvider
        className="!h-svh bg-transparent"
        open={sidebarOpen}
        onOpenChange={handleOpenChange}
      >
        <AppSidebar />
        <SidebarInset className="bg-transparent overflow-hidden p-4 md:p-8">
          <div className="flex flex-1 flex-col min-h-0 bg-transparent h-full w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
