"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  ordersApi,
  vehiclesApi,
  routesApi,
} from "@/services/api"
import {
  Package,
  Truck,
  Route,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", { limit: 10 }],
    queryFn: () => ordersApi.list({ limit: 10 }),
  })

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: vehiclesApi.list,
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["routes", { limit: 5 }],
    queryFn: () => routesApi.list({ limit: 5 }),
  })

  const stats = [
    {
      title: "Ukupno naloga",
      value: orders?.length ?? 0,
      icon: Package,
      accent: "blue" as const,
    },
    {
      title: "Aktivna vozila",
      value: vehicles?.filter((v) => v.aktivan).length ?? 0,
      icon: Truck,
      accent: "green" as const,
    },
    {
      title: "Rute danas",
      value: routes?.length ?? 0,
      icon: Route,
      accent: "amber" as const,
    },
    {
      title: "Isporuceno",
      value: "—",
      icon: CheckCircle2,
      accent: "purple" as const,
    },
  ]

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
      <PageHeader
        title="Dashboard"
        subtitle="Pregled stanja i brze akcije"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Main Content */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Zadnji nalozi</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-primary">
                Svi nalozi
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 px-2">
            {ordersLoading ? (
              <div className="flex h-32 items-center justify-center text-slate-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : orders && orders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Broj</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 5).map((order) => (
                    <TableRow key={order.nalog_prodaje_uid} className="cursor-pointer">
                      <TableCell className="font-mono text-sm font-medium text-slate-700 dark:text-foreground">
                        {order.broj ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-foreground">
                        {order.korisnik__partner ?? order.partner ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm text-slate-400 dark:text-muted-foreground">
                        {order.datum || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-slate-300 font-medium">
                Nema naloga. Pokrenite sinkronizaciju.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Routes */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Aktivne rute</CardTitle>
            <Link href="/routes">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-primary">
                Sve rute
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {routesLoading ? (
              <div className="flex h-32 items-center justify-center text-slate-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : routes && routes.length > 0 ? (
              <div className="space-y-2">
                {routes.map((route) => (
                  <Link
                    key={route.id}
                    href={`/routes/${route.id}`}
                    className="group flex items-center justify-between rounded-2xl p-4 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-slate-700 dark:text-foreground">
                        Ruta #{route.id}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-muted-foreground">
                        {route.datum} &middot; {route.stops_count} stopova
                      </span>
                    </div>
                    <StatusBadge status={route.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-slate-300 font-medium">
                Nema aktivnih ruta.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
