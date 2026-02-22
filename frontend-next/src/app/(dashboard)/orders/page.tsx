"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { ordersApi, routingOrdersApi, settingsApi, mantisApi, partnersApi, itemsApi } from "@/services/api"
import { useServerPref } from "@/hooks/useServerPref"
import type { NalogHeader, NalogDetail, MantisOrderSummary } from "@/types"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Trash2,
  ArrowRightLeft,
  Loader2,
  Package,
  Weight,
  Box,
  Truck,
  X,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  RefreshCw,
  GripVertical,
  Boxes,
  Pencil,
  Check,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { PermissionGuard } from "@/components/auth/permission-guard"

const VIRTUAL_COLUMN_PARTNER_KUPAC = "partner_kupac"

function getKupacValue(order: NalogHeader): string {
  const imePrezime = [order.partner_ime, order.partner_prezime].filter(Boolean).join(" ").trim()
  const naziv = (order.partner_naziv ?? "").trim()
  if (!naziv) return imePrezime || ""
  if (imePrezime) return `${naziv} => ${imePrezime}`
  return naziv
}

function formatWeight(v: number | null): string {
  if (v === null || v === undefined) return "—"
  return `${Number(v).toFixed(2)} kg`
}

function formatVolume(v: number | null): string {
  if (v === null || v === undefined) return "—"
  return `${(Number(v) / 1_000_000).toFixed(3)} m³`
}

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return "—"
  return `${Number(v).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
}

const BASE_ORDER_COLUMNS: ColumnDef<NalogHeader>[] = [
  // Default visible
  { key: "broj", header: "Broj", width: "80px" },
  { key: VIRTUAL_COLUMN_PARTNER_KUPAC, header: "Kupac", getValue: (row) => getKupacValue(row) },
  { key: "datum", header: "Datum", width: "100px" },
  { key: "raspored", header: "Raspored", width: "100px" },
  { key: "vrsta_isporuke", header: "Vrsta isporuke", width: "110px" },
  {
    key: "regija_naziv",
    header: "Regija",
    render: (row) => row.regija_naziv ? (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
        {row.regija_naziv}
      </span>
    ) : "—",
  },
  { key: "total_weight", header: "Težina (kg)", width: "100px", render: (row) => formatWeight(row.total_weight), getValue: (row) => row.total_weight },
  { key: "total_volume", header: "Volumen (m³)", width: "100px", render: (row) => formatVolume(row.total_volume), getValue: (row) => row.total_volume },
  { key: "za_naplatu", header: "Za naplatu", width: "120px", render: (row) => formatCurrency(row.za_naplatu), getValue: (row) => row.za_naplatu },
  { key: "status", header: "Status", width: "120px", render: (row) => <StatusBadge status={row.status} />, getValue: (row) => row.status },
  // Hidden by default
  { key: "kreirao__radnik_ime", header: "Kreirao", visible: false },
  { key: "korisnik__partner", header: "Korisnik partner", visible: false },
  { key: "na__skladiste", header: "Na skladište", visible: false },
  { key: "na_uvid", header: "Na uvid", visible: false },
  { key: "napomena", header: "Napomena", visible: false },
  { key: "partner", header: "Partner (šifra)", visible: false },
  { key: "partner_adresa", header: "Adresa", visible: false },
  { key: "partner_drzava", header: "Država", visible: false },
  { key: "partner_kontakt_osoba", header: "Kontakt osoba", visible: false },
  { key: "partner_mobitel", header: "Mobitel", visible: false },
  { key: "partner_naziv_mjesta", header: "Mjesto", visible: false },
  { key: "partner_postanski_broj", header: "Poštanski broj", visible: false },
  { key: "partner_telefon", header: "Telefon", visible: false },
  { key: "poruka_dolje", header: "Poruka dolje", visible: false },
  { key: "poruka_gore", header: "Poruka gore", visible: false },
  { key: "referenca_isporuke", header: "Referenca isporuke", visible: false },
  { key: "sa__skladiste", header: "Sa skladište", visible: false },
  { key: "manual_paleta", header: "Palete (ručno)", width: "90px", visible: false, render: (row) => row.manual_paleta != null ? <span className="font-medium">{row.manual_paleta}</span> : <span className="text-muted-foreground">—</span> },
  { key: "skladiste", header: "Skladište", width: "80px", visible: false },
  { key: "skl_dokument", header: "Skl. dokument", visible: false },
  { key: "valuta", header: "Valuta", visible: false },
]

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const [selectedRows, setSelectedRows] = useState(new Set<string>())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [selectedOrderUid, setSelectedOrderUid] = useState<string | null>(null)

  // Resizable detail panel (persisted per user)
  const [detailWidth, setDetailWidth] = useServerPref("orders-detail-width", 520)
  const draggingRef = useRef(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const w = window.innerWidth - e.clientX
      setDetailWidth(Math.max(350, Math.min(800, w)))
    }
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
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
  }, [setDetailWidth])

  // Data
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => ordersApi.list({ limit: 5000 }),
  })

  const { data: rutiranjeUids = [] } = useQuery({
    queryKey: ["rutiranje-uids"],
    queryFn: routingOrdersApi.getRutiranjeUids,
  })

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.list,
    staleTime: 5 * 60_000,
  })

  // Nalozi koji sadrže artikle s kriterijima (za highlight reda)
  const { data: ordersWithCriteria = [] } = useQuery({
    queryKey: ["orders-with-criteria"],
    queryFn: ordersApi.getOrdersWithCriteria,
  })
  const criteriaOrderUids = useMemo(() => new Set(ordersWithCriteria), [ordersWithCriteria])

  // Šifre artikala s kriterijem (za highlight stavki u detaljima)
  const { data: criteriaArtiklSifre = [] } = useQuery({
    queryKey: ["artikli-kriterija-sifre"],
    queryFn: itemsApi.getArtiklSifreWithCriteria,
  })
  const criteriaArtiklSet = useMemo(() => new Set(criteriaArtiklSifre), [criteriaArtiklSifre])

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

  const rutiranjeSet = useMemo(() => new Set(rutiranjeUids), [rutiranjeUids])
  const availableOrders = useMemo(
    () => orders.filter((o) => !rutiranjeSet.has(o.nalog_prodaje_uid)),
    [orders, rutiranjeSet]
  )

  const selectedTotals = useMemo(() => {
    let totalWeight = 0
    let totalVolume = 0
    let manualPaletaSum = 0
    let count = 0
    availableOrders.forEach((order) => {
      if (selectedRows.has(order.nalog_prodaje_uid)) {
        count++
        if (order.total_weight) totalWeight += Number(order.total_weight)
        if (order.total_volume) totalVolume += Number(order.total_volume)
        if (order.manual_paleta) manualPaletaSum += order.manual_paleta
      }
    })
    const volumeM3 = totalVolume / 1_000_000
    const paletaByVolume = paletaConfig.volumenM3 > 0 ? volumeM3 / paletaConfig.volumenM3 : 0
    const paletaByWeight = paletaConfig.maxTezina > 0 ? totalWeight / paletaConfig.maxTezina : 0
    const paletaCount = Math.ceil(Math.max(paletaByVolume, paletaByWeight))
    return { totalWeight, totalVolume, volumeM3, count, paletaCount, manualPaletaSum }
  }, [availableOrders, selectedRows, paletaConfig])

  // WMS bulk for all visible orders (for WMS column)
  const allVisibleUids = useMemo(() => availableOrders.map((o) => o.nalog_prodaje_uid), [availableOrders])
  const { data: wmsBulkAll } = useQuery({
    queryKey: ["mantis-bulk-all", allVisibleUids],
    queryFn: () => mantisApi.getOrdersBulk(allVisibleUids),
    enabled: allVisibleUids.length > 0,
    staleTime: 2 * 60_000,
  })

  // Dynamic columns (include WMS with closure access)
  const orderColumns = useMemo<ColumnDef<NalogHeader>[]>(() => [
    ...BASE_ORDER_COLUMNS,
    {
      key: "wms_status",
      header: "WMS",
      width: "70px",
      visible: false,
      filterable: false,
      render: (row) => {
        const wmsInfo = wmsBulkAll?.[row.nalog_prodaje_uid]
        if (!wmsInfo || !wmsInfo.has_data) {
          return <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" title="Nema WMS podataka" />
        }
        const color = wmsInfo.is_complete
          ? "bg-emerald-500"
          : wmsInfo.total_paleta > 0
            ? "bg-amber-500"
            : "bg-red-500"
        return (
          <span className="inline-flex items-center gap-1.5" title={`${wmsInfo.total_paleta} paleta${wmsInfo.is_complete ? " (složeno)" : " (u procesu)"}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
            {wmsInfo.total_paleta > 0 && <span className="text-xs font-medium">{wmsInfo.total_paleta}</span>}
          </span>
        )
      },
    },
  ], [wmsBulkAll])

  // WMS bulk for selected orders (for summary)
  const selectedUids = useMemo(() => Array.from(selectedRows), [selectedRows])
  const { data: wmsBulkData } = useQuery({
    queryKey: ["mantis-bulk-orders", selectedUids],
    queryFn: () => mantisApi.getOrdersBulk(selectedUids),
    enabled: selectedUids.length > 0,
    staleTime: 60_000,
  })

  const wmsTotals = useMemo(() => {
    if (!wmsBulkData || selectedUids.length === 0) return { totalPallets: 0, hasData: false }
    const allSscc = new Set<string>()
    let hasAnyData = false
    for (const uid of selectedUids) {
      const s = wmsBulkData[uid]
      if (!s || !s.has_data) continue
      hasAnyData = true
      for (const it of s.items) { if (it.sscc) allSscc.add(it.sscc) }
    }
    return { totalPallets: allSscc.size, hasData: hasAnyData }
  }, [wmsBulkData, selectedUids])

  // Mutations
  const prebaciMutation = useMutation({
    mutationFn: (uids: string[]) => routingOrdersApi.prebaciURutiranje(uids),
    onSuccess: (data) => {
      toast.success("Prebačeno", `${data.prebaceno} naloga prebačeno.`)
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["rutiranje-uids"] })
      setSelectedRows(new Set())
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.deleteAndBlacklist(Array.from(selectedRows), deleteReason || undefined),
    onSuccess: (data) => {
      toast.success("Obrisano", `${data.obrisano} naloga obrisano.`)
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      setSelectedRows(new Set())
      setShowDeleteDialog(false)
      setDeleteReason("")
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const handleRowClick = useCallback((row: NalogHeader) => {
    setSelectedOrderUid((prev) => prev === row.nalog_prodaje_uid ? null : row.nalog_prodaje_uid)
  }, [])

  return (
    <PermissionGuard permission="orders.view">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Top bar: title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-lg font-semibold">Nalozi</h1>
            <p className="text-xs text-muted-foreground">{availableOrders.length} naloga dostupno</p>
          </div>
        </div>
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedRows.size} odabrano</span>
            <Button size="sm" onClick={() => prebaciMutation.mutate(Array.from(selectedRows))} disabled={prebaciMutation.isPending}>
              <ArrowRightLeft className="mr-1 h-4 w-4" />
              U rutiranje
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Obriši
            </Button>
          </div>
        )}
      </div>

      {/* Summary strip */}
      {selectedRows.size > 0 && (
        <div className="flex flex-wrap items-center gap-4 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm shrink-0">
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{selectedTotals.count}</span>
            <span className="text-muted-foreground">označenih</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Weight className="h-4 w-4 text-primary" />
            <span className="font-semibold">{selectedTotals.totalWeight.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Box className="h-4 w-4 text-primary" />
            <span className="font-semibold">{selectedTotals.volumeM3.toLocaleString("hr-HR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-success" />
            <span className="font-semibold">{selectedTotals.paletaCount}</span>
            <span className="text-muted-foreground">paleta (procjena)</span>
          </div>
          {selectedTotals.manualPaletaSum > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Pencil className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">{selectedTotals.manualPaletaSum}</span>
                <span className="text-muted-foreground">palete (ručno)</span>
              </div>
            </>
          )}
          {wmsTotals.hasData && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{wmsTotals.totalPallets}</span>
                <span className="text-muted-foreground">WMS palete</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main area: table + detail (both fill remaining height) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table panel - fills height, scrolls internally */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden p-4">
          <DataTable
            columns={orderColumns}
            data={availableOrders}
            loading={isLoading}
            pageSize={100}
            searchPlaceholder="Pretraži naloge..."
            storageKey="ft-orders-cols-v3"
            showColumnPicker
            fillHeight
            getRowId={(row) => row.nalog_prodaje_uid}
            selectedRows={selectedRows}
            onSelectRows={setSelectedRows}
            onRowClick={handleRowClick}
            emptyMessage="Nema naloga. Pokrenite sinkronizaciju."
            rowClassName={(row) =>
              criteriaOrderUids.has(row.nalog_prodaje_uid)
                ? "bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/50"
                : ""
            }
          />
        </div>

        {/* Resize handle */}
        {selectedOrderUid && (
          <div
            className="flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors shrink-0"
            onMouseDown={() => {
              draggingRef.current = true
              document.body.style.cursor = "col-resize"
              document.body.style.userSelect = "none"
            }}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}

        {/* Detail panel - fills height, scrolls internally */}
        {selectedOrderUid && (
          <div className="shrink-0 ml-2 rounded-2xl bg-white border border-white shadow-soft dark:bg-card dark:border-border dark:shadow-lg overflow-hidden flex flex-col" style={{ width: detailWidth }}>
            <OrderDetailPanel nalogUid={selectedOrderUid} onClose={() => setSelectedOrderUid(null)} criteriaArtiklSet={criteriaArtiklSet} />
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Brisanje i blokiranje naloga</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedRows.size} naloga će biti obrisano i blokirano.</p>
          <Textarea placeholder="Razlog brisanja (opcionalno)..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className="bg-secondary/50" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Odustani</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Obriši i blokiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PermissionGuard>
  )
}

/* ═══════════════════════════════════════════
   Order Detail Side Panel
   Identical fields to old frontend
   ═══════════════════════════════════════════ */
function OrderDetailPanel({ nalogUid, onClose, criteriaArtiklSet }: { nalogUid: string; onClose: () => void; criteriaArtiklSet: Set<string> }) {
  const queryClient = useQueryClient()
  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", nalogUid],
    queryFn: () => ordersApi.get(nalogUid),
    staleTime: 30_000,
  })

  // Inline editing for partner address fields
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const updatePartnerMutation = useMutation({
    mutationFn: ({ partnerUid, data }: { partnerUid: string; data: Record<string, string> }) =>
      partnersApi.update(partnerUid, data),
    onSuccess: () => {
      toast.success("Ažurirano", "Podaci partnera ažurirani.")
      queryClient.invalidateQueries({ queryKey: ["order-detail", nalogUid] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      setEditingField(null)
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field)
    setEditValue(currentValue ?? "")
  }
  const cancelEdit = () => { setEditingField(null); setEditValue("") }
  const saveEdit = (field: string) => {
    if (!order?.partner_uid) return
    updatePartnerMutation.mutate({ partnerUid: order.partner_uid, data: { [field]: editValue } })
  }

  // Manual paleta
  const [paletaInput, setPaletaInput] = useState("")
  const [editingPaleta, setEditingPaleta] = useState(false)
  const manualPaletaMutation = useMutation({
    mutationFn: (val: number | null) => ordersApi.setManualPaleta(nalogUid, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-detail", nalogUid] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      setEditingPaleta(false)
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  // WMS data
  const [wmsRefreshing, setWmsRefreshing] = useState(false)
  const { data: wmsData, refetch: refetchWms } = useQuery<MantisOrderSummary>({
    queryKey: ["mantis-order", nalogUid],
    queryFn: () => mantisApi.getOrder(nalogUid),
    staleTime: 60_000,
  })

  const handleWmsRefresh = async () => {
    setWmsRefreshing(true)
    try {
      await mantisApi.getOrder(nalogUid, true)
      refetchWms()
    } catch { /* ignore */ }
    finally { setWmsRefreshing(false) }
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }
  if (!order) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Nalog nije pronađen</div>
  }

  const kupac = getKupacValue(order)
  const details: NalogDetail[] = (order as NalogHeader & { details?: NalogDetail[] }).details || []

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header */}
      <div className="flex items-center justify-between border-b border-blue-100/50 dark:border-border px-4 py-3 shrink-0 bg-white dark:bg-card">
        <h3 className="text-sm font-bold text-slate-800 dark:text-foreground">Detalji naloga</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Zatvori</Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-4">

          {/* Kupac (full-width) */}
          <div>
            <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Kupac</span>
            <p className="text-sm font-medium text-slate-800 dark:text-foreground">{kupac || "—"}</p>
          </div>

          {/* Adresa (editable) */}
          <EditableField
            label="Adresa"
            field="adresa"
            value={order.partner_adresa}
            editingField={editingField}
            editValue={editValue}
            isPending={updatePartnerMutation.isPending}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onEditValueChange={setEditValue}
          />

          {/* Poštanski broj + Mjesto (2 columns, editable) */}
          <div className="grid grid-cols-2 gap-x-4">
            <EditableField
              label="Poštanski broj"
              field="postanski_broj"
              value={order.partner_postanski_broj}
              editingField={editingField}
              editValue={editValue}
              isPending={updatePartnerMutation.isPending}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onEditValueChange={setEditValue}
            />
            <EditableField
              label="Mjesto"
              field="naziv_mjesta"
              value={order.partner_naziv_mjesta}
              editingField={editingField}
              editValue={editValue}
              isPending={updatePartnerMutation.isPending}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onEditValueChange={setEditValue}
            />
          </div>

          {/* Broj, Datum, Raspored, Skladište, Status, Kreirao */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Broj</span>
              <p className="font-medium">{order.broj ?? "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Datum</span>
              <p className="font-medium">{order.datum ?? "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Raspored (isporuka)</span>
              <p className="font-medium">{order.raspored ?? "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Skladište</span>
              <p className="font-medium">{order.skladiste ?? "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Status</span>
              <div className="mt-0.5"><StatusBadge status={order.status} /></div>
            </div>
            <div>
              <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Kreirao</span>
              <p className="font-medium">{order.kreirao__radnik_ime ?? "—"}</p>
            </div>
          </div>

          {/* Kontakt info */}
          {(order.partner_mobitel || order.partner_telefon || order.partner_e_mail) && (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1.5">
              {(order.partner_mobitel || order.partner_telefon) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{[order.partner_mobitel, order.partner_telefon].filter(Boolean).join(" / ")}</span>
                </div>
              )}
              {order.partner_e_mail && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{order.partner_e_mail}</span>
                </div>
              )}
            </div>
          )}

          {/* Weight / Volume / Za naplatu */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-blue-50/60 dark:bg-secondary/20 p-2.5 text-center border border-blue-100/40 dark:border-border">
              <div className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Težina</div>
              <div className="text-sm font-bold text-slate-800 dark:text-foreground">{formatWeight(order.total_weight)}</div>
            </div>
            <div className="rounded-xl bg-blue-50/60 dark:bg-secondary/20 p-2.5 text-center border border-blue-100/40 dark:border-border">
              <div className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Volumen</div>
              <div className="text-sm font-bold text-slate-800 dark:text-foreground">{formatVolume(order.total_volume)}</div>
            </div>
            <div className="rounded-xl bg-blue-50/60 dark:bg-secondary/20 p-2.5 text-center border border-blue-100/40 dark:border-border">
              <div className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">Za naplatu</div>
              <div className="text-sm font-bold text-slate-800 dark:text-foreground">{formatCurrency(order.za_naplatu)}</div>
            </div>
          </div>

          <Separator />

          {/* Napomene - ALWAYS show all 4 fields */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-muted-foreground">Napomene</h4>
            <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">PORUKA GORE</span>
              <p className="mt-0.5">{order.poruka_gore ?? "—"}</p>
            </div>
            <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">PORUKA DOLJE</span>
              <p className="mt-0.5">{order.poruka_dolje ?? "—"}</p>
            </div>
            <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">NAPOMENA</span>
              <p className="mt-0.5">{order.napomena ?? "—"}</p>
            </div>
            <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
              <span className="font-medium text-amber-600">NA UVID</span>
              <p className="mt-0.5">{order.na_uvid ?? "—"}</p>
            </div>
          </div>

          <Separator />

          {/* Stavke + Manual paleta */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-muted-foreground">
                Stavke ({details.length})
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Palete:</span>
                {editingPaleta ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      value={paletaInput}
                      onChange={(e) => setPaletaInput(e.target.value)}
                      className="h-7 w-16 text-xs text-center"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = paletaInput.trim() === "" ? null : parseInt(paletaInput)
                          manualPaletaMutation.mutate(val)
                        }
                        if (e.key === "Escape") setEditingPaleta(false)
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      const val = paletaInput.trim() === "" ? null : parseInt(paletaInput)
                      manualPaletaMutation.mutate(val)
                    }}>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPaleta(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setPaletaInput(order?.manual_paleta != null ? String(order.manual_paleta) : ""); setEditingPaleta(true) }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    {order?.manual_paleta != null ? (
                      <span className="text-foreground">{order.manual_paleta}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            {details.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] py-1.5">Artikl</TableHead>
                      <TableHead className="text-[10px] py-1.5">Naziv</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Kol.</TableHead>
                      <TableHead className="text-[10px] py-1.5">JM</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Masa (kg)</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Vol. (m³)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((item, idx) => (
                      <TableRow key={item.stavka_uid || idx} className={`${item.artikl && criteriaArtiklSet.has(item.artikl) ? "bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/50" : "hover:bg-muted/30"}`}>
                        <TableCell className="text-xs py-1.5 font-mono">{item.artikl ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 max-w-[160px] truncate">{item.artikl_naziv_kratki ?? item.opis ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-medium">{item.kolicina != null ? Number(item.kolicina).toFixed(0) : "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-muted-foreground">{item.artikl_jm ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right">{item.artikl_masa != null ? Number(item.artikl_masa).toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right">{item.artikl_volumen != null ? (Number(item.artikl_volumen) / 1e6).toFixed(4) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nema stavki.</p>
            )}
          </div>

          <Separator />

          {/* Mantis WMS */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-muted-foreground">
                Mantis WMS
                {wmsData?.has_data && (
                  <Badge variant="outline" className={`ml-2 text-[10px] ${wmsData.is_complete ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                    {wmsData.total_paleta} paleta{wmsData.is_complete ? " ✓" : ""}
                  </Badge>
                )}
              </h4>
              <Button variant="ghost" size="sm" onClick={handleWmsRefresh} disabled={wmsRefreshing} className="text-xs h-7">
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${wmsRefreshing ? "animate-spin" : ""}`} />
                {wmsRefreshing ? "Osvježavam..." : "Osvježi"}
              </Button>
            </div>

            {!wmsData || !wmsData.has_data ? (
              <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
                Nema WMS podataka za ovaj nalog
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] py-1.5">Proizvod</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Kol.</TableHead>
                      <TableHead className="text-[10px] py-1.5">Status</TableHead>
                      <TableHead className="text-[10px] py-1.5">SSCC</TableHead>
                      <TableHead className="text-[10px] py-1.5">Lokacija</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wmsData.items.map((item, idx) => (
                      <TableRow key={item.id || idx} className={`hover:bg-muted/30 ${item.sscc ? "" : "bg-amber-500/5"}`}>
                        <TableCell className="text-xs py-1.5 max-w-[120px] truncate">{item.product ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-medium">{item.quantity != null ? Number(item.quantity).toFixed(0) : "—"}</TableCell>
                        <TableCell className="text-xs py-1.5">{item.item_status ?? "—"}</TableCell>
                        <TableCell className="text-xs py-1.5 font-mono text-[11px]">{item.sscc || <span className="text-amber-500 text-[10px]">Nije složeno</span>}</TableCell>
                        <TableCell className="text-xs py-1.5 text-muted-foreground">{item.location ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {wmsData?.synced_at && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Zadnji sync: {new Date(wmsData.synced_at).toLocaleString("hr-HR")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Inline Editable Field
   ═══════════════════════════════════════════ */
function EditableField({
  label, field, value, editingField, editValue, isPending,
  onStartEdit, onSaveEdit, onCancelEdit, onEditValueChange,
}: {
  label: string
  field: string
  value: string | null | undefined
  editingField: string | null
  editValue: string
  isPending: boolean
  onStartEdit: (field: string, value: string | null) => void
  onSaveEdit: (field: string) => void
  onCancelEdit: () => void
  onEditValueChange: (value: string) => void
}) {
  const isEditing = editingField === field
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-blue-500 dark:text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
        {!isEditing && (
          <button
            onClick={() => onStartEdit(field, value ?? null)}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title={`Uredi ${label.toLowerCase()}`}
          >
            <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1 mt-0.5">
          <Input
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(field); if (e.key === "Escape") onCancelEdit() }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onSaveEdit(field)} disabled={isPending}>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCancelEdit}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ) : (
        <p className="text-sm font-medium">{value ?? "—"}</p>
      )}
    </div>
  )
}
