import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, toast, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { MapView } from '../components/routing'
import { routesApi, mapsApi, vehiclesApi, settingsApi, routingOrdersApi, mantisApi } from '../services/api'
import type { RutiranjeNalog } from '../services/api'
import { useRoutingStore } from '../store/routingStore'
import type { Vozilo, VoziloTip, ProviderInfo } from '../types'
import './RoutingPage.css'

type AlgorithmType = 'nearest_neighbor' | 'ortools' | 'manual'

const ALGORITHM_OPTIONS: { value: AlgorithmType; label: string }[] = [
  { value: 'nearest_neighbor', label: 'Nearest Neighbor' },
  { value: 'ortools', label: 'OR-Tools (VRP)' },
  { value: 'manual', label: 'Ručni redoslijed' },
]

const PROVIDER_OPTIONS = [
  { value: 'nominatim', label: 'Nominatim (OSM)' },
  { value: 'osrm', label: 'OSRM' },
  { value: 'ors', label: 'OpenRouteService' },
  { value: 'tomtom', label: 'TomTom (HR+SI, truck)' },
  { value: 'google', label: 'Google Maps' },
]

// Kolone za DataTable naloga
const NALOZI_COLUMNS: DataTableColumn[] = [
  { key: 'broj', label: 'Broj' },
  { key: 'kupac', label: 'Kupac' },
  { key: 'adresa', label: 'Adresa' },
  { key: 'mjesto', label: 'Mjesto' },
  { key: 'pb', label: 'PB' },
  { key: 'zona', label: 'Zona' },
  { key: 'raspored', label: 'Raspored' },
  { key: 'tezina', label: 'Težina' },
  { key: 'volumen', label: 'Volumen' },
  { key: 'status', label: 'Status' },
  { key: 'wms', label: 'WMS' },
]

/** Kupac kolona iz RutiranjeNalog */
function getKupac(order: RutiranjeNalog): string {
  if (order.kupac) return order.kupac
  const imePrezime = [order.partner_ime, order.partner_prezime].filter(Boolean).join(' ').trim()
  const naziv = (order.partner_naziv ?? '').trim()
  if (!naziv) return imePrezime || '—'
  if (imePrezime) return `${naziv} => ${imePrezime}`
  return naziv
}

/** Mapiranje status_rutiranja na labelu */
function statusRutiranjaLabel(status: string | null): string {
  switch (status) {
    case 'CEKA_RUTU': return 'Čeka rutu'
    case 'NA_RUTI': return 'Na ruti'
    case 'DOSTAVLJEN': return 'Dostavljen'
    case 'NEDOSTAVLJEN': return 'Nedostavljen'
    default: return status || '—'
  }
}

export default function RoutingPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('nearest_neighbor')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [removingUids, setRemovingUids] = useState<Set<string>>(new Set())

  // Popup za datum dostave
  const [showRasporedModal, setShowRasporedModal] = useState(false)
  const [rasporedDate, setRasporedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: () => routesApi.listDrivers(),
    staleTime: 30_000,
  })

  // Resizable panels: [vehicles | orders | map]
  // vehiclesWidth in px, mapRatio as % of remaining space
  const [vehiclesWidth, setVehiclesWidth] = useState(() => {
    const saved = localStorage.getItem('ft-routing-vehicles-w')
    return saved ? parseInt(saved) : 200
  })
  const [mapRatio, setMapRatio] = useState(() => {
    const saved = localStorage.getItem('ft-routing-map-ratio')
    return saved ? parseFloat(saved) : 45
  })
  const draggingRef = useRef<'vehicles' | 'map' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    checkedOrderUids,
    selectedVehicle,
    toggleCheckedOrder,
    setCheckedOrderUids,
    setSelectedVehicle,
    setActiveRoute,
    setPreviewMarkers,
  } = useRoutingStore()

  // === Dohvat naloga iz baze ===
  const { data: rutiranjeNalozi = [], isLoading: loadingNalozi } = useQuery({
    queryKey: ['rutiranje-nalozi'],
    queryFn: routingOrdersApi.listRutiranjeNalogi,
  })

  const cekaRutuNalozi = useMemo(
    () => rutiranjeNalozi.filter((n) => n.status_rutiranja === 'CEKA_RUTU'),
    [rutiranjeNalozi]
  )

  const nedostavljeniNalozi = useMemo(
    () => rutiranjeNalozi.filter((n) => n.status_rutiranja === 'NEDOSTAVLJEN'),
    [rutiranjeNalozi]
  )

  // WMS status za SVE naloge u rutiranju (za filtriranje i sortiranje)
  const allRutiranjeUids = useMemo(() => cekaRutuNalozi.map((o) => o.nalog_prodaje_uid), [cekaRutuNalozi])
  const { data: wmsAllData } = useQuery({
    queryKey: ['mantis-bulk-routing', allRutiranjeUids],
    queryFn: () => mantisApi.getOrdersBulk(allRutiranjeUids),
    enabled: allRutiranjeUids.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Provider info
  const { data: providerInfo } = useQuery<ProviderInfo>({
    queryKey: ['provider-info'],
    queryFn: mapsApi.getProvider,
  })

  const switchProviderMutation = useMutation({
    mutationFn: mapsApi.setProvider,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['provider-info'] })
      toast.success('Provider promijenjen', `Aktivni provider: ${data.provider}`)
    },
  })

  // Vozila i tipovi vozila
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehiclesApi.list,
  })
  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: vehiclesApi.listTypes,
  })
  const activeVehicles = useMemo(() => vehicles.filter((v: Vozilo) => v.aktivan), [vehicles])

  // Grupiraj vozila po tipu
  const vehiclesByType = useMemo(() => {
    const typeMap = new Map<number | null, { tip: VoziloTip | null; vehicles: Vozilo[] }>()
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

  // Paleta config
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
  })

  const paletaConfig = useMemo(() => {
    const getVal = (key: string, def: number) => {
      const s = settings.find((s: { key: string; value: string | null }) => s.key === key)
      return s?.value ? Number(s.value) : def
    }
    const duzina = getVal('PALETA_DUZINA_MM', 1200)
    const sirina = getVal('PALETA_SIRINA_MM', 800)
    const visina = getVal('PALETA_VISINA_MM', 1800)
    const maxTezina = getVal('PALETA_MAX_TEZINA_KG', 1200)
    const volumenM3 = (duzina * sirina * visina) / 1_000_000_000
    return { maxTezina, volumenM3 }
  }, [settings])

  // Izračun suma za checked naloge
  const checkedTotals = useMemo(() => {
    let totalWeight = 0
    let totalVolume = 0
    let count = 0
    cekaRutuNalozi.forEach((order) => {
      if (checkedOrderUids.has(order.nalog_prodaje_uid)) {
        count++
        if (order.total_weight) totalWeight += order.total_weight
        if (order.total_volume) totalVolume += order.total_volume
      }
    })
    const volumeM3 = totalVolume / 1_000_000
    const paletaByVolume = paletaConfig.volumenM3 > 0 ? volumeM3 / paletaConfig.volumenM3 : 0
    const paletaByWeight = paletaConfig.maxTezina > 0 ? totalWeight / paletaConfig.maxTezina : 0
    const paletaCount = Math.ceil(Math.max(paletaByVolume, paletaByWeight))
    return { totalWeight, totalVolume, count, paletaCount, paletaByVolume, paletaByWeight }
  }, [cekaRutuNalozi, checkedOrderUids, paletaConfig])

  // WMS SSCC podaci za označene naloge
  const checkedUidsArray = useMemo(() => [...checkedOrderUids], [checkedOrderUids])
  const { data: wmsBulkData } = useQuery({
    queryKey: ['mantis-bulk', checkedUidsArray],
    queryFn: () => mantisApi.getOrdersBulk(checkedUidsArray),
    enabled: checkedUidsArray.length > 0,
    staleTime: 60 * 1000,
  })

  const wmsTotals = useMemo(() => {
    if (!wmsBulkData) return { totalPallets: 0, allComplete: false, partialCount: 0, noneCount: 0, hasData: false }
    const allSscc = new Set<string>()
    let completeCount = 0
    let partialCount = 0
    let noneCount = 0
    let hasAnyData = false
    for (const uid of checkedUidsArray) {
      const s = wmsBulkData[uid]
      if (!s || !s.has_data) { noneCount++; continue }
      hasAnyData = true
      if (s.is_complete) completeCount++
      else partialCount++
      for (const it of s.items) {
        if (it.sscc) allSscc.add(it.sscc)
      }
    }
    return {
      totalPallets: allSscc.size,
      allComplete: hasAnyData && partialCount === 0 && noneCount === 0,
      partialCount,
      noneCount,
      hasData: hasAnyData,
    }
  }, [wmsBulkData, checkedUidsArray])

  // ======== Resizable panel handlers ========
  const handleResizeMouseDown = useCallback((which: 'vehicles' | 'map') => {
    draggingRef.current = which
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left

      if (draggingRef.current === 'vehicles') {
        const w = Math.max(140, Math.min(400, x))
        setVehiclesWidth(w)
      } else {
        // map divider: x is total position, ordersEnd = x, map starts at x
        // mapRatio = % of total width that map takes
        const remaining = rect.width - vehiclesWidth - 16 // 2 handles @ 8px each
        const ordersW = x - vehiclesWidth - 8
        const mapPct = Math.max(15, Math.min(80, 100 - (ordersW / remaining) * 100))
        setMapRatio(mapPct)
      }
    }
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem('ft-routing-vehicles-w', String(vehiclesWidth))
        localStorage.setItem('ft-routing-map-ratio', String(mapRatio))
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [vehiclesWidth, mapRatio])

  // ======== Geocodiraj checked naloge za preview na karti ========
  const geocodeChecked = useCallback(async () => {
    const uids = cekaRutuNalozi
      .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
      .map((o) => o.nalog_prodaje_uid)
    if (uids.length === 0) {
      setPreviewMarkers([])
      return
    }
    setIsGeocoding(true)
    try {
      const results = await mapsApi.geocodeOrders(uids)
      setPreviewMarkers(results)
    } catch (err) {
      console.error('Geocoding error:', err)
    } finally {
      setIsGeocoding(false)
    }
  }, [cekaRutuNalozi, checkedOrderUids, setPreviewMarkers])

  useEffect(() => {
    const timer = setTimeout(() => { geocodeChecked() }, 600)
    return () => clearTimeout(timer)
  }, [geocodeChecked])

  // ======== Kreiranje rute ========
  const createRouteMutation = useMutation({
    mutationFn: routesApi.create,
    onSuccess: (route) => {
      setActiveRoute(route)
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-uids'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setCheckedOrderUids(new Set())
      toast.success('Ruta kreirana', `Ruta #${route.id} je uspješno kreirana sa statusom PLANNED`)
    },
    onError: (error: Error) => {
      toast.error('Greška pri kreiranju rute', error.message)
    },
  })

  // WMS upozorenje za nesložene naloge
  const wmsWarning = useMemo(() => {
    if (!wmsBulkData || checkedUidsArray.length === 0) return null
    let incomplete = 0
    let noData = 0
    for (const uid of checkedUidsArray) {
      const s = wmsBulkData[uid]
      if (!s || !s.has_data) { noData++; continue }
      if (!s.is_complete) incomplete++
    }
    if (incomplete === 0 && noData === 0) return null
    const parts: string[] = []
    if (incomplete > 0) parts.push(`${incomplete} od ${checkedUidsArray.length} naloga još nije potpuno složeno u WMS-u`)
    if (noData > 0) parts.push(`${noData} naloga nema WMS podataka`)
    return parts.join('. ')
  }, [wmsBulkData, checkedUidsArray])

  const handleCreateRouteClick = () => {
    const uids = cekaRutuNalozi
      .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
      .map((o) => o.nalog_prodaje_uid)
    if (uids.length === 0) {
      toast.warning('Nema označenih naloga', 'Označite naloge za kreiranje rute')
      return
    }
    if (!selectedVehicle) {
      toast.warning('Nema odabranog vozila', 'Odaberite vozilo za rutu')
      return
    }
    setShowRasporedModal(true)
  }

  const handleConfirmCreateRoute = () => {
    const uids = cekaRutuNalozi
      .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
      .map((o) => o.nalog_prodaje_uid)
    setShowRasporedModal(false)
    createRouteMutation.mutate({
      nalog_uids: uids,
      vozilo_id: selectedVehicle!.id,
      algoritam: selectedAlgorithm,
      raspored: rasporedDate || undefined,
      driver_user_id: selectedDriverId || undefined,
    })
    setSelectedDriverId(null)
  }

  // ======== Vrati nalog iz rutiranja ========
  const handleRemoveFromRutiranje = async (uid: string) => {
    setRemovingUids((prev) => new Set(prev).add(uid))
    try {
      await routingOrdersApi.vratiIzRutiranja([uid])
      toast.success('Nalog vraćen u naloge')
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-uids'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      const next = new Set(checkedOrderUids)
      next.delete(uid)
      setCheckedOrderUids(next)
    } catch (err) {
      toast.error(`Greška: ${(err as Error).message}`)
    } finally {
      setRemovingUids((prev) => { const n = new Set(prev); n.delete(uid); return n })
    }
  }

  // Vrati SVE označene naloge
  const [isReturningBulk, setIsReturningBulk] = useState(false)
  const handleReturnCheckedToOrders = async () => {
    const uids = cekaRutuNalozi
      .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
      .map((o) => o.nalog_prodaje_uid)
    if (uids.length === 0) {
      toast.warning('Nema označenih naloga', 'Označite naloge koje želite vratiti')
      return
    }
    setIsReturningBulk(true)
    try {
      const result = await routingOrdersApi.vratiIzRutiranja(uids)
      toast.success(`Vraćeno ${result.vraceno} naloga u naloge`)
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-uids'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setCheckedOrderUids(new Set())
    } catch (err) {
      toast.error(`Greška: ${(err as Error).message}`)
    } finally {
      setIsReturningBulk(false)
    }
  }

  // Prerutiraj nedostavljene
  const handlePrerutiraj = async () => {
    const uids = nedostavljeniNalozi.map((n) => n.nalog_prodaje_uid)
    if (uids.length === 0) return
    try {
      const result = await routingOrdersApi.prerutiraj(uids)
      toast.success(`Prerutirano ${result.prerutirano} naloga`)
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
    } catch (err) {
      toast.error(`Greška: ${(err as Error).message}`)
    }
  }

  // ======== DataTable handlers za checkbox ========
  const handleToggleCheck = useCallback((key: string | number) => {
    toggleCheckedOrder(String(key))
  }, [toggleCheckedOrder])

  const handleToggleAll = useCallback((allKeys: (string | number)[]) => {
    const allStrKeys = allKeys.map(String)
    const allSelected = allStrKeys.every((k) => checkedOrderUids.has(k))
    if (allSelected) {
      // Deselect all visible
      const next = new Set(checkedOrderUids)
      allStrKeys.forEach((k) => next.delete(k))
      setCheckedOrderUids(next)
    } else {
      // Select all visible
      const next = new Set(checkedOrderUids)
      allStrKeys.forEach((k) => next.add(k))
      setCheckedOrderUids(next)
    }
  }, [checkedOrderUids, setCheckedOrderUids])

  // ======== DataTable cellValue / cellRenderer ========
  const getCellValue = useCallback((order: RutiranjeNalog, key: string): unknown => {
    switch (key) {
      case 'kupac': return getKupac(order)
      case 'adresa': return order.partner_adresa || ''
      case 'mjesto': return order.partner_naziv_mjesta || ''
      case 'pb': return order.partner_postanski_broj || ''
      case 'zona': return order.regija_naziv || ''
      case 'wms': {
        const w = wmsAllData?.[order.nalog_prodaje_uid]
        if (!w || !w.has_data) return 'Nema'
        if (w.is_complete) return `Složeno (${w.total_paleta})`
        return `U procesu (${w.total_paleta})`
      }
      case 'raspored': return order.raspored || ''
      case 'tezina': return order.total_weight ?? 0
      case 'volumen': return order.total_volume ?? 0
      case 'status': return statusRutiranjaLabel(order.status_rutiranja)
      case 'broj': return order.broj ?? 0
      default: return (order as unknown as Record<string, unknown>)[key]
    }
  }, [wmsAllData])

  const renderCell = useCallback((order: RutiranjeNalog, key: string): React.ReactNode => {
    const isRemoving = removingUids.has(order.nalog_prodaje_uid)
    switch (key) {
      case 'broj': return order.broj || '—'
      case 'kupac': return getKupac(order)
      case 'adresa': return order.partner_adresa || '—'
      case 'mjesto': return order.partner_naziv_mjesta || '—'
      case 'pb': return order.partner_postanski_broj || '—'
      case 'zona': return order.regija_naziv || '—'
      case 'raspored': return order.raspored || '—'
      case 'tezina':
        return order.total_weight != null
          ? `${Number(order.total_weight).toFixed(1)} kg`
          : '—'
      case 'volumen':
        return order.total_volume != null
          ? `${(Number(order.total_volume) / 1_000_000).toFixed(3)} m³`
          : '—'
      case 'status':
        return (
          <span className={`rt-status rt-status-${order.status_rutiranja}`}>
            {statusRutiranjaLabel(order.status_rutiranja)}
          </span>
        )
      case 'wms': {
        const w = wmsAllData?.[order.nalog_prodaje_uid]
        if (!w || !w.has_data) return <span className="wms-status-dot gray" title="Nema WMS podataka" />
        const dotClass = w.is_complete ? 'green' : w.total_paleta > 0 ? 'yellow' : 'red'
        return (
          <span title={w.is_complete ? 'Složeno' : 'U procesu'}>
            <span className={`wms-status-dot ${dotClass}`} />
            {w.total_paleta > 0 ? w.total_paleta : ''}
          </span>
        )
      }
      default:
        return (
          <button
            className="rt-remove-btn"
            disabled={isRemoving}
            onClick={(e) => { e.stopPropagation(); handleRemoveFromRutiranje(order.nalog_prodaje_uid) }}
            title="Vrati u naloge"
          >{isRemoving ? '...' : '✕'}</button>
        )
    }
  }, [removingUids, handleRemoveFromRutiranje, wmsAllData])

  // Loading state
  if (loadingNalozi) {
    return (
      <div className="routing-page">
        <div className="routing-empty-state">
          <span className="spinner-small"></span>
          <h2>Učitavanje naloga za rutiranje...</h2>
        </div>
      </div>
    )
  }

  // Empty state
  if (rutiranjeNalozi.length === 0) {
    return (
      <div className="routing-page">
        <div className="routing-empty-state">
          <div className="routing-empty-icon">🗺️</div>
          <h2>Nema naloga za rutiranje</h2>
          <p>Označite naloge na stranici Nalozi i kliknite "Kreiraj rutu"</p>
          <Button onClick={() => navigate('/orders')}>Idi na naloge</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="routing-page">
      {/* Header toolbar */}
      <div className="routing-toolbar">
        <div className="routing-toolbar-left">
          <h1 className="routing-title">Kreiranje rute</h1>
          <span className="routing-subtitle">
            {cekaRutuNalozi.length} naloga čeka rutu
            {nedostavljeniNalozi.length > 0 && ` | ${nedostavljeniNalozi.length} nedostavljenih`}
          </span>
        </div>
        <div className="routing-toolbar-right">
          <div className="routing-select-group">
            <label>Provider:</label>
            <select
              value={providerInfo?.provider || 'nominatim'}
              onChange={(e) => switchProviderMutation.mutate(e.target.value)}
              disabled={switchProviderMutation.isPending}
            >
              {PROVIDER_OPTIONS.map((opt) => {
                const disabled =
                  (opt.value === 'google' && !providerInfo?.has_google_key) ||
                  (opt.value === 'ors' && !providerInfo?.has_ors_key) ||
                  (opt.value === 'tomtom' && !providerInfo?.has_tomtom_key)
                return (
                  <option key={opt.value} value={opt.value} disabled={disabled}>
                    {opt.label}{disabled ? ' (nema ključa)' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="routing-select-group">
            <label>Algoritam:</label>
            <select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value as AlgorithmType)}
            >
              {ALGORITHM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleCreateRouteClick}
            disabled={checkedTotals.count === 0 || !selectedVehicle || createRouteMutation.isPending}
            isLoading={createRouteMutation.isPending}
            title={!selectedVehicle ? 'Prvo odaberite vozilo' : checkedTotals.count === 0 ? 'Označite naloge' : 'Kreiraj rutu'}
          >
            Kreiraj rutu ({checkedTotals.count})
          </Button>
          {checkedTotals.count > 0 && (
            <Button
              variant="secondary"
              onClick={handleReturnCheckedToOrders}
              disabled={isReturningBulk}
              isLoading={isReturningBulk}
              title="Vrati označene naloge natrag na stranicu Nalozi"
            >
              Vrati u naloge ({checkedTotals.count})
            </Button>
          )}
          {!selectedVehicle && checkedTotals.count > 0 && (
            <span className="routing-warning-hint">Odaberite vozilo!</span>
          )}
          {nedostavljeniNalozi.length > 0 && (
            <Button variant="secondary" onClick={handlePrerutiraj}>
              Prerutiraj ({nedostavljeniNalozi.length})
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/orders')}>
            Natrag
          </Button>
        </div>
      </div>

      {/* Geocoding indikator */}
      {isGeocoding && (
        <div className="geocoding-indicator">
          <span className="spinner-small"></span>
          Geocodiranje adresa...
        </div>
      )}

      {/* Summary kartice */}
      {checkedTotals.count > 0 && (
        <div className="routing-summary-row">
          <div className="routing-summary-card">
            <span className="rsc-icon">📦</span>
            <div className="rsc-content">
              <span className="rsc-value">{checkedTotals.count}</span>
              <span className="rsc-label">Označenih</span>
            </div>
          </div>
          <div className="routing-summary-card">
            <span className="rsc-icon">⚖️</span>
            <div className="rsc-content">
              <span className="rsc-value">{checkedTotals.totalWeight.toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>
              <span className="rsc-label">Težina</span>
            </div>
          </div>
          <div className="routing-summary-card">
            <span className="rsc-icon">📐</span>
            <div className="rsc-content">
              <span className="rsc-value">{(checkedTotals.totalVolume / 1_000_000).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</span>
              <span className="rsc-label">Volumen</span>
            </div>
          </div>
          <div className="routing-summary-card rsc-highlight">
            <span className="rsc-icon">🚛</span>
            <div className="rsc-content">
              <span className="rsc-value">{checkedTotals.paletaCount}</span>
              <span className="rsc-label">Paleta (procjena)</span>
            </div>
          </div>
          {wmsTotals.hasData && (
            <div className={`routing-summary-card ${
              selectedVehicle?.paleta != null && wmsTotals.totalPallets > selectedVehicle.paleta
                ? 'rsc-wms-red'
                : wmsTotals.allComplete ? 'rsc-wms-green' : 'rsc-wms-yellow'
            }`}>
              <span className="rsc-icon">📋</span>
              <div className="rsc-content">
                <span className="rsc-value">
                  {wmsTotals.totalPallets}
                  {selectedVehicle?.paleta != null && (
                    <span style={{ fontSize: '0.7em', opacity: 0.7 }}> / {selectedVehicle.paleta}</span>
                  )}
                </span>
                <span className="rsc-label">
                  WMS Palete
                  {selectedVehicle?.paleta != null && wmsTotals.totalPallets > selectedVehicle.paleta && ' ⚠️ prekoračenje!'}
                  {wmsTotals.partialCount > 0 && ` (${wmsTotals.partialCount} djelom.)`}
                  {wmsTotals.noneCount > 0 && ` (${wmsTotals.noneCount} bez)`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 3-panel layout: Vozila | Nalozi | Karta ========== */}
      <div className="routing-main" ref={containerRef}>

        {/* Panel 1: Vozila */}
        <div className="routing-panel-vehicles" style={{ width: vehiclesWidth }}>
          <div className="rv-panel-header">Vozila</div>
          <div className="rv-panel-scroll">
            {vehiclesByType.map((group) => (
              <div key={group.tip?.id ?? 'none'} className="rv-category">
                <div className="rv-category-label">
                  {group.tip?.naziv || 'Ostala'}
                </div>
                {group.vehicles.map((vehicle: Vozilo) => (
                  <div
                    key={vehicle.id}
                    className={`routing-vehicle-item ${selectedVehicle?.id === vehicle.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVehicle(selectedVehicle?.id === vehicle.id ? null : vehicle)}
                  >
                    <input
                      type="radio"
                      checked={selectedVehicle?.id === vehicle.id}
                      onChange={() => {}}
                    />
                    <div className="rv-info">
                      <span className="rv-name">{vehicle.oznaka || vehicle.naziv || `#${vehicle.id}`}</span>
                      <span className="rv-meta">
                        {vehicle.nosivost_kg && `${vehicle.nosivost_kg}kg`}
                        {vehicle.nosivost_kg && vehicle.volumen_m3 && ' / '}
                        {vehicle.volumen_m3 && `${vehicle.volumen_m3}m³`}
                        {vehicle.paleta && ` / ${vehicle.paleta} pal`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Resize handle 1: vehicles <-> orders */}
        <div
          className="routing-resize-handle"
          onMouseDown={() => handleResizeMouseDown('vehicles')}
        >
          <div className="routing-resize-dots"><span /><span /><span /></div>
        </div>

        {/* Panel 2: Nalozi tablica (DataTable) */}
        <div className="routing-panel-orders">
          <DataTable<RutiranjeNalog>
            storageKey="ft-routing-nalozi-v2"
            columns={NALOZI_COLUMNS}
            data={cekaRutuNalozi}
            rowKey={(o) => o.nalog_prodaje_uid}
            cellValue={getCellValue}
            cellRenderer={renderCell}
            checkedKeys={checkedOrderUids}
            onToggleCheck={handleToggleCheck}
            onToggleAll={handleToggleAll}
            onRowClick={(o) => toggleCheckedOrder(o.nalog_prodaje_uid)}
            rowClassName={(o) => checkedOrderUids.has(o.nalog_prodaje_uid) ? 'row-checked' : ''}
            emptyMessage="Nema naloga koji čekaju rutu."
            showColumnPicker={true}
            defaultColumnWidth={120}
            minColumnWidth={60}
            actions={(order) => {
              const isRemoving = removingUids.has(order.nalog_prodaje_uid)
              return (
                <button
                  className="rt-remove-btn"
                  disabled={isRemoving}
                  onClick={(e) => { e.stopPropagation(); handleRemoveFromRutiranje(order.nalog_prodaje_uid) }}
                  title="Vrati u naloge (ukloni iz rutiranja)"
                >{isRemoving ? '...' : '✕'}</button>
              )
            }}
          />
        </div>

        {/* Resize handle 2: orders <-> map */}
        <div
          className="routing-resize-handle"
          onMouseDown={() => handleResizeMouseDown('map')}
        >
          <div className="routing-resize-dots"><span /><span /><span /></div>
        </div>

        {/* Panel 3: Karta */}
        <div className="routing-panel-map" style={{ width: `${mapRatio}%` }}>
          <MapView />
        </div>
      </div>

      {/* Modal za datum dostave (raspored) */}
      {showRasporedModal && (
        <div className="modal-overlay" onClick={() => setShowRasporedModal(false)}>
          <div className="routing-raspored-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Datum dostave</h2>
            <p className="raspored-modal-desc">
              Odaberite planirani datum dostave za ovu rutu ({checkedTotals.count} naloga).
            </p>
            <div className="raspored-modal-field">
              <label htmlFor="raspored-date">Raspored (datum dostave):</label>
              <input
                id="raspored-date"
                type="date"
                value={rasporedDate}
                onChange={(e) => setRasporedDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="raspored-modal-field">
              <label htmlFor="driver-select">Vozač (opcionalno):</label>
              <select
                id="driver-select"
                value={selectedDriverId ?? ''}
                onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                }}
              >
                <option value="">— Bez vozača —</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div className="raspored-modal-info">
              Vozilo: <strong>{selectedVehicle?.oznaka || selectedVehicle?.naziv}</strong> |
              Algoritam: <strong>{ALGORITHM_OPTIONS.find((a) => a.value === selectedAlgorithm)?.label}</strong>
            </div>
            {wmsWarning && (
              <div className="raspored-modal-wms-warning">
                <span className="wms-warn-icon">⚠️</span>
                <span>{wmsWarning}</span>
              </div>
            )}
            {selectedVehicle?.paleta != null && wmsTotals.totalPallets > 0 && wmsTotals.totalPallets > selectedVehicle.paleta && (
              <div className="raspored-modal-wms-warning" style={{ borderColor: '#ef4444', background: '#fef2f2', color: '#991b1b' }}>
                <span className="wms-warn-icon">🚫</span>
                <span>
                  WMS palete ({wmsTotals.totalPallets}) premašuju kapacitet vozila ({selectedVehicle.paleta} paleta)!
                </span>
              </div>
            )}
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setShowRasporedModal(false)}>
                Odustani
              </Button>
              <Button
                onClick={handleConfirmCreateRoute}
                isLoading={createRouteMutation.isPending}
                disabled={!rasporedDate}
              >
                Kreiraj rutu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
