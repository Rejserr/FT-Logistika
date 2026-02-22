"use client"

import { use, useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/common/status-badge"
import { RouteStopList, MapView } from "@/components/routing"
import { toast } from "@/lib/toast"
import { routesApi, routingOrdersApi } from "@/services/api"
import { useRoutingStore } from "@/store/routingStore"
import type { RouteStop } from "@/types"
import {
  ArrowLeft,
  Users,
  RefreshCw,
  CheckCircle2,
  Play,
  Flag,
  FileSpreadsheet,
  FileText,
  Printer,
  Trash2,
  AlertCircle,
  XCircle,
  SkipForward,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react"

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "DRAFT":
      return "Nacrt"
    case "PLANNED":
      return "Planirano"
    case "IN_PROGRESS":
      return "U tijeku"
    case "COMPLETED":
      return "Završeno"
    case "CANCELLED":
      return "Otkazano"
    default:
      return status || "—"
  }
}

export default function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>
}) {
  const { routeId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setActiveRoute } = useRoutingStore()
  const [returningStop, setReturningStop] = useState<string | null>(null)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const url = routesApi.exportPdf(Number(routeId))
      const resp = await fetch(url, { credentials: "include" })
      if (!resp.ok) throw new Error("PDF download failed")
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const printWindow = window.open(blobUrl)
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print()
        })
      }
    } catch {
      toast.error("Greška", "Nije moguće printati PDF.")
    } finally {
      setIsPrinting(false)
    }
  }

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => routesApi.get(Number(routeId)),
    enabled: !!routeId,
  })

  useEffect(() => {
    if (route) setActiveRoute(route)
    return () => setActiveRoute(null)
  }, [route, setActiveRoute])

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["drivers", showDriverModal],
    queryFn: () => routesApi.listDrivers(),
    enabled: showDriverModal,
    staleTime: 0,
    gcTime: 0,
  })

  const assignDriverMutation = useMutation({
    mutationFn: (driverUserId: number | null) =>
      routesApi.assignDriver(Number(routeId), driverUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["route", routeId] })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
      setShowDriverModal(false)
      toast.success(
        "Vozač dodijeljen",
        data.driver_name || "Vozač uklonjen s rute"
      )
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      routesApi.updateStatus(Number(routeId), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route", routeId] })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (newOrder: string[]) =>
      routesApi.reorder(Number(routeId), newOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route", routeId] })
    },
  })

  const optimizeMutation = useMutation({
    mutationFn: (algoritam: string) =>
      routesApi.optimize(Number(routeId), algoritam),
    onSuccess: (newRoute) => {
      router.push(`/routes/${newRoute.id}`)
      queryClient.invalidateQueries({ queryKey: ["routes"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => routesApi.delete(Number(routeId)),
    onSuccess: () => router.push("/routes"),
  })

  const obradiRutuMutation = useMutation({
    mutationFn: () => routingOrdersApi.obradiRutu(Number(routeId)),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["route", routeId] })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
      queryClient.invalidateQueries({ queryKey: ["rutiranje-nalozi"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) =>
      toast.error("Greška", (err as Error).message),
  })

  const vratiStopMutation = useMutation({
    mutationFn: ({
      nalogUid,
      destination,
    }: {
      nalogUid: string
      destination: "nalozi" | "rutiranje"
    }) =>
      routingOrdersApi.vratiStop(Number(routeId), nalogUid, destination),
    onSuccess: (data) => {
      const destLabel =
        data.destination === "nalozi" ? "naloge" : "rutiranje"
      toast.success(`Nalog vraćen u ${destLabel}`)
      setReturningStop(null)
      queryClient.invalidateQueries({ queryKey: ["route", routeId] })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
      queryClient.invalidateQueries({ queryKey: ["rutiranje-nalozi"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) => toast.error("Greška", (err as Error).message),
  })

  const handleReorder = (newOrder: string[]) => reorderMutation.mutate(newOrder)

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
        <PageHeader title="Učitavanje..." />
        <Card className="glass">
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Učitavanje detalja rute...
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
        <PageHeader title="Ruta nije pronađena" />
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">
              Ruta s ID {routeId} nije pronađena.
            </p>
            <Link href="/routes">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Povratak na listu
              </Button>
            </Link>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  const deliveredStops = route.stops.filter(
    (s: RouteStop) => s.status === "DELIVERED"
  )
  const failedStops = route.stops.filter(
    (s: RouteStop) => s.status === "FAILED"
  )
  const skippedStops = route.stops.filter(
    (s: RouteStop) => s.status === "SKIPPED"
  )
  const undeliveredStops = [...failedStops, ...skippedStops]
  const isCompleted = route.status === "COMPLETED"
  const hasUndelivered = undeliveredStops.length > 0

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title={`Ruta #${route.id}${route.regije ? ` — ${route.regije}` : ""}`}
        subtitle={`${route.datum || "Bez datuma"} - ${getStatusLabel(route.status)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/routes">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Povratak
              </Button>
            </Link>
            {route.status !== "COMPLETED" && (
              <Button
                variant="secondary"
                onClick={() => setShowDriverModal(true)}
                className="border-border"
              >
                <Users className="mr-2 h-4 w-4" />
                Vozači
              </Button>
            )}
            {route.status === "DRAFT" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => optimizeMutation.mutate("ortools")}
                  disabled={optimizeMutation.isPending}
                  className="border-border"
                >
                  {optimizeMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-optimiziraj
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate("PLANNED")}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Potvrdi rutu
                </Button>
              </>
            )}
            {route.status === "PLANNED" && (
              <Button
                onClick={() => updateStatusMutation.mutate("IN_PROGRESS")}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Play className="mr-2 h-4 w-4" />
                Pokreni dostavu
              </Button>
            )}
            {route.status === "IN_PROGRESS" && (
              <Button
                onClick={() => updateStatusMutation.mutate("COMPLETED")}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Flag className="mr-2 h-4 w-4" />
                Završi rutu
              </Button>
            )}
            {isCompleted && hasUndelivered && (
              <Button
                onClick={() => {
                  if (
                    confirm(
                      `Obraditi nedostavljene naloge s rute #${route.id}?\n\n` +
                        `Neuspjelih: ${failedStops.length} → Natrag u rutiranje\n` +
                        `Preskočenih: ${skippedStops.length} → Natrag u rutiranje`
                    )
                  ) {
                    obradiRutuMutation.mutate()
                  }
                }}
                disabled={obradiRutuMutation.isPending}
                variant="secondary"
                className="border-border"
              >
                {obradiRutuMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <AlertCircle className="mr-2 h-4 w-4" />
                Obradi nedostavljene
              </Button>
            )}
            <a
              href={routesApi.exportExcel(Number(routeId))}
              download
              className="inline-flex"
            >
              <Button variant="secondary" className="border-border">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
            </a>
            <a
              href={routesApi.exportPdf(Number(routeId))}
              download
              className="inline-flex"
            >
              <Button variant="secondary" className="border-border">
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </a>
            <Button
              variant="secondary"
              className="border-border"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Printaj
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Jeste li sigurni da želite obrisati rutu?")) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Trash2 className="mr-2 h-4 w-4" />
              Obriši
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Informacije o ruti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Status</span>
                  <div>
                    <StatusBadge status={route.status} />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Algoritam</span>
                  <p className="font-medium text-foreground">
                    {route.algoritam || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Vozilo</span>
                  <p className="font-medium text-foreground">
                    {route.vozilo_oznaka || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Vozač</span>
                  <p
                    className={
                      route.driver_name
                        ? "font-semibold text-emerald-400"
                        : "font-medium text-foreground"
                    }
                  >
                    {route.driver_name || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Udaljenost</span>
                  <p className="font-medium text-foreground">
                    {route.distance_km?.toFixed(1) || "—"} km
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Trajanje</span>
                  <p className="font-medium text-foreground">
                    {route.duration_min || "—"} min
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Broj stopova</span>
                  <p className="font-medium text-foreground">
                    {route.stops.length}
                  </p>
                </div>
                {isCompleted && (
                  <>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Dostavljeno</span>
                      <p className="font-semibold text-emerald-400">
                        <CheckCircle2 className="mr-1 inline h-4 w-4" />
                        {deliveredStops.length}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Neuspjelo</span>
                      <p
                        className={
                          undeliveredStops.length > 0
                            ? "font-semibold text-red-400"
                            : "font-semibold text-emerald-400"
                        }
                      >
                        {undeliveredStops.length > 0 ? (
                          <>
                            <XCircle className="mr-1 inline h-4 w-4" />
                            {failedStops.length} /{" "}
                            <SkipForward className="mr-1 inline h-4 w-4" />
                            {skippedStops.length}
                          </>
                        ) : (
                          "0"
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {isCompleted && hasUndelivered && (
            <Card className="glass border-orange-500/20">
              <CardHeader>
                <CardTitle className="text-base">
                  Nedostavljeni nalozi ({undeliveredStops.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ovi nalozi nisu uspješno dostavljeni. Možete ih vratiti u
                  rutiranje za novu rutu ili natrag u naloge.
                </p>
                <ul className="space-y-2">
                  {undeliveredStops.map((stop: RouteStop) => (
                    <li
                      key={stop.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                        stop.status === "FAILED"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-orange-500/30 bg-orange-500/5"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0">
                          {stop.status === "FAILED" ? (
                            <XCircle className="h-4 w-4 text-red-400" />
                          ) : (
                            <SkipForward className="h-4 w-4 text-orange-400" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {stop.partner_naziv || "Nepoznat"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[stop.partner_adresa, stop.partner_mjesto]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {returningStop === stop.nalog_uid ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                vratiStopMutation.mutate({
                                  nalogUid: stop.nalog_uid,
                                  destination: "rutiranje",
                                })
                              }
                              disabled={vratiStopMutation.isPending}
                            >
                              U rutiranje
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                vratiStopMutation.mutate({
                                  nalogUid: stop.nalog_uid,
                                  destination: "nalozi",
                                })
                              }
                              disabled={vratiStopMutation.isPending}
                              className="border-border"
                            >
                              U naloge
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReturningStop(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setReturningStop(stop.nalog_uid)}
                            className="border-border"
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Vrati
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Stopovi</CardTitle>
            </CardHeader>
            <CardContent>
              <RouteStopList
                stops={route.stops}
                routeId={route.id}
                routeStatus={route.status}
                onReorder={handleReorder}
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-h-[400px]">
          <MapView />
        </div>
      </div>

      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent className="max-w-sm bg-popover border-border text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Dodjeli vozača</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Odaberite vozača za rutu #{route.id}
          </p>
          {route.driver_name && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              Trenutni vozač:{" "}
              <strong className="text-emerald-400">{route.driver_name}</strong>
            </div>
          )}
          <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
            {availableDrivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => assignDriverMutation.mutate(d.id)}
                disabled={assignDriverMutation.isPending}
                className={`
                  flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors
                  ${
                    route.driver_user_id === d.id
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                      : "border-border bg-secondary/50 hover:bg-secondary"
                  }
                `}
              >
                <span
                  className={
                    route.driver_user_id === d.id ? "font-semibold" : ""
                  }
                >
                  {d.full_name}
                </span>
                {route.driver_user_id === d.id && (
                  <span className="text-xs font-semibold text-emerald-400">
                    Dodijeljen
                  </span>
                )}
              </button>
            ))}
            {availableDrivers.length === 0 && (
              <p className="py-5 text-center text-sm text-muted-foreground">
                Nema dostupnih vozača
              </p>
            )}
          </div>
          <DialogFooter>
            {route.driver_name && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => assignDriverMutation.mutate(null)}
                disabled={assignDriverMutation.isPending}
              >
                Ukloni vozača
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setShowDriverModal(false)}
              className="ml-auto"
            >
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
