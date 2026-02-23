"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import {
  settingsApi,
  prioritetiApi,
  statusiApi,
  syncApi,
  mapsApi,
  vrsteIsporukeApi,
  syncStatusiApi,
  ordersApi,
} from "@/services/api"
import type {
  Setting,
  Prioritet,
  StatusNaloga,
  VrstaIsporuke,
  SyncStatus,
} from "@/types"
import { toast } from "@/lib/toast"
import {
  Settings,
  Layers,
  Palette,
  ListOrdered,
  MapPin,
  Filter,
  RefreshCw,
  Loader2,
  X,
  Pencil,
  Trash2,
  Map as MapIcon,
  ExternalLink,
  Navigation,
} from "lucide-react"

type TabType =
  | "general"
  | "prioriteti"
  | "paleta"
  | "statusi"
  | "geocoding"
  | "sync"
  | "sync-kriteriji"

interface SyncJobState {
  syncId: number
  label: string
  startedAt: string
}

interface SyncLastResult {
  syncId: number
  status: string
  message: string | null
  finishedAt: string
}

const SYNC_JOBS_KEY = "ft_sync_running_jobs"
const SYNC_LAST_KEY = "ft_sync_last_results"

type SyncActionKey =
  | "refreshOrders"
  | "syncOrders"
  | "syncByRaspored"
  | "syncPartners"
  | "syncArtikli"

function loadRunningJobs(): Record<
  SyncActionKey,
  SyncJobState | null
> {
  const empty: Record<SyncActionKey, null> = {
    refreshOrders: null,
    syncOrders: null,
    syncByRaspored: null,
    syncPartners: null,
    syncArtikli: null,
  }
  if (typeof window === "undefined") return empty
  try {
    const raw = localStorage.getItem(SYNC_JOBS_KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

function saveRunningJobs(
  jobs: Record<SyncActionKey, SyncJobState | null>
) {
  if (typeof window === "undefined") return
  localStorage.setItem(SYNC_JOBS_KEY, JSON.stringify(jobs))
}

function loadLastResults(): Record<
  SyncActionKey,
  SyncLastResult | null
> {
  const empty: Record<SyncActionKey, null> = {
    refreshOrders: null,
    syncOrders: null,
    syncByRaspored: null,
    syncPartners: null,
    syncArtikli: null,
  }
  if (typeof window === "undefined") return empty
  try {
    const raw = localStorage.getItem(SYNC_LAST_KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

function saveLastResults(
  results: Record<SyncActionKey, SyncLastResult | null>
) {
  if (typeof window === "undefined") return
  localStorage.setItem(SYNC_LAST_KEY, JSON.stringify(results))
}

const SETTING_DEFINITIONS: Record<
  string,
  {
    label: string
    description: string
    type: "text" | "number" | "boolean" | "select"
    defaultValue: string
    options?: { value: string; label: string }[]
  }
> = {
  DEFAULT_SERVICE_TIME_MINUTES: {
    label: "Vrijeme servisa (min)",
    description: "Prosječno vrijeme dostave po stanici",
    type: "number",
    defaultValue: "10",
  },
  MAX_STOPS_PER_ROUTE: {
    label: "Max stanica po ruti",
    description: "Maksimalan broj stanica na jednoj ruti",
    type: "number",
    defaultValue: "30",
  },
  DEFAULT_ROUTING_ALGORITHM: {
    label: "Default algoritam",
    description: "nearest_neighbor ili ortools",
    type: "text",
    defaultValue: "nearest_neighbor",
  },
  DEPOT_LAT: {
    label: "Depot latitude",
    description: "GPS latitude skladišta",
    type: "text",
    defaultValue: "45.815",
  },
  DEPOT_LNG: {
    label: "Depot longitude",
    description: "GPS longitude skladišta",
    type: "text",
    defaultValue: "15.9819",
  },
  GEOCODING_PROVIDER: {
    label: "Geocoding / routing provider",
    description: "Odaberite provider za geocoding i rutiranje.",
    type: "select",
    defaultValue: "ors",
    options: [
      { value: "ors", label: "ORS – OpenRouteService (HR)" },
      { value: "osrm", label: "OSRM – besplatni demo server" },
      { value: "tomtom", label: "TomTom – HR + SI, truck profil" },
      { value: "google", label: "Google Maps" },
      { value: "nominatim", label: "Nominatim – OpenStreetMap" },
    ],
  },
  MAP_PROVIDER: {
    label: "Prikaz mape (tile provider)",
    description: "Odaberite koja mapa se prikazuje na routing stranici.",
    type: "select",
    defaultValue: "osm",
    options: [
      { value: "osm", label: "OpenStreetMap – besplatna, detaljne ceste" },
      { value: "tomtom", label: "TomTom – profesionalna karta" },
      { value: "tomtom-night", label: "TomTom Night – tamna tema" },
      { value: "carto-light", label: "Carto Light – svijetla, minimalistička" },
      { value: "carto-dark", label: "Carto Dark – tamna tema" },
    ],
  },
  SYNC_INTERVAL_MINUTES: {
    label: "Interval auto-synca (min)",
    description: "Interval automatske sinkronizacije s ERP-om",
    type: "number",
    defaultValue: "20",
  },
  SYNC_CONCURRENCY: {
    label: "Paralelni sync zahtjevi",
    description: "Broj paralelnih zahtjeva pri sinkronizaciji",
    type: "number",
    defaultValue: "10",
  },
  SYNC_REQUIRE_RASPORED: {
    label: "Zahtijevaj raspored za sync",
    description:
      "Ako je uključeno, nalozi bez datuma rasporeda (datum isporuke) se neće sinkronizirati iz ERP-a.",
    type: "boolean",
    defaultValue: "0",
  },
}

const PALETA_SETTINGS: Record<
  string,
  {
    label: string
    description: string
    unit: string
    defaultValue: number
  }
> = {
  PALETA_DUZINA_MM: {
    label: "Dužina palete",
    description: "Dužina standardne palete",
    unit: "mm",
    defaultValue: 1200,
  },
  PALETA_SIRINA_MM: {
    label: "Širina palete",
    description: "Širina standardne palete",
    unit: "mm",
    defaultValue: 800,
  },
  PALETA_VISINA_MM: {
    label: "Visina palete (s robom)",
    description: "Visina palete s robom za izračun volumena",
    unit: "mm",
    defaultValue: 1800,
  },
  PALETA_MAX_TEZINA_KG: {
    label: "Max težina palete",
    description: "Maksimalna nosivost jedne palete",
    unit: "kg",
    defaultValue: 1200,
  },
  PALETA_MAX_VISINA_ARTIKLA_MM: {
    label: "Max visina artikla",
    description:
      "Artikli viši od ove vrijednosti broje se kao 2 palete",
    unit: "mm",
    defaultValue: 2000,
  },
}

function BlacklistSection() {
  const queryClient = useQueryClient()
  const { data: blacklist = [], isLoading } = useQuery({
    queryKey: ["orders-blacklist"],
    queryFn: ordersApi.getBlacklist,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const unblockMut = useMutation({
    mutationFn: (uids: string[]) => ordersApi.unblacklist(uids),
    onSuccess: (data) => {
      toast.success(
        `Deblokirano ${data.uklonjeno} naloga. Sljedeći sync će ih ponovo importirati.`
      )
      queryClient.invalidateQueries({ queryKey: ["orders-blacklist"] })
      setSelected(new Set())
    },
    onError: (err) =>
      toast.error("Greška", (err as Error).message),
  })

  if (isLoading)
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Blokirani nalozi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Učitavanje...</p>
        </CardContent>
      </Card>
    )
  if (blacklist.length === 0)
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Blokirani nalozi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nema blokiranih naloga.</p>
        </CardContent>
      </Card>
    )

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Blokirani nalozi ({blacklist.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Nalozi na ovoj listi su obrisani iz sustava i neće se automatski
          importirati iz ERP-a. Označite naloge i kliknite "Deblokiraj" da
          omogućite ponovni import.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={selected.size === 0 || unblockMut.isPending}
            onClick={() => unblockMut.mutate(Array.from(selected))}
          >
            Deblokiraj ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSelected(
                selected.size === blacklist.length
                  ? new Set()
                  : new Set(blacklist.map((b) => b.nalog_prodaje_uid))
              )
            }
          >
            {selected.size === blacklist.length
              ? "Odznači sve"
              : "Označi sve"}
          </Button>
        </div>
        <ScrollArea className="h-[400px] rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead>Nalog UID</TableHead>
                <TableHead>Razlog</TableHead>
                <TableHead>Blokirao</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacklist.map((b) => (
                <TableRow key={b.nalog_prodaje_uid} className="border-border">
                  <TableCell>
                    <Checkbox
                      checked={selected.has(b.nalog_prodaje_uid)}
                      onCheckedChange={() => {
                        const next = new Set(selected)
                        if (next.has(b.nalog_prodaje_uid))
                          next.delete(b.nalog_prodaje_uid)
                        else next.add(b.nalog_prodaje_uid)
                        setSelected(next)
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {b.nalog_prodaje_uid}
                  </TableCell>
                  <TableCell>{b.razlog || "—"}</TableCell>
                  <TableCell>{b.blocked_by || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {b.blocked_at
                      ? new Date(b.blocked_at).toLocaleString("hr-HR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>(
    {}
  )
  const [showPrioritetModal, setShowPrioritetModal] = useState(false)
  const [editingPrioritet, setEditingPrioritet] = useState<Prioritet | null>(null)
  const [prioritetForm, setPrioritetForm] = useState({
    naziv: "",
    tezina: 0,
    aktivan: true,
  })
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState<StatusNaloga | null>(null)
  const [statusForm, setStatusForm] = useState({
    id: "",
    naziv: "",
    opis: "",
    redoslijed: 0,
    aktivan: true,
  })

  const [newVrstaIsporuke, setNewVrstaIsporuke] = useState("")
  const [newVrstaOpis, setNewVrstaOpis] = useState("")
  const [newSyncStatusId, setNewSyncStatusId] = useState("")
  const [newSyncStatusNaziv, setNewSyncStatusNaziv] = useState("")

  const [manualCoordsId, setManualCoordsId] = useState<number | null>(null)
  const [manualLat, setManualLat] = useState("")
  const [manualLng, setManualLng] = useState("")
  const [geoCacheSearch, setGeoCacheSearch] = useState("")
  const [geoCacheSearchInput, setGeoCacheSearchInput] = useState("")
  const [editingCacheId, setEditingCacheId] = useState<number | null>(null)
  const [editCoords, setEditCoords] = useState("")

  const [runningJobs, setRunningJobs] = useState<
    Record<SyncActionKey, SyncJobState | null>
  >(loadRunningJobs)
  const [lastResults, setLastResults] = useState<
    Record<SyncActionKey, SyncLastResult | null>
  >(loadLastResults)
  const [syncProgress, setSyncProgress] = useState<
    Record<SyncActionKey, string | null>
  >({
    refreshOrders: null,
    syncOrders: null,
    syncByRaspored: null,
    syncPartners: null,
    syncArtikli: null,
  })
  const [syncOrdersDateFrom, setSyncOrdersDateFrom] = useState("")
  const [syncOrdersDateTo, setSyncOrdersDateTo] = useState("")
  const [syncRasporedDate, setSyncRasporedDate] = useState("")
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.list,
  })

  const { data: prioriteti = [], isLoading: prioritetiLoading } = useQuery({
    queryKey: ["prioriteti"],
    queryFn: prioritetiApi.list,
  })

  const { data: statusi = [], isLoading: statusiLoading } = useQuery({
    queryKey: ["statusi"],
    queryFn: statusiApi.list,
  })

  const { data: vrsteIsporuke = [] } = useQuery({
    queryKey: ["vrste-isporuke"],
    queryFn: () => vrsteIsporukeApi.list(),
    enabled: activeTab === "sync-kriteriji",
  })

  const { data: syncStatusi = [] } = useQuery({
    queryKey: ["sync-statusi"],
    queryFn: syncStatusiApi.list,
    enabled: activeTab === "sync-kriteriji",
  })

  const {
    data: failedGeocoding = [],
    isLoading: failedGeoLoading,
    refetch: refetchFailed,
  } = useQuery({
    queryKey: ["failed-geocoding"],
    queryFn: mapsApi.getFailedGeocoding,
    enabled: activeTab === "geocoding",
  })

  const {
    data: geoCacheResults = [],
    isLoading: geoCacheLoading,
    refetch: refetchGeoCache,
  } = useQuery({
    queryKey: ["geocoding-cache-search", geoCacheSearch],
    queryFn: () => mapsApi.searchGeocodingCache(geoCacheSearch, 100),
    enabled: activeTab === "geocoding" && geoCacheSearch.length > 0,
  })

  useEffect(() => {
    saveRunningJobs(runningJobs)
  }, [runningJobs])
  useEffect(() => {
    saveLastResults(lastResults)
  }, [lastResults])

  useEffect(() => {
    if (settings.length > 0) {
      const initial: Record<string, string> = {}
      const upperLookup = new globalThis.Map<string, string>()
      settings.forEach((s: Setting) => {
        initial[s.key] = s.value || ""
        upperLookup.set(s.key.toUpperCase(), s.value || "")
      })
      Object.entries(SETTING_DEFINITIONS).forEach(([key, def]) => {
        const dbVal = upperLookup.get(key.toUpperCase())
        if (dbVal !== undefined && dbVal !== "") {
          initial[key] = dbVal
        } else if (!(key in initial) || !initial[key]) {
          initial[key] = def.defaultValue
        }
      })
      Object.entries(PALETA_SETTINGS).forEach(([key, def]) => {
        const dbVal = upperLookup.get(key.toUpperCase())
        if (dbVal !== undefined && dbVal !== "") {
          initial[key] = dbVal
        } else if (!(key in initial) || !initial[key]) {
          initial[key] = String(def.defaultValue)
        }
      })
      setEditedSettings(initial)
    } else {
      const initial: Record<string, string> = {}
      Object.entries(SETTING_DEFINITIONS).forEach(([key, def]) => {
        initial[key] = def.defaultValue
      })
      Object.entries(PALETA_SETTINGS).forEach(([key, def]) => {
        initial[key] = String(def.defaultValue)
      })
      setEditedSettings(initial)
    }
  }, [settings])

  const markJobRunning = useCallback(
    (key: SyncActionKey, syncId: number, label: string) => {
      setRunningJobs((prev) => ({
        ...prev,
        [key]: { syncId, label, startedAt: new Date().toISOString() },
      }))
    },
    []
  )

  const markJobFinished = useCallback(
    (
      key: SyncActionKey,
      syncId: number,
      status: string,
      message: string | null
    ) => {
      setRunningJobs((prev) => ({ ...prev, [key]: null }))
      setSyncProgress((prev) => ({ ...prev, [key]: null }))
      setLastResults((prev) => ({
        ...prev,
        [key]: { syncId, status, message, finishedAt: new Date().toISOString() },
      }))
    },
    []
  )

  useEffect(() => {
    const poll = async () => {
      const jobs = loadRunningJobs()
      const keys = Object.keys(jobs) as SyncActionKey[]
      for (const key of keys) {
        const job = jobs[key]
        if (!job) continue
        try {
          const resp = await syncApi.status(job.syncId)
          if (resp.status === "COMPLETED" || resp.status === "FAILED") {
            markJobFinished(key, job.syncId, resp.status, resp.message)
            if (resp.status === "COMPLETED") {
              toast.success(`${job.label} - završeno`)
            } else {
              toast.error(
                `${job.label} - greška`,
                resp.message || "Nepoznata greška"
              )
            }
          } else if (resp.status === "IN_PROGRESS" && resp.message) {
            setSyncProgress((prev) => ({ ...prev, [key]: resp.message }))
          }
        } catch {
          // skip
        }
      }
    }
    poll()
    pollIntervalRef.current = setInterval(poll, 3000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [markJobFinished])

  const isSyncRunning = (key: SyncActionKey) => !!runningJobs[key]

  const launchSync = useCallback(
    async (
      key: SyncActionKey,
      label: string,
      apiFn: () => Promise<{
        sync_id: number
        status: string
        message: string | null
      }>
    ) => {
      try {
        const resp = await apiFn()
        markJobRunning(key, resp.sync_id, label)
        toast.success(`${label} - pokrenuto (ID: ${resp.sync_id})`)
      } catch (err) {
        toast.error(`${label} - greška`, (err as Error).message)
      }
    },
    [markJobRunning]
  )

  const saveSettingsMutation = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      settingsApi.bulkUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      toast.success("Postavke spremljene")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const createPrioritetMutation = useMutation({
    mutationFn: prioritetiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prioriteti"] })
      setShowPrioritetModal(false)
      setEditingPrioritet(null)
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updatePrioritetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Prioritet> }) =>
      prioritetiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prioriteti"] })
      setShowPrioritetModal(false)
      setEditingPrioritet(null)
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deletePrioritetMutation = useMutation({
    mutationFn: prioritetiApi.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prioriteti"] }),
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const createStatusMutation = useMutation({
    mutationFn: statusiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statusi"] })
      setShowStatusModal(false)
      setEditingStatus(null)
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: { id: string; data: Partial<StatusNaloga> }) =>
      statusiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statusi"] })
      setShowStatusModal(false)
      setEditingStatus(null)
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deleteStatusMutation = useMutation({
    mutationFn: statusiApi.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["statusi"] }),
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const createVrstaMutation = useMutation({
    mutationFn: vrsteIsporukeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vrste-isporuke"] })
      setNewVrstaIsporuke("")
      setNewVrstaOpis("")
      toast.success("Vrsta isporuke dodana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updateVrstaMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: { id: number; data: Partial<VrstaIsporuke> }) =>
      vrsteIsporukeApi.update(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["vrste-isporuke"] }),
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deleteVrstaMutation = useMutation({
    mutationFn: vrsteIsporukeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vrste-isporuke"] })
      toast.success("Vrsta isporuke obrisana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const createSyncStatusMutation = useMutation({
    mutationFn: syncStatusiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-statusi"] })
      setNewSyncStatusId("")
      setNewSyncStatusNaziv("")
      toast.success("Sync status dodan")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updateSyncStatusMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: { id: number; data: Partial<SyncStatus> }) =>
      syncStatusiApi.update(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["sync-statusi"] }),
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deleteSyncStatusMutation = useMutation({
    mutationFn: syncStatusiApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-statusi"] })
      toast.success("Sync status obrisan")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const editCoordsMutation = useMutation({
    mutationFn: ({
      id,
      lat,
      lng,
    }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      toast.success(
        `Koordinate ažurirane za: ${data.address.substring(0, 40)}...`
      )
      setEditingCacheId(null)
      setEditCoords("")
      refetchGeoCache()
      refetchFailed()
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const retryGeoMutation = useMutation({
    mutationFn: mapsApi.retryFailedGeocoding,
    onSuccess: (data) => {
      toast.success(
        `Ponovo geocodirano: ${data.fixed} od ${data.retried} popravljeno`
      )
      refetchFailed()
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const setManualCoordsMutation = useMutation({
    mutationFn: ({
      id,
      lat,
      lng,
    }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      toast.success(
        `Koordinate postavljene za: ${data.address.substring(0, 40)}...`
      )
      setManualCoordsId(null)
      setManualLat("")
      setManualLng("")
      refetchFailed()
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deleteCacheMutation = useMutation({
    mutationFn: mapsApi.deleteGeocodingCache,
    onSuccess: (data) => {
      toast.success(
        `Obrisano iz cache-a: ${data.address.substring(0, 40)}...`
      )
      refetchFailed()
      refetchGeoCache()
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const handleSaveSettings = () => {
    const toSave: Record<string, string | null> = {}
    Object.entries(editedSettings).forEach(([key, value]) => {
      toSave[key] = value || null
    })
    saveSettingsMutation.mutate(toSave)
  }

  const handleSettingChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }))
  }

  const openPrioritetModal = (prioritet?: Prioritet) => {
    if (prioritet) {
      setEditingPrioritet(prioritet)
      setPrioritetForm({
        naziv: prioritet.naziv,
        tezina: prioritet.tezina,
        aktivan: prioritet.aktivan,
      })
    } else {
      setEditingPrioritet(null)
      setPrioritetForm({ naziv: "", tezina: 0, aktivan: true })
    }
    setShowPrioritetModal(true)
  }

  const closePrioritetModal = () => {
    setShowPrioritetModal(false)
    setEditingPrioritet(null)
  }

  const handlePrioritetSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingPrioritet) {
      updatePrioritetMutation.mutate({
        id: editingPrioritet.id,
        data: prioritetForm,
      })
    } else {
      createPrioritetMutation.mutate(prioritetForm)
    }
  }

  const openStatusModal = (s?: StatusNaloga) => {
    if (s) {
      setEditingStatus(s)
      setStatusForm({
        id: s.id,
        naziv: s.naziv,
        opis: s.opis || "",
        redoslijed: s.redoslijed,
        aktivan: s.aktivan,
      })
    } else {
      setEditingStatus(null)
      setStatusForm({
        id: "",
        naziv: "",
        opis: "",
        redoslijed: (statusi.length + 1) * 10,
        aktivan: true,
      })
    }
    setShowStatusModal(true)
  }

  const closeStatusModal = () => {
    setShowStatusModal(false)
    setEditingStatus(null)
  }

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingStatus) {
      updateStatusMutation.mutate({
        id: editingStatus.id,
        data: {
          naziv: statusForm.naziv,
          opis: statusForm.opis || null,
          redoslijed: statusForm.redoslijed,
          aktivan: statusForm.aktivan,
        },
      })
    } else {
      createStatusMutation.mutate(statusForm)
    }
  }

  const handleRefreshOrders = () => {
    if (isSyncRunning("refreshOrders")) return
    launchSync("refreshOrders", "Osvježi naloge", () =>
      syncApi.refreshOrders(undefined)
    )
  }

  const handleSyncOrders = () => {
    if (isSyncRunning("syncOrders")) return
    if (!syncOrdersDateFrom || !syncOrdersDateTo) {
      toast.warning(
        "Odaberite period",
        "Molim odaberite datum OD i DO za sinkronizaciju."
      )
      return
    }
    launchSync("syncOrders", "Sinkronizacija naloga", () =>
      syncApi.syncOrders({
        datum_od: syncOrdersDateFrom,
        datum_do: syncOrdersDateTo,
      })
    )
  }

  const handleSyncPartners = () => {
    if (isSyncRunning("syncPartners")) return
    launchSync("syncPartners", "Sinkronizacija partnera", () =>
      syncApi.syncPartners()
    )
  }

  const handleSyncArtikli = () => {
    if (isSyncRunning("syncArtikli")) return
    launchSync("syncArtikli", "Sinkronizacija artikala", () =>
      syncApi.syncArtikli()
    )
  }

  const handleSyncByRaspored = () => {
    if (isSyncRunning("syncByRaspored")) return
    if (!syncRasporedDate) {
      toast.warning(
        "Odaberite datum",
        "Molim odaberite datum rasporeda (isporuke)."
      )
      return
    }
    launchSync("syncByRaspored", "Sync po rasporedu", () =>
      syncApi.syncByRaspored({ raspored_datum: syncRasporedDate })
    )
  }

  const formatSyncTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return iso
    }
  }

  const prioritetiColumns: ColumnDef<Prioritet>[] = [
    { key: "naziv", header: "Naziv", getValue: (p) => p.naziv },
    { key: "tezina", header: "Težina", getValue: (p) => String(p.tezina) },
    {
      key: "aktivan",
      header: "Status",
      getValue: (p) => (p.aktivan ? "Aktivan" : "Neaktivan"),
      render: (p) => (
        <Badge variant={p.aktivan ? "default" : "secondary"}>
          {p.aktivan ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openPrioritetModal(p)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (confirm("Obrisati prioritet?"))
                deletePrioritetMutation.mutate(p.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const statusiColumns: ColumnDef<StatusNaloga>[] = [
    { key: "id", header: "ID", getValue: (s) => s.id },
    { key: "naziv", header: "Naziv", getValue: (s) => s.naziv },
    {
      key: "opis",
      header: "Opis",
      getValue: (s) => s.opis ?? "",
      render: (s) => s.opis || "—",
    },
    { key: "redoslijed", header: "Redoslijed", getValue: (s) => String(s.redoslijed) },
    {
      key: "aktivan",
      header: "Status",
      getValue: (s) => (s.aktivan ? "Aktivan" : "Neaktivan"),
      render: (s) => (
        <Badge variant={s.aktivan ? "default" : "secondary"}>
          {s.aktivan ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (s) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openStatusModal(s)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (confirm("Obrisati status?"))
                deleteStatusMutation.mutate(s.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PermissionGuard permission="settings.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Postavke"
        subtitle="Konfiguracija sustava"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 border border-border p-1">
          <TabsTrigger value="general" className="gap-1">
            <Settings className="h-3.5 w-3.5" />
            Opće postavke
          </TabsTrigger>
          <TabsTrigger value="prioriteti" className="gap-1">
            <Layers className="h-3.5 w-3.5" />
            Prioriteti ({prioriteti.length})
          </TabsTrigger>
          <TabsTrigger value="paleta" className="gap-1">
            <Palette className="h-3.5 w-3.5" />
            Izračun palete
          </TabsTrigger>
          <TabsTrigger value="statusi" className="gap-1">
            <ListOrdered className="h-3.5 w-3.5" />
            Statusi ({statusi.length})
          </TabsTrigger>
          <TabsTrigger value="geocoding" className="gap-1">
            <MapPin className="h-3.5 w-3.5" />
            Geocoding
            {failedGeocoding.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {failedGeocoding.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sync-kriteriji" className="gap-1">
            <Filter className="h-3.5 w-3.5" />
            Sync kriteriji
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Sinkronizacija s ERP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Opće postavke</CardTitle>
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Spremi promjene
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <p className="text-muted-foreground">Učitavanje...</p>
              ) : (
                <>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm">
                    <strong>Preporuke za najtočnije rutiranje:</strong>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>
                        <strong>ORS:</strong> OpenRouteService – postavite ORS_API_KEY u .env
                      </li>
                      <li>
                        <strong>TomTom:</strong> Profesionalni provider s truck profilom
                      </li>
                      <li>
                        <strong>OSRM:</strong> Besplatni demo server – brz, bez API ključa
                      </li>
                      <li>
                        <strong>Algoritam:</strong> nearest_neighbor ili ortools
                      </li>
                      <li>
                        <strong>Depot:</strong> Postavite DEPOT_LAT i DEPOT_LNG
                      </li>
                    </ul>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(SETTING_DEFINITIONS).map(([key, def]) => (
                      <div
                        key={key}
                        className="space-y-2 rounded-lg border border-border/50 p-4"
                      >
                        <Label htmlFor={key}>{def.label}</Label>
                        <p className="text-xs text-muted-foreground">
                          {def.description}
                        </p>
                        {def.type === "select" && def.options ? (
                          <Select
                            value={
                              editedSettings[key] || def.defaultValue
                            }
                            onValueChange={(v) =>
                              handleSettingChange(key, v)
                            }
                          >
                            <SelectTrigger
                              id={key}
                              className="bg-secondary/50 border-border"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {def.options.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={key}
                            type={def.type === "number" ? "number" : "text"}
                            value={editedSettings[key] || ""}
                            onChange={(e) =>
                              handleSettingChange(key, e.target.value)
                            }
                            placeholder={`Default: ${def.defaultValue}`}
                            className="bg-secondary/50 border-border"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paleta" className="mt-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Izračun palete</CardTitle>
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
              >
                Spremi promjene
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Konfigurirajte parametre za izračun broja paleta. Broj paleta =
                MAX( Σ volumen / volumen_palete , Σ težina / max_težina ). Ako
                artikl ima visinu &gt; max visina artikla, broji se kao 2
                palete.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(PALETA_SETTINGS).map(([key, def]) => (
                  <div
                    key={key}
                    className="flex items-end gap-2 rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={key}>{def.label}</Label>
                      <p className="text-xs text-muted-foreground">
                        {def.description}
                      </p>
                      <Input
                        id={key}
                        type="number"
                        value={editedSettings[key] ?? def.defaultValue}
                        onChange={(e) =>
                          handleSettingChange(key, e.target.value)
                        }
                        className="bg-secondary/50 border-border"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground pb-2">
                      {def.unit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <span className="text-sm font-medium">Volumen palete: </span>
                <span className="font-mono">
                  {(
                    ((Number(editedSettings["PALETA_DUZINA_MM"]) || 1200) *
                      (Number(editedSettings["PALETA_SIRINA_MM"]) || 800) *
                      (Number(editedSettings["PALETA_VISINA_MM"]) || 1800)) /
                    1_000_000_000
                  ).toFixed(3)}{" "}
                  m³
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prioriteti" className="mt-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prioriteti isporuke</CardTitle>
              <Button onClick={() => openPrioritetModal()}>
                Novi prioritet
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={prioritetiColumns}
                data={prioriteti}
                loading={prioritetiLoading}
                storageKey="ft-prioriteti"
                emptyMessage="Nema prioriteta."
                getRowId={(p) => String(p.id)}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPrioritetModal()}
                  >
                    Novi prioritet
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statusi" className="mt-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Statusi naloga</CardTitle>
              <Button onClick={() => openStatusModal()}>Novi status</Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={statusiColumns}
                data={statusi}
                loading={statusiLoading}
                storageKey="ft-statusi"
                emptyMessage="Nema statusa."
                getRowId={(s) => s.id}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStatusModal()}
                  >
                    Novi status
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geocoding" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle>Geocoding – neuspjele adrese</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchFailed()}
                >
                  Osvježi
                </Button>
                <Button
                  onClick={() => retryGeoMutation.mutate()}
                  disabled={
                    failedGeocoding.length === 0 || retryGeoMutation.isPending
                  }
                >
                  {retryGeoMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Ponovi geocoding za sve ({failedGeocoding.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                <strong>Zašto geocoding ne uspijeva?</strong>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Skraćenice, zagrade – sustav pokušava proširiti</li>
                  <li>Mala mjesta možda nisu u bazi providera</li>
                  <li>Koristite "Ponovi geocoding" ili ručno unesite GPS</li>
                </ul>
              </div>
              {failedGeoLoading ? (
                <p className="text-muted-foreground">Učitavanje...</p>
              ) : failedGeocoding.length === 0 ? (
                <p className="text-green-600 dark:text-green-400">
                  Sve adrese su uspješno geocodirane!
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>ID</TableHead>
                        <TableHead>Adresa</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedGeocoding.map((entry) => (
                        <TableRow key={entry.id} className="border-border">
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {entry.address}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.provider || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.updated_at
                              ? new Date(
                                  entry.updated_at
                                ).toLocaleDateString("hr-HR")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {manualCoordsId === entry.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  placeholder="Lat"
                                  value={manualLat}
                                  onChange={(e) =>
                                    setManualLat(e.target.value)
                                  }
                                  className="w-24 h-8 text-sm bg-secondary/50"
                                />
                                <Input
                                  type="number"
                                  step="0.0001"
                                  placeholder="Lng"
                                  value={manualLng}
                                  onChange={(e) =>
                                    setManualLng(e.target.value)
                                  }
                                  className="w-24 h-8 text-sm bg-secondary/50"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const lat = parseFloat(manualLat)
                                    const lng = parseFloat(manualLng)
                                    if (
                                      isNaN(lat) ||
                                      isNaN(lng)
                                    ) {
                                      toast.error(
                                        "Unesite valjane koordinate"
                                      )
                                      return
                                    }
                                    setManualCoordsMutation.mutate({
                                      id: entry.id,
                                      lat,
                                      lng,
                                    })
                                  }}
                                  disabled={setManualCoordsMutation.isPending}
                                >
                                  Spremi
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setManualCoordsId(null)
                                    setManualLat("")
                                    setManualLng("")
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setManualCoordsId(entry.id)}
                                  title="Ručno unesite GPS koordinate"
                                >
                                  <Navigation className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    window.open(
                                      `https://www.google.com/maps/search/${encodeURIComponent(entry.address)}`,
                                      "_blank"
                                    )
                                  }
                                  title="Otvori u Google Maps"
                                >
                                  <MapIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Obrisati cache za "${entry.address}"?`
                                      )
                                    )
                                      deleteCacheMutation.mutate(entry.id)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Pretraži i ispravi geocoding koordinate</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pretražite adresu, otvorite Google Maps za koordinate, zatim
                unesite lat, lng.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={geoCacheSearchInput}
                  onChange={(e) =>
                    setGeoCacheSearchInput(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      setGeoCacheSearch(geoCacheSearchInput)
                  }}
                  placeholder="Pretražite adresu..."
                  className="flex-1 bg-secondary/50 border-border"
                />
                <Button onClick={() => setGeoCacheSearch(geoCacheSearchInput)}>
                  Pretraži
                </Button>
              </div>
              {geoCacheLoading ? (
                <p className="text-muted-foreground">Pretraživanje...</p>
              ) : geoCacheSearch.length === 0 ? (
                <p className="text-muted-foreground">
                  Unesite pojam pretrage za pregled geocoding cache-a
                </p>
              ) : geoCacheResults.length === 0 ? (
                <p className="text-muted-foreground">
                  Nema rezultata za &quot;{geoCacheSearch}&quot;
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>ID</TableHead>
                        <TableHead>Adresa</TableHead>
                        <TableHead>Lat</TableHead>
                        <TableHead>Lng</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {geoCacheResults.map((entry) => (
                        <TableRow
                          key={entry.id}
                          className={`border-border ${
                            !entry.lat
                              ? "bg-red-500/10"
                              : entry.provider === "manual"
                                ? "bg-green-500/10"
                                : ""
                          }`}
                        >
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.id}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {entry.address}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.lat != null
                              ? entry.lat.toFixed(6)
                              : "NULL"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.lng != null
                              ? entry.lng.toFixed(6)
                              : "NULL"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {entry.provider || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {editingCacheId === entry.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  placeholder="45.82466, 15.70094"
                                  value={editCoords}
                                  onChange={(e) =>
                                    setEditCoords(e.target.value)
                                  }
                                  className="w-48 h-8 text-sm bg-secondary/50"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const parts = editCoords
                                      .split(",")
                                      .map((s) => s.trim())
                                    if (parts.length === 2) {
                                      const lat = parseFloat(parts[0])
                                      const lng = parseFloat(parts[1])
                                      if (
                                        !isNaN(lat) &&
                                        !isNaN(lng) &&
                                        lat >= -90 &&
                                        lat <= 90 &&
                                        lng >= -180 &&
                                        lng <= 180
                                      ) {
                                        editCoordsMutation.mutate({
                                          id: entry.id,
                                          lat,
                                          lng,
                                        })
                                      } else {
                                        toast.error(
                                          "Neispravne koordinate. Format: lat, lng"
                                        )
                                      }
                                    } else {
                                      toast.error(
                                        "Format: lat, lng (npr. 45.82466, 15.70094)"
                                      )
                                    }
                                  }}
                                  disabled={editCoordsMutation.isPending}
                                >
                                  Spremi
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingCacheId(null)
                                    setEditCoords("")
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingCacheId(entry.id)
                                    setEditCoords(
                                      entry.lat != null && entry.lng != null
                                        ? `${entry.lat.toFixed(6)}, ${entry.lng.toFixed(6)}`
                                        : ""
                                    )
                                  }}
                                  title="Uredi koordinate"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    window.open(
                                      `https://www.google.com/maps/search/${encodeURIComponent(entry.address)}`,
                                      "_blank"
                                    )
                                  }
                                  title="Otvori u Google Maps"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                {entry.lat != null && entry.lng != null && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      window.open(
                                        `https://www.google.com/maps?q=${entry.lat},${entry.lng}`,
                                        "_blank"
                                      )
                                    }
                                    title="Prikaži koordinate na karti"
                                  >
                                    <MapPin className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Obrisati cache za "${entry.address}"?`
                                      )
                                    )
                                      deleteCacheMutation.mutate(entry.id)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync-kriteriji" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Vrste isporuke ({vrsteIsporuke.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                Samo nalozi s aktivnom vrstom isporuke se sinkroniziraju iz
                ERP-a.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Šifra (npr. DOSTAVA)"
                  value={newVrstaIsporuke}
                  onChange={(e) =>
                    setNewVrstaIsporuke(e.target.value)
                  }
                  className="w-40 bg-secondary/50 border-border"
                />
                <Input
                  placeholder="Opis (opcijski)"
                  value={newVrstaOpis}
                  onChange={(e) => setNewVrstaOpis(e.target.value)}
                  className="flex-1 min-w-[120px] bg-secondary/50 border-border"
                />
                <Button
                  size="sm"
                  disabled={!newVrstaIsporuke.trim() || createVrstaMutation.isPending}
                  onClick={() => {
                    if (!newVrstaIsporuke.trim()) return
                    createVrstaMutation.mutate({
                      vrsta_isporuke: newVrstaIsporuke.trim(),
                      opis: newVrstaOpis.trim() || undefined,
                    })
                  }}
                >
                  Dodaj
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Vrsta isporuke</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead>Aktivna</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vrsteIsporuke.map((v: VrstaIsporuke) => (
                    <TableRow
                      key={v.id}
                      className={`border-border ${!v.aktivan ? "opacity-60" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {v.vrsta_isporuke}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.opis || "—"}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={v.aktivan}
                          onCheckedChange={(c) =>
                            updateVrstaMutation.mutate({
                              id: v.id,
                              data: { aktivan: !!c },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Obrisati vrstu isporuke "${v.vrsta_isporuke}"?`
                              )
                            )
                              deleteVrstaMutation.mutate(v.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Statusi naloga za sync ({syncStatusi.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                Definirajte u kojim ERP statusima se nalozi sinkroniziraju. Ako
                je lista prazna, koriste se defaultni statusi: 08, 101, 102,
                103.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Status ID (npr. 08, 101)"
                  value={newSyncStatusId}
                  onChange={(e) =>
                    setNewSyncStatusId(e.target.value)
                  }
                  className="w-40 bg-secondary/50 border-border"
                />
                <Input
                  placeholder="Naziv (npr. Odobreno)"
                  value={newSyncStatusNaziv}
                  onChange={(e) =>
                    setNewSyncStatusNaziv(e.target.value)
                  }
                  className="flex-1 min-w-[120px] bg-secondary/50 border-border"
                />
                <Button
                  size="sm"
                  disabled={
                    !newSyncStatusId.trim() ||
                    createSyncStatusMutation.isPending
                  }
                  onClick={() => {
                    if (!newSyncStatusId.trim()) return
                    createSyncStatusMutation.mutate({
                      status_id: newSyncStatusId.trim(),
                      naziv: newSyncStatusNaziv.trim() || undefined,
                    })
                  }}
                >
                  Dodaj
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Status ID</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead>Aktivan</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncStatusi.map((ss: SyncStatus) => (
                    <TableRow
                      key={ss.id}
                      className={`border-border ${!ss.aktivan ? "opacity-60" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {ss.status_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ss.naziv || "—"}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={ss.aktivan}
                          onCheckedChange={(c) =>
                            updateSyncStatusMutation.mutate({
                              id: ss.id,
                              data: { aktivan: !!c },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Obrisati sync status "${ss.status_id}"?`
                              )
                            )
                              deleteSyncStatusMutation.mutate(ss.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Dodatni filteri za sinkronizaciju</CardTitle>
              <p className="text-sm text-muted-foreground">
                Zahtijevaj raspored (datum isporuke) – nalozi bez datuma
                rasporeda u ERP-u neće se sinkronizirati.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <Label htmlFor="sync_require_raspored">
                  Zahtijevaj raspored (datum isporuke)
                </Label>
                <Checkbox
                  id="sync_require_raspored"
                  checked={
                    editedSettings["SYNC_REQUIRE_RASPORED"] === "1" ||
                    editedSettings["SYNC_REQUIRE_RASPORED"] === "true"
                  }
                  onCheckedChange={(c) => {
                    const val = c ? "1" : "0"
                    handleSettingChange("SYNC_REQUIRE_RASPORED", val)
                    saveSettingsMutation.mutate(
                      { SYNC_REQUIRE_RASPORED: val },
                      {
                        onSuccess: () =>
                          toast.success(
                            c
                              ? "Filter rasporeda uključen"
                              : "Filter rasporeda isključen"
                          ),
                      }
                    )
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Sinkronizacija s ERP sustavom</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upravljajte sinkronizacijom podataka između lokalne baze i ERP
                sustava (Luceed). Svaka akcija pokreće pozadinsku sinkronizaciju.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Osvježi naloge */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    isSyncRunning("refreshOrders")
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSyncRunning("refreshOrders") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">Osvježi naloge</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Osvježava naloge u statusu Odobreno (08) s najnovijim
                    podacima iz ERP-a.
                  </p>
                  <Button
                    onClick={handleRefreshOrders}
                    disabled={isSyncRunning("refreshOrders")}
                    className="w-full"
                  >
                    {isSyncRunning("refreshOrders")
                      ? "U tijeku..."
                      : "Osvježi naloge"}
                  </Button>
                  {isSyncRunning("refreshOrders") &&
                    syncProgress.refreshOrders && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {syncProgress.refreshOrders}
                      </p>
                    )}
                  {lastResults.refreshOrders && (
                    <div
                      className={`mt-2 text-xs rounded p-2 ${
                        lastResults.refreshOrders.status === "COMPLETED"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {formatSyncTime(lastResults.refreshOrders.finishedAt)}{" "}
                      –{" "}
                      {lastResults.refreshOrders.status === "COMPLETED"
                        ? "Uspješno"
                        : "Greška"}
                      {lastResults.refreshOrders.message &&
                        `: ${lastResults.refreshOrders.message}`}
                    </div>
                  )}
                </div>

                {/* Sinkroniziraj naloge */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    isSyncRunning("syncOrders")
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSyncRunning("syncOrders") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">Sinkroniziraj naloge</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Puni import naloga iz ERP-a za odabrani period.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Datum od</Label>
                      <Input
                        type="date"
                        value={syncOrdersDateFrom}
                        onChange={(e) =>
                          setSyncOrdersDateFrom(e.target.value)
                        }
                        disabled={isSyncRunning("syncOrders")}
                        className="h-8 bg-secondary/50 border-border"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Datum do</Label>
                      <Input
                        type="date"
                        value={syncOrdersDateTo}
                        onChange={(e) =>
                          setSyncOrdersDateTo(e.target.value)
                        }
                        disabled={isSyncRunning("syncOrders")}
                        className="h-8 bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSyncOrders}
                    disabled={isSyncRunning("syncOrders")}
                    className="w-full"
                  >
                    {isSyncRunning("syncOrders")
                      ? "U tijeku..."
                      : "Pokreni sync naloga"}
                  </Button>
                  {isSyncRunning("syncOrders") &&
                    syncProgress.syncOrders && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {syncProgress.syncOrders}
                      </p>
                    )}
                  {lastResults.syncOrders && (
                    <div
                      className={`mt-2 text-xs rounded p-2 ${
                        lastResults.syncOrders.status === "COMPLETED"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {formatSyncTime(lastResults.syncOrders.finishedAt)}{" "}
                      –{" "}
                      {lastResults.syncOrders.status === "COMPLETED"
                        ? "Uspješno"
                        : "Greška"}
                      {lastResults.syncOrders.message &&
                        `: ${lastResults.syncOrders.message}`}
                    </div>
                  )}
                </div>

                {/* Sync po rasporedu */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    isSyncRunning("syncByRaspored")
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSyncRunning("syncByRaspored") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">Sync po rasporedu</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Importira naloge iz ERP-a prema datumu rasporeda (isporuke).
                    Gleda unazad 7 dana i uvozi naloge koji još ne postoje u bazi.
                  </p>
                  <div className="mb-3 space-y-1">
                    <Label className="text-xs">Datum rasporeda</Label>
                    <Input
                      type="date"
                      value={syncRasporedDate}
                      onChange={(e) => setSyncRasporedDate(e.target.value)}
                      disabled={isSyncRunning("syncByRaspored")}
                      className="h-8 bg-secondary/50 border-border"
                    />
                  </div>
                  <Button
                    onClick={handleSyncByRaspored}
                    disabled={isSyncRunning("syncByRaspored")}
                    className="w-full"
                  >
                    {isSyncRunning("syncByRaspored")
                      ? "U tijeku..."
                      : "Pokreni sync po rasporedu"}
                  </Button>
                  {isSyncRunning("syncByRaspored") &&
                    syncProgress.syncByRaspored && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {syncProgress.syncByRaspored}
                      </p>
                    )}
                  {lastResults.syncByRaspored && (
                    <div
                      className={`mt-2 text-xs rounded p-2 ${
                        lastResults.syncByRaspored.status === "COMPLETED"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {formatSyncTime(lastResults.syncByRaspored.finishedAt)}{" "}
                      –{" "}
                      {lastResults.syncByRaspored.status === "COMPLETED"
                        ? "Uspješno"
                        : "Greška"}
                      {lastResults.syncByRaspored.message &&
                        `: ${lastResults.syncByRaspored.message}`}
                    </div>
                  )}
                </div>

                {/* Sinkroniziraj partnere */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    isSyncRunning("syncPartners")
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSyncRunning("syncPartners") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">Sinkroniziraj partnere</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ažurira podatke o partnerima (kupci, adrese, kontakti) iz
                    ERP sustava.
                  </p>
                  <Button
                    onClick={handleSyncPartners}
                    disabled={isSyncRunning("syncPartners")}
                    className="w-full"
                  >
                    {isSyncRunning("syncPartners")
                      ? "U tijeku..."
                      : "Pokreni sync partnera"}
                  </Button>
                  {lastResults.syncPartners && (
                    <div
                      className={`mt-2 text-xs rounded p-2 ${
                        lastResults.syncPartners.status === "COMPLETED"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {formatSyncTime(
                        lastResults.syncPartners.finishedAt
                      )}{" "}
                      –{" "}
                      {lastResults.syncPartners.status === "COMPLETED"
                        ? "Uspješno"
                        : "Greška"}
                    </div>
                  )}
                </div>

                {/* Sinkroniziraj artikle */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    isSyncRunning("syncArtikli")
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSyncRunning("syncArtikli") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">Sinkroniziraj artikle</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ažurira šifarnik artikala (nazivi, mase, volumeni, grupe)
                    iz ERP sustava.
                  </p>
                  <Button
                    onClick={handleSyncArtikli}
                    disabled={isSyncRunning("syncArtikli")}
                    className="w-full"
                  >
                    {isSyncRunning("syncArtikli")
                      ? "U tijeku..."
                      : "Pokreni sync artikala"}
                  </Button>
                  {lastResults.syncArtikli && (
                    <div
                      className={`mt-2 text-xs rounded p-2 ${
                        lastResults.syncArtikli.status === "COMPLETED"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {formatSyncTime(
                        lastResults.syncArtikli.finishedAt
                      )}{" "}
                      –{" "}
                      {lastResults.syncArtikli.status === "COMPLETED"
                        ? "Uspješno"
                        : "Greška"}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <BlacklistSection />
        </TabsContent>
      </Tabs>

      <Dialog open={showPrioritetModal} onOpenChange={setShowPrioritetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrioritet ? "Uredi prioritet" : "Novi prioritet"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePrioritetSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Naziv *</Label>
              <Input
                value={prioritetForm.naziv}
                onChange={(e) =>
                  setPrioritetForm({
                    ...prioritetForm,
                    naziv: e.target.value,
                  })
                }
                required
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Težina (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={prioritetForm.tezina}
                onChange={(e) =>
                  setPrioritetForm({
                    ...prioritetForm,
                    tezina: Number(e.target.value),
                  })
                }
                className="bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Viša težina = veći prioritet
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prioritet_aktivan"
                checked={prioritetForm.aktivan}
                onCheckedChange={(c) =>
                  setPrioritetForm({
                    ...prioritetForm,
                    aktivan: !!c,
                  })
                }
              />
              <Label htmlFor="prioritet_aktivan">Aktivan prioritet</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePrioritetModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createPrioritetMutation.isPending ||
                  updatePrioritetMutation.isPending
                }
              >
                {editingPrioritet ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? "Uredi status" : "Novi status"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>ID (šifra) *</Label>
              <Input
                value={statusForm.id}
                onChange={(e) =>
                  setStatusForm({ ...statusForm, id: e.target.value })
                }
                required
                disabled={!!editingStatus}
                placeholder="npr. 08, 101, 30..."
                className="bg-secondary/50 border-border"
              />
              {editingStatus && (
                <p className="text-xs text-muted-foreground">
                  ID se ne može mijenjati
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Naziv *</Label>
              <Input
                value={statusForm.naziv}
                onChange={(e) =>
                  setStatusForm({ ...statusForm, naziv: e.target.value })
                }
                required
                placeholder="npr. Odobreno, Na dostavi..."
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={statusForm.opis}
                onChange={(e) =>
                  setStatusForm({ ...statusForm, opis: e.target.value })
                }
                placeholder="Opcijski opis statusa"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Redoslijed</Label>
              <Input
                type="number"
                min={0}
                value={statusForm.redoslijed}
                onChange={(e) =>
                  setStatusForm({
                    ...statusForm,
                    redoslijed: Number(e.target.value),
                  })
                }
                className="bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Manji broj = ranije u listi
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status_aktivan"
                checked={statusForm.aktivan}
                onCheckedChange={(c) =>
                  setStatusForm({ ...statusForm, aktivan: !!c })
                }
              />
              <Label htmlFor="status_aktivan">Aktivan status</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeStatusModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createStatusMutation.isPending ||
                  updateStatusMutation.isPending
                }
              >
                {editingStatus ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
