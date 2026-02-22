"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { routesApi } from "@/services/api"
import type { RouteListItem } from "@/types"
import { Plus } from "lucide-react"

const COLUMNS: ColumnDef<RouteListItem>[] = [
  {
    key: "id",
    header: "ID",
    width: "80px",
    getValue: (row) => String(row.id),
    render: (row) => `#${row.id}`,
  },
  { key: "datum", header: "Datum kreiranja", width: "120px" },
  {
    key: "status",
    header: "Status",
    width: "120px",
    render: (row) => <StatusBadge status={row.status} />,
    getValue: (row) => row.status ?? "",
  },
  {
    key: "stops_count",
    header: "Stopovi",
    width: "80px",
    getValue: (row) => row.stops_count ?? 0,
    render: (row) => String(row.stops_count ?? 0),
  },
  {
    key: "distance_km",
    header: "Udaljenost (km)",
    width: "120px",
    getValue: (row) => row.distance_km ?? "",
    render: (row) => (row.distance_km != null ? row.distance_km.toFixed(1) : "—"),
  },
  {
    key: "duration_min",
    header: "Trajanje (min)",
    width: "110px",
    getValue: (row) => row.duration_min ?? "",
    render: (row) => (row.duration_min != null ? String(row.duration_min) : "—"),
  },
  {
    key: "vozilo",
    header: "Vozilo",
    width: "100px",
    getValue: (row) => row.vozilo_oznaka ?? "",
    render: (row) => row.vozilo_oznaka || "—",
  },
  {
    key: "driver_name",
    header: "Vozač",
    getValue: (row) => row.driver_name ?? "",
    render: (row) =>
      row.driver_name ? (
        <span className="font-semibold text-emerald-400">{row.driver_name}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "wms_paleta",
    header: "Palete (WMS)",
    width: "100px",
    getValue: (row) => row.wms_paleta ?? "",
    render: (row) =>
      row.wms_paleta != null && row.wms_paleta > 0 ? String(row.wms_paleta) : "—",
  },
  {
    key: "raspored",
    header: "Datum dostave",
    width: "120px",
    getValue: (row) => row.raspored ?? "",
    render: (row) =>
      row.raspored ? (
        <span className="font-semibold text-blue-400">{row.raspored}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "regije",
    header: "Regije",
    width: "160px",
    getValue: (row) => row.regije ?? "",
    render: (row) =>
      row.regije ? (
        <span className="inline-flex flex-wrap gap-1">
          {row.regije.split(", ").map((r) => (
            <span
              key={r}
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
            >
              {r}
            </span>
          ))}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "actions",
    header: "",
    width: "100px",
    sortable: false,
    filterable: false,
    render: (row) => (
      <Link href={`/routes/${row.id}`}>
        <Button size="sm" variant="ghost">
          Detalji
        </Button>
      </Link>
    ),
    getValue: () => "",
  },
]

export default function RoutesHistoryPage() {
  const router = useRouter()
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: () => routesApi.list({ limit: 200 }),
  })

  return (
    <PermissionGuard permission="routes.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Povijest ruta"
        subtitle="Pregled svih kreiranih ruta"
        actions={
          <Link href="/routing">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova ruta
            </Button>
          </Link>
        }
      />

      <Card className="glass">
        <CardContent className="p-4">
          <DataTable<RouteListItem>
            storageKey="ft-routes"
            columns={COLUMNS}
            data={routes}
            loading={isLoading}
            pageSize={50}
            searchPlaceholder="Pretraži rute..."
            showColumnPicker
            getRowId={(r) => String(r.id)}
            onRowClick={(r) => router.push(`/routes/${r.id}`)}
            emptyMessage="Nema ruta za prikaz."
          />
        </CardContent>
      </Card>
      </div>
    </div>
    </PermissionGuard>
  )
}
