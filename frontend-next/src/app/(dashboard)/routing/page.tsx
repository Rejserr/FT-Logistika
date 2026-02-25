"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { toast } from "@/lib/toast"
import { routesApi, vehiclesApi, routingOrdersApi, mapsApi, settingsApi } from "@/services/api"
import type { RutiranjeNalog, Vozilo, VoziloTip, ProviderInfo } from "@/types"
import { useRoutingStore } from "@/store/routingStore"
import { useServerPref } from "@/hooks/useServerPref"
import MapView from "@/components/routing/MapView"
import { PermissionGuard } from "@/components/auth/permission-guard"
import {
  Sparkles,
  MapPin,
  Truck,
  ArrowLeft,
  Navigation,
  Loader2,
  Package,
  Weight,
  Box,
  GripVertical,
} from "lucide-react"

const ALGORITHM_OPTIONS: { value: string; label: string }[] = [
  { value: "nearest_neighbor", label: "Nearest Neighbor" },
  { value: "ortools", label: "OR-Tools (VRP)" },
  { value: "manual", label: "Ručni redoslijed" },
]

const PROVIDER_OPTIONS = [
  { value: "nominatim", label: "Nominatim (OSM)" },
  { value: "osrm", label: "OSRM" },
  { value: "ors", label: "OpenRouteService" },
  { value: "tomtom", label: "TomTom (HR+SI, truck)" },
  { value: "google", label: "Google Maps" },
]

function getKupac(order: RutiranjeNalog): string {
  if (order.kupac) return order.kupac
  const imePrezime = [order.partner_ime, order.partner_prezime].filter(Boolean).join(" ").trim()
  const naziv = (order.partner_naziv ?? "").trim()
  if (!naziv) return imePrezime || "—"
  if (imePrezime) return `${naziv} => ${imePrezime}`
  return naziv
}

function statusRutiranjaLabel(status: string | null): string {
  switch (status) {
    case "CEKA_RUTU": return "Čeka rutu"
    case "NA_RUTI": return "Na ruti"
    case "DOSTAVLJEN": return "Dostavljen"
    case "NEDOSTAVLJEN": return "Nedostavljen"
    default: return status || "—"
  }
}

const NALOZI_COLUMNS: ColumnDef<RutiranjeNalog>[] = [
  { key: "broj", header: "Broj", width: "80px" },
  { key: "kupac", header: "Kupac", getValue: (row) => getKupac(row) },
  { key: "adresa", header: "Adresa", getValue: (row) => row.partner_adresa },
  { key: "mjesto", header: "Mjesto", getValue: (row) => row.partner_naziv_mjesta },
  { key: "pb", header: "PB", getValue: (row) => row.partner_postanski_broj, width: "70px" },
  { key: "zona", header: "Zona", getValue: (row) => row.regija_naziv },
  { key: "raspored", header: "Raspored", width: "100px" },
  {
    key: "tezina",
    header: "Težina",
    width: "90px",
    getValue: (row) => row.total_weight,
    render: (row) => row.total_weight ? `${Number(row.total_weight).toFixed(1)} kg` : "—",
  },
  {
    key: "volumen",
    header: "Volumen",
    width: "90px",
    getValue: (row) => row.total_volume,
    render: (row) => row.total_volume ? `${(Number(row.total_volume) / 1e6).toFixed(3)} m³` : "—",
  },
  {
    key: "palete_rucno",
    header: "Palete",
    width: "70px",
    getValue: (row) => row.manual_paleta,
    render: (row) => row.manual_paleta ? String(row.manual_paleta) : "—",
  },
  {
    key: "status",
    header: "Status",
    width: "100px",
    getValue: (row) => row.status_rutiranja,
    render: (row) => (
      <Badge variant="outline" className="rounded-full text-[11px]">
        {statusRutiranjaLabel(row.status_rutiranja)}
      </Badge>
    ),
  },
]

type AlgorithmType = "nearest_neighbor" | "ortools" | "manual"

export default function RoutingPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [selectedRows, setSelectedRows] = useState(new Set<string>())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>("nearest_neighbor")
  const [rasporedDate, setRasporedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [isGeocoding, setIsGeocoding] = useState(false)

  const {
    selectedVehicle,
    setSelectedVehicle,
    setActiveRoute,
    setPreviewMarkers,
  } = useRoutingStore()

  // Resizable panels (persisted per user)
  const [vehiclesWidth, setVehiclesWidth] = useServerPref("routing-vehicles-w", 220)
  const [mapRatio, setMapRatio] = useServerPref("routing-map-ratio", 35)
  const draggingRef = useRef<"vehicles" | "map" | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Data queries
  const { data: rutiranjeNalozi = [], isLoading: loadingNalozi } = useQuery({
    queryKey: ["rutiranje-nalozi"],
    queryFn: routingOrdersApi.listRutiranjeNalogi,
  })

  const cekaRutuNalozi = useMemo(
    () => rutiranjeNalozi.filter((n) => n.status_rutiranja === "CEKA_RUTU"),
    [rutiranjeNalozi]
  )

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: vehiclesApi.list,
  })

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ["vehicle-types"],
    queryFn: vehiclesApi.listTypes,
  })

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["available-drivers"],
    queryFn: () => routesApi.listDrivers(),
  })

  const { data: providerInfo } = useQuery<ProviderInfo>({
    queryKey: ["provider-info"],
    queryFn: mapsApi.getProvider,
  })

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.list,
  })

  const switchProviderMutation = useMutation({
    mutationFn: mapsApi.setProvider,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["provider-info"] })
      toast.success("Provider promijenjen", `Aktivni: ${data.provider}`)
    },
  })

  const activeVehicles = useMemo(() => vehicles.filter((v: Vozilo) => v.aktivan), [vehicles])

  const vehiclesByType = useMemo(() => {
    const typeMap = new globalThis.Map<number | null, { tip: VoziloTip | null; vehicles: Vozilo[] }>()
    for (const t of vehicleTypes) {
      typeMap.set(t.id, { tip: t, vehicles: [] })
    }
    for (const v of activeVehicles) {
      const key = v.tip_id ?? null
      if (!typeMap.has(key)) {
        typeMap.set(key, { tip: null, vehicles: [] })
      }
      typeMap.get(key)!.vehicles.push(v)
    }
    return Array.from(typeMap.values())
      .filter((g) => g.vehicles.length > 0)
      .sort((a, b) => {
        if (!a.tip) return 1
        if (!b.tip) return -1
        return a.tip.naziv.localeCompare(b.tip.naziv)
      })
  }, [activeVehicles, vehicleTypes])

  const paletaConfig = useMemo(() => {
    const getVal = (key: string, def: number) => {
      const s = settings.find((s: { key: string; value: string | null }) => s.key === key)
      return s?.value ? Number(s.value) : def
    }
    const duzina = getVal("PALETA_DUZINA_MM", 1200)
    const sirina = getVal("PALETA_SIRINA_MM", 800)
    const visina = getVal("PALETA_VISINA_MM", 1800)
    const maxTezina = getVal("PALETA_MAX_TEZINA_KG", 1200)
    const volumenM3 = (duzina * sirina * visina) / 1_000_000_000
    return { maxTezina, volumenM3 }
  }, [settings])

  // Selected totals
  const checkedTotals = useMemo(() => {
    let totalWeight = 0
    let totalVolume = 0
    let totalManualPaleta = 0
    let count = 0
    cekaRutuNalozi.forEach((order) => {
      if (selectedRows.has(order.nalog_prodaje_uid)) {
        count++
        if (order.total_weight) totalWeight += Number(order.total_weight)
        if (order.total_volume) totalVolume += Number(order.total_volume)
        if (order.manual_paleta) totalManualPaleta += Number(order.manual_paleta)
      }
    })
    const volumeM3 = totalVolume / 1_000_000
    const paletaByVolume = paletaConfig.volumenM3 > 0 ? volumeM3 / paletaConfig.volumenM3 : 0
    const paletaByWeight = paletaConfig.maxTezina > 0 ? totalWeight / paletaConfig.maxTezina : 0
    const paletaCount = Math.ceil(Math.max(paletaByVolume, paletaByWeight))
    return { totalWeight, totalVolume, totalManualPaleta, count, paletaCount }
  }, [cekaRutuNalozi, selectedRows, paletaConfig])

  // Geocode preview
  const geocodeChecked = useCallback(async () => {
    const uids = cekaRutuNalozi
      .filter((o) => selectedRows.has(o.nalog_prodaje_uid))
      .map((o) => o.nalog_prodaje_uid)
    if (uids.length === 0) {
      setPreviewMarkers([])
      return
    }
    setIsGeocoding(true)
    try {
      const results = await mapsApi.geocodeOrders(uids)
      setPreviewMarkers(results)
    } catch {
      // silently fail
    } finally {
      setIsGeocoding(false)
    }
  }, [cekaRutuNalozi, selectedRows, setPreviewMarkers])

  useEffect(() => {
    const timer = setTimeout(() => { geocodeChecked() }, 600)
    return () => clearTimeout(timer)
  }, [geocodeChecked])

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      if (draggingRef.current === "vehicles") {
        setVehiclesWidth(Math.max(160, Math.min(400, x)))
      } else {
        const remaining = rect.width - vehiclesWidth - 16
        const ordersW = x - vehiclesWidth - 8
        const mapPct = Math.max(20, Math.min(70, 100 - (ordersW / remaining) * 100))
        setMapRatio(mapPct)
      }
    }
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [vehiclesWidth, mapRatio])

  const handleResizeMouseDown = useCallback((which: "vehicles" | "map") => {
    draggingRef.current = which
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  // Mutations
  const vratiMutation = useMutation({
    mutationFn: (uids: string[]) => routingOrdersApi.vratiIzRutiranja(uids),
    onSuccess: (data) => {
      toast.success("Vraćeno", `${data.vraceno} naloga vraćeno.`)
      queryClient.invalidateQueries({ queryKey: ["rutiranje-nalozi"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      setSelectedRows(new Set())
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const uids = Array.from(selectedRows)
      const vId = selectedVehicle?.id
      const dId = selectedDriverId ? Number(selectedDriverId) : undefined
      return routesApi.create({
        nalog_uids: uids,
        vozilo_id: vId,
        driver_user_id: dId,
        raspored: rasporedDate,
        algoritam: selectedAlgorithm,
      })
    },
    onSuccess: (route) => {
      toast.success("Ruta kreirana", `Ruta #${route.id} s ${route.stops.length} stopova.`)
      setActiveRoute(route)
      queryClient.invalidateQueries({ queryKey: ["rutiranje-nalozi"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      setSelectedRows(new Set())
      setShowCreateDialog(false)
      router.push(`/routes/${route.id}`)
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const handleCreateRouteClick = () => {
    if (selectedRows.size === 0) {
      toast.warning("Nema označenih", "Označite naloge za rutu.")
      return
    }
    if (!selectedVehicle) {
      toast.warning("Nema vozila", "Odaberite vozilo za rutu.")
      return
    }
    setShowCreateDialog(true)
  }

  return (
    <PermissionGuard permission="routes.create">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-card/50 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">Kreiranje rute</h1>
          <span className="text-sm text-muted-foreground">
            {cekaRutuNalozi.length} naloga čeka rutu
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Provider:</span>
            <Select
              value={providerInfo?.provider || "nominatim"}
              onValueChange={(v) => switchProviderMutation.mutate(v)}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Algoritam:</span>
            <Select
              value={selectedAlgorithm}
              onValueChange={(v) => setSelectedAlgorithm(v as AlgorithmType)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALGORITHM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            onClick={handleCreateRouteClick}
            disabled={checkedTotals.count === 0 || !selectedVehicle || createRouteMutation.isPending}
          >
            {createRouteMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Kreiraj rutu ({checkedTotals.count})
          </Button>

          {!selectedVehicle && checkedTotals.count > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Odaberite vozilo da biste kreirali rutu
            </span>
          )}

          {selectedRows.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => vratiMutation.mutate(Array.from(selectedRows))}
              disabled={vratiMutation.isPending}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Natrag
            </Button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {checkedTotals.count > 0 && (
        <div className="flex items-center gap-4 border-b border-border/50 bg-primary/5 px-4 py-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-medium">{checkedTotals.count}</span>
            <span className="text-muted-foreground">označenih</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Weight className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {checkedTotals.totalWeight.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Box className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {(checkedTotals.totalVolume / 1_000_000).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary" />
            <span className="font-medium">{checkedTotals.paletaCount}</span>
            <span className="text-muted-foreground">paleta (procjena)</span>
          </div>
          {checkedTotals.totalManualPaleta > 0 && (
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">{checkedTotals.totalManualPaleta}</span>
              <span className="text-muted-foreground">paleta (ručno)</span>
            </div>
          )}
          {isGeocoding && (
            <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Geocodiranje...</span>
            </div>
          )}
          {selectedVehicle && (
            <div className="ml-auto flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Vozilo: <span className="font-medium text-foreground">{selectedVehicle.oznaka || selectedVehicle.naziv}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>

        {/* Panel 1: Vozila */}
        <div
          className="flex flex-col border-r border-border/50 min-h-0"
          style={{ width: vehiclesWidth, minWidth: 160, maxWidth: 400 }}
        >
          <div className="flex items-center gap-2 border-b border-border/50 bg-card/30 px-3 py-2.5 shrink-0">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vozila
            </span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2">
              {vehiclesByType.map((group, groupIdx) => (
                <div key={`vtype-${group.tip?.id ?? "none"}-${groupIdx}`} className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.tip?.naziv || "Ostala"}
                  </div>
                  {group.vehicles.map((vehicle: Vozilo) => {
                    const isSelected = selectedVehicle?.id === vehicle.id
                    return (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(isSelected ? null : vehicle)}
                        className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                            : "hover:bg-accent text-foreground"
                        }`}
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {vehicle.oznaka || vehicle.naziv || `#${vehicle.id}`}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {[
                              vehicle.nosivost_kg && `${vehicle.nosivost_kg}kg`,
                              vehicle.volumen_m3 && `${vehicle.volumen_m3}m³`,
                              vehicle.paleta && `${vehicle.paleta} pal`,
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Resize handle 1 */}
        <div
          className="flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
          onMouseDown={() => handleResizeMouseDown("vehicles")}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </div>

        {/* Panel 2: Nalozi */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <DataTable
            columns={NALOZI_COLUMNS}
            data={cekaRutuNalozi}
            loading={loadingNalozi}
            pageSize={100}
            searchPlaceholder="Pretraži naloge u rutiranju..."
            storageKey="ft-routing-nalozi-v3"
            showColumnPicker
            getRowId={(row) => row.nalog_prodaje_uid}
            selectedRows={selectedRows}
            onSelectRows={setSelectedRows}
            emptyMessage="Nema naloga koji čekaju rutu."
          />
        </div>

        {/* Resize handle 2 */}
        <div
          className="flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
          onMouseDown={() => handleResizeMouseDown("map")}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </div>

        {/* Panel 3: Mapa */}
        <div
          className="flex flex-col overflow-hidden border-l border-border/50"
          style={{ width: `${mapRatio}%` }}
        >
          <MapView />
        </div>
      </div>

      {/* Create Route Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kreiraj rutu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum dostave</Label>
              <Input
                type="date"
                value={rasporedDate}
                onChange={(e) => setRasporedDate(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Vozilo</Label>
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                <Truck className="mr-2 inline h-4 w-4 text-muted-foreground" />
                {selectedVehicle?.oznaka || selectedVehicle?.naziv || "—"}
                {selectedVehicle?.nosivost_kg && (
                  <span className="ml-1 text-muted-foreground">({selectedVehicle.nosivost_kg} kg)</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vozač (opcionalno)</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="— Bez vozača —" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Algoritam</Label>
              <Select
                value={selectedAlgorithm}
                onValueChange={(v) => setSelectedAlgorithm(v as AlgorithmType)}
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALGORITHM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-sm">
                <span className="font-medium">{checkedTotals.count}</span> naloga &middot;{" "}
                <span className="font-medium">{checkedTotals.totalWeight.toFixed(1)} kg</span> &middot;{" "}
                <span className="font-medium">{checkedTotals.paletaCount} paleta</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Odustani
            </Button>
            <Button
              onClick={() => createRouteMutation.mutate()}
              disabled={createRouteMutation.isPending}
            >
              {createRouteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="mr-2 h-4 w-4" />
              )}
              Kreiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PermissionGuard>
  )
}
