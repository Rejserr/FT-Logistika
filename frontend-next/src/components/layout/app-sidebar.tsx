"use client"

import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  Route,
  History,
  Package,
  Boxes,
  FolderTree,
  FileCheck,
  Truck,
  MapPin,
  Settings,
  Warehouse,
  ScrollText,
  Users,
  Shield,
  LogOut,
  ChevronsUpDown,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navGroups = [
  {
    label: "Pregled",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, permission: null },
    ],
  },
  {
    label: "Dostave",
    items: [
      { path: "/routing", label: "Nova ruta", icon: Sparkles, permission: "routes.create" },
      { path: "/routes", label: "Rute", icon: Route, permission: "routes.view" },
      { path: "/orders", label: "Nalozi", icon: Package, permission: "orders.view" },
      { path: "/pod", label: "POD", icon: FileCheck, permission: "pod.view" },
    ],
  },
  {
    label: "Katalog",
    items: [
      { path: "/artikli", label: "Artikli", icon: Boxes, permission: "items.view" },
      { path: "/artikli-grupe", label: "Grupe artikala", icon: FolderTree, permission: "items.view" },
    ],
  },
  {
    label: "Resursi",
    items: [
      { path: "/vehicles", label: "Vozila", icon: Truck, permission: "vehicles.view" },
      { path: "/regions", label: "Regije", icon: MapPin, permission: "regions.view" },
      { path: "/warehouses", label: "Skladišta", icon: Warehouse, permission: "warehouses.view" },
    ],
  },
  {
    label: "Administracija",
    items: [
      { path: "/settings", label: "Postavke", icon: Settings, permission: "settings.view" },
      { path: "/users", label: "Korisnici", icon: Users, permission: "users.view" },
      { path: "/roles", label: "Role", icon: Shield, permission: "roles.view" },
      { path: "/audit", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
    ],
  },
]

const roleColors: Record<string, string> = {
  admin: "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
  disponent: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
  vozac: "bg-green-50 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
  viewer: "bg-muted text-muted-foreground border-border",
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, hasPermission } = useAuth()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??"

  const roleBadgeClass = roleColors[user?.role?.toLowerCase() || ""] || roleColors.viewer

  return (
    <Sidebar collapsible="icon" className="border-r-0 dark:border-r dark:border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white dark:bg-primary/10 dark:text-primary">
            <Truck className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-accent-foreground">
                FT-Logistika
              </span>
              <span className="text-[10px] text-muted-foreground">
                Delivery Management
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission)
          )
          if (visibleItems.length === 0) return null

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive =
                      item.path === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.path)
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className={
                            isActive
                              ? "bg-white text-primary font-semibold hover:bg-white data-[active=true]:bg-white data-[active=true]:text-primary dark:bg-primary/10 dark:text-primary dark:shadow-none dark:hover:bg-primary/15 dark:data-[active=true]:bg-primary/10 dark:data-[active=true]:text-primary"
                              : "text-sidebar-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground"
                          }
                        >
                          <a
                            href={item.path}
                            onClick={(e) => {
                              e.preventDefault()
                              router.push(item.path)
                            }}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <div className="mb-1 px-1">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center px-0" : ""}`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-indigo-500" />
            )}
            {!collapsed && (
              <span className="text-sm">
                {theme === "dark" ? "Svijetla tema" : "Tamna tema"}
              </span>
            )}
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
                      {user?.full_name || "Korisnik"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 w-fit text-[10px] ${roleBadgeClass}`}
                    >
                      {user?.role || "—"}
                    </Badge>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-56"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email || user?.username}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Odjava
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
