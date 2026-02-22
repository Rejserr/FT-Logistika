import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '../components/layout'
import { Card, Button, toast, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { settingsApi, prioritetiApi, statusiApi, syncApi, mapsApi, vrsteIsporukeApi, syncStatusiApi, ordersApi } from '../services/api'
import type { Setting, Prioritet, StatusNaloga, VrstaIsporuke, SyncStatus } from '../types'
import './SettingsPage.css'

type TabType = 'general' | 'prioriteti' | 'paleta' | 'statusi' | 'geocoding' | 'sync' | 'sync-kriteriji'

// ============================================================================
// Sync state persistence (localStorage)
// ============================================================================
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

const SYNC_JOBS_KEY = 'ft_sync_running_jobs'
const SYNC_LAST_KEY = 'ft_sync_last_results'

type SyncActionKey = 'refreshOrders' | 'syncOrders' | 'syncPartners' | 'syncArtikli'

function loadRunningJobs(): Record<SyncActionKey, SyncJobState | null> {
  try {
    const raw = localStorage.getItem(SYNC_JOBS_KEY)
    return raw ? JSON.parse(raw) : { refreshOrders: null, syncOrders: null, syncPartners: null, syncArtikli: null }
  } catch {
    return { refreshOrders: null, syncOrders: null, syncPartners: null, syncArtikli: null }
  }
}

function saveRunningJobs(jobs: Record<SyncActionKey, SyncJobState | null>) {
  localStorage.setItem(SYNC_JOBS_KEY, JSON.stringify(jobs))
}

function loadLastResults(): Record<SyncActionKey, SyncLastResult | null> {
  try {
    const raw = localStorage.getItem(SYNC_LAST_KEY)
    return raw ? JSON.parse(raw) : { refreshOrders: null, syncOrders: null, syncPartners: null, syncArtikli: null }
  } catch {
    return { refreshOrders: null, syncOrders: null, syncPartners: null, syncArtikli: null }
  }
}

function saveLastResults(results: Record<SyncActionKey, SyncLastResult | null>) {
  localStorage.setItem(SYNC_LAST_KEY, JSON.stringify(results))
}

// Predefined settings s opisima i defaultima
const SETTING_DEFINITIONS: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' | 'select'; defaultValue: string; options?: { value: string; label: string }[] }> = {
  DEFAULT_SERVICE_TIME_MINUTES: {
    label: 'Vrijeme servisa (min)',
    description: 'Prosječno vrijeme dostave po stanici',
    type: 'number',
    defaultValue: '10',
  },
  MAX_STOPS_PER_ROUTE: {
    label: 'Max stanica po ruti',
    description: 'Maksimalan broj stanica na jednoj ruti',
    type: 'number',
    defaultValue: '30',
  },
  DEFAULT_ROUTING_ALGORITHM: {
    label: 'Default algoritam',
    description: 'nearest_neighbor ili ortools',
    type: 'text',
    defaultValue: 'nearest_neighbor',
  },
  DEPOT_LAT: {
    label: 'Depot latitude',
    description: 'GPS latitude skladišta',
    type: 'text',
    defaultValue: '45.815',
  },
  DEPOT_LNG: {
    label: 'Depot longitude',
    description: 'GPS longitude skladišta',
    type: 'text',
    defaultValue: '15.9819',
  },
  GEOCODING_PROVIDER: {
    label: 'Geocoding / routing provider',
    description: 'Odaberite provider za geocoding i rutiranje.',
    type: 'select',
    defaultValue: 'ors',
    options: [
      { value: 'ors', label: 'ORS – OpenRouteService (HR)' },
      { value: 'osrm', label: 'OSRM – besplatni demo server' },
      { value: 'tomtom', label: 'TomTom – HR + SI, truck profil' },
      { value: 'google', label: 'Google Maps' },
      { value: 'nominatim', label: 'Nominatim – OpenStreetMap' },
    ],
  },
  MAP_PROVIDER: {
    label: 'Prikaz mape (tile provider)',
    description: 'Odaberite koja mapa se prikazuje na routing stranici.',
    type: 'select',
    defaultValue: 'osm',
    options: [
      { value: 'osm', label: 'OpenStreetMap – besplatna, detaljne ceste' },
      { value: 'tomtom', label: 'TomTom – profesionalna karta' },
      { value: 'tomtom-night', label: 'TomTom Night – tamna tema' },
      { value: 'carto-light', label: 'Carto Light – svijetla, minimalistička' },
      { value: 'carto-dark', label: 'Carto Dark – tamna tema' },
    ],
  },
  SYNC_INTERVAL_MINUTES: {
    label: 'Interval auto-synca (min)',
    description: 'Interval automatske sinkronizacije s ERP-om',
    type: 'number',
    defaultValue: '20',
  },
  SYNC_CONCURRENCY: {
    label: 'Paralelni sync zahtjevi',
    description: 'Broj paralelnih zahtjeva pri sinkronizaciji',
    type: 'number',
    defaultValue: '10',
  },
  SYNC_REQUIRE_RASPORED: {
    label: 'Zahtijevaj raspored za sync',
    description: 'Ako je uključeno, nalozi bez datuma rasporeda (datum isporuke) se neće sinkronizirati iz ERP-a.',
    type: 'boolean',
    defaultValue: '0',
  },
}

// Paleta settings
const PALETA_SETTINGS: Record<string, { label: string; description: string; unit: string; defaultValue: number }> = {
  PALETA_DUZINA_MM: {
    label: 'Dužina palete',
    description: 'Dužina standardne palete',
    unit: 'mm',
    defaultValue: 1200,
  },
  PALETA_SIRINA_MM: {
    label: 'Širina palete',
    description: 'Širina standardne palete',
    unit: 'mm',
    defaultValue: 800,
  },
  PALETA_VISINA_MM: {
    label: 'Visina palete (s robom)',
    description: 'Visina palete s robom za izračun volumena',
    unit: 'mm',
    defaultValue: 1800,
  },
  PALETA_MAX_TEZINA_KG: {
    label: 'Max težina palete',
    description: 'Maksimalna nosivost jedne palete',
    unit: 'kg',
    defaultValue: 1200,
  },
  PALETA_MAX_VISINA_ARTIKLA_MM: {
    label: 'Max visina artikla',
    description: 'Artikli viši od ove vrijednosti broje se kao 2 palete',
    unit: 'mm',
    defaultValue: 2000,
  },
}

function BlacklistSection() {
  const queryClient = useQueryClient()
  const { data: blacklist = [], isLoading } = useQuery({
    queryKey: ['orders-blacklist'],
    queryFn: ordersApi.getBlacklist,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const unblockMut = useMutation({
    mutationFn: (uids: string[]) => ordersApi.unblacklist(uids),
    onSuccess: (data) => {
      toast.success(`Deblokirano ${data.uklonjeno} naloga. Sljedeći sync će ih ponovo importirati.`)
      queryClient.invalidateQueries({ queryKey: ['orders-blacklist'] })
      setSelected(new Set())
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  if (isLoading) return <Card title="Blokirani nalozi"><p>Učitavanje...</p></Card>
  if (blacklist.length === 0) return <Card title="Blokirani nalozi"><p style={{ color: '#94a3b8' }}>Nema blokiranih naloga.</p></Card>

  return (
    <Card title={`Blokirani nalozi (${blacklist.length})`}>
      <p className="section-description">
        Nalozi na ovoj listi su obrisani iz sustava i neće se automatski importirati iz ERP-a.
        Označite naloge i kliknite "Deblokiraj" da omogućite ponovni import.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
          onClick={() => setSelected(
            selected.size === blacklist.length ? new Set() : new Set(blacklist.map(b => b.nalog_prodaje_uid))
          )}
        >
          {selected.size === blacklist.length ? 'Odznači sve' : 'Označi sve'}
        </Button>
      </div>
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        <table className="settings-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Nalog UID</th>
              <th>Razlog</th>
              <th>Blokirao</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {blacklist.map(b => (
              <tr key={b.nalog_prodaje_uid}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(b.nalog_prodaje_uid)}
                    onChange={() => {
                      const next = new Set(selected)
                      if (next.has(b.nalog_prodaje_uid)) next.delete(b.nalog_prodaje_uid)
                      else next.add(b.nalog_prodaje_uid)
                      setSelected(next)
                    }}
                  />
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{b.nalog_prodaje_uid}</td>
                <td>{b.razlog || '—'}</td>
                <td>{b.blocked_by || '—'}</td>
                <td>{b.blocked_at ? new Date(b.blocked_at).toLocaleString('hr-HR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({})
  const [showPrioritetModal, setShowPrioritetModal] = useState(false)
  const [editingPrioritet, setEditingPrioritet] = useState<Prioritet | null>(null)
  const [prioritetForm, setPrioritetForm] = useState({
    naziv: '',
    tezina: 0,
    aktivan: true,
  })
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState<StatusNaloga | null>(null)
  const [statusForm, setStatusForm] = useState({
    id: '',
    naziv: '',
    opis: '',
    redoslijed: 0,
    aktivan: true,
  })

  // Sync kriteriji state
  const [newVrstaIsporuke, setNewVrstaIsporuke] = useState('')
  const [newVrstaOpis, setNewVrstaOpis] = useState('')
  const [newSyncStatusId, setNewSyncStatusId] = useState('')
  const [newSyncStatusNaziv, setNewSyncStatusNaziv] = useState('')

  // Geocoding state
  const [manualCoordsId, setManualCoordsId] = useState<number | null>(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [geoCacheSearch, setGeoCacheSearch] = useState('')
  const [geoCacheSearchInput, setGeoCacheSearchInput] = useState('')
  const [editingCacheId, setEditingCacheId] = useState<number | null>(null)
  const [editCoords, setEditCoords] = useState('')  // format: "lat, lng"

  // Queries
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
  })

  const { data: prioriteti = [], isLoading: prioritetiLoading } = useQuery({
    queryKey: ['prioriteti'],
    queryFn: prioritetiApi.list,
  })

  const { data: statusi = [], isLoading: statusiLoading } = useQuery({
    queryKey: ['statusi'],
    queryFn: statusiApi.list,
  })

  // Vrste isporuke query
  const { data: vrsteIsporuke = [] } = useQuery({
    queryKey: ['vrste-isporuke'],
    queryFn: () => vrsteIsporukeApi.list(),
    enabled: activeTab === 'sync-kriteriji',
  })

  // Sync statusi query
  const { data: syncStatusi = [] } = useQuery({
    queryKey: ['sync-statusi'],
    queryFn: syncStatusiApi.list,
    enabled: activeTab === 'sync-kriteriji',
  })

  // Failed geocoding query
  const { data: failedGeocoding = [], isLoading: failedGeoLoading, refetch: refetchFailed } = useQuery({
    queryKey: ['failed-geocoding'],
    queryFn: mapsApi.getFailedGeocoding,
    enabled: activeTab === 'geocoding',
  })

  // Geocoding cache search query
  const { data: geoCacheResults = [], isLoading: geoCacheLoading, refetch: refetchGeoCache } = useQuery({
    queryKey: ['geocoding-cache-search', geoCacheSearch],
    queryFn: () => mapsApi.searchGeocodingCache(geoCacheSearch, 100),
    enabled: activeTab === 'geocoding' && geoCacheSearch.length > 0,
  })

  const editCoordsMutation = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      const oldInfo = data.old_lat && data.old_lng ? ` (staro: ${data.old_lat}, ${data.old_lng})` : ''
      toast.success(`Koordinate ažurirane za: ${data.address.substring(0, 40)}...${oldInfo}`)
      setEditingCacheId(null)
      setEditCoords('')
      refetchGeoCache()
      refetchFailed()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const retryGeoMutation = useMutation({
    mutationFn: mapsApi.retryFailedGeocoding,
    onSuccess: (data) => {
      toast.success(`Ponovo geocodirano: ${data.fixed} od ${data.retried} popravljeno`)
      refetchFailed()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const setManualCoordsMutation = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      toast.success(`Koordinate postavljene za: ${data.address.substring(0, 40)}...`)
      setManualCoordsId(null)
      setManualLat('')
      setManualLng('')
      refetchFailed()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const deleteCacheMutation = useMutation({
    mutationFn: mapsApi.deleteGeocodingCache,
    onSuccess: (data) => {
      toast.success(`Obrisano iz cache-a: ${data.address.substring(0, 40)}...`)
      refetchFailed()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  // Initialize edited settings from server data
  useEffect(() => {
    if (settings.length > 0) {
      const initial: Record<string, string> = {}
      // Build case-insensitive lookup from DB values
      const upperLookup = new Map<string, string>()
      settings.forEach((s: Setting) => {
        initial[s.key] = s.value || ''
        upperLookup.set(s.key.toUpperCase(), s.value || '')
      })
      // Add any missing predefined settings with defaults, matching case-insensitively
      Object.entries(SETTING_DEFINITIONS).forEach(([key, def]) => {
        const dbVal = upperLookup.get(key.toUpperCase())
        if (dbVal !== undefined && dbVal !== '') {
          initial[key] = dbVal
        } else if (!(key in initial) || !initial[key]) {
          initial[key] = def.defaultValue
        }
      })
      // Add any missing paleta settings with defaults
      Object.entries(PALETA_SETTINGS).forEach(([key, def]) => {
        const dbVal = upperLookup.get(key.toUpperCase())
        if (dbVal !== undefined && dbVal !== '') {
          initial[key] = dbVal
        } else if (!(key in initial) || !initial[key]) {
          initial[key] = String(def.defaultValue)
        }
      })
      setEditedSettings(initial)
    } else {
      // Initialize with defaults if no settings from server
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

  // Settings mutations
  const saveSettingsMutation = useMutation({
    mutationFn: (data: Record<string, string | null>) => settingsApi.bulkUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  // Prioritet mutations
  const createPrioritetMutation = useMutation({
    mutationFn: prioritetiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioriteti'] })
      closePrioritetModal()
    },
  })

  const updatePrioritetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Prioritet> }) =>
      prioritetiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioriteti'] })
      closePrioritetModal()
    },
  })

  const deletePrioritetMutation = useMutation({
    mutationFn: prioritetiApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioriteti'] })
    },
  })

  // Status mutations
  const createStatusMutation = useMutation({
    mutationFn: statusiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusi'] })
      closeStatusModal()
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StatusNaloga> }) =>
      statusiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusi'] })
      closeStatusModal()
    },
  })

  const deleteStatusMutation = useMutation({
    mutationFn: statusiApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusi'] })
    },
  })

  // Vrste isporuke mutations
  const createVrstaMutation = useMutation({
    mutationFn: vrsteIsporukeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrste-isporuke'] })
      setNewVrstaIsporuke('')
      setNewVrstaOpis('')
      toast.success('Vrsta isporuke dodana')
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const updateVrstaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VrstaIsporuke> }) =>
      vrsteIsporukeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrste-isporuke'] })
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const deleteVrstaMutation = useMutation({
    mutationFn: vrsteIsporukeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vrste-isporuke'] })
      toast.success('Vrsta isporuke obrisana')
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  // Sync statusi mutations
  const createSyncStatusMutation = useMutation({
    mutationFn: syncStatusiApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-statusi'] })
      setNewSyncStatusId('')
      setNewSyncStatusNaziv('')
      toast.success('Sync status dodan')
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const updateSyncStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SyncStatus> }) =>
      syncStatusiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-statusi'] })
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const deleteSyncStatusMutation = useMutation({
    mutationFn: syncStatusiApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-statusi'] })
      toast.success('Sync status obrisan')
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  // ============================================================================
  // Sync state management with polling
  // ============================================================================
  const [runningJobs, setRunningJobs] = useState<Record<SyncActionKey, SyncJobState | null>>(loadRunningJobs)
  const [lastResults, setLastResults] = useState<Record<SyncActionKey, SyncLastResult | null>>(loadLastResults)
  const [syncProgress, setSyncProgress] = useState<Record<SyncActionKey, string | null>>({
    refreshOrders: null, syncOrders: null, syncPartners: null, syncArtikli: null,
  })
  const [syncOrdersDateFrom, setSyncOrdersDateFrom] = useState('')
  const [syncOrdersDateTo, setSyncOrdersDateTo] = useState('')
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist state changes
  useEffect(() => { saveRunningJobs(runningJobs) }, [runningJobs])
  useEffect(() => { saveLastResults(lastResults) }, [lastResults])

  const markJobRunning = useCallback((key: SyncActionKey, syncId: number, label: string) => {
    setRunningJobs(prev => ({ ...prev, [key]: { syncId, label, startedAt: new Date().toISOString() } }))
  }, [])

  const markJobFinished = useCallback((key: SyncActionKey, syncId: number, status: string, message: string | null) => {
    setRunningJobs(prev => ({ ...prev, [key]: null }))
    setSyncProgress(prev => ({ ...prev, [key]: null }))
    setLastResults(prev => ({
      ...prev,
      [key]: { syncId, status, message, finishedAt: new Date().toISOString() },
    }))
  }, [])

  // Poll running jobs for status
  useEffect(() => {
    const poll = async () => {
      const jobs = loadRunningJobs()
      const keys = Object.keys(jobs) as SyncActionKey[]
      for (const key of keys) {
        const job = jobs[key]
        if (!job) continue
        try {
          const resp = await syncApi.status(job.syncId)
          if (resp.status === 'COMPLETED' || resp.status === 'FAILED') {
            markJobFinished(key, job.syncId, resp.status, resp.message)
            if (resp.status === 'COMPLETED') {
              toast.success(`${job.label} - zavrseno`)
            } else {
              toast.error(`${job.label} - greska: ${resp.message || 'Nepoznata greska'}`)
            }
          } else if (resp.status === 'IN_PROGRESS' && resp.message) {
            setSyncProgress(prev => ({ ...prev, [key]: resp.message }))
          }
        } catch {
          // network error - skip, retry next poll
        }
      }
    }

    // Run immediately on mount
    poll()

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(poll, 3000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [markJobFinished])

  const isSyncRunning = (key: SyncActionKey) => !!runningJobs[key]

  // Generic sync launcher
  const launchSync = useCallback(async (
    key: SyncActionKey,
    label: string,
    apiFn: () => Promise<{ sync_id: number; status: string; message: string | null }>,
  ) => {
    try {
      const resp = await apiFn()
      markJobRunning(key, resp.sync_id, label)
      toast.success(`${label} - pokrenuto (ID: ${resp.sync_id})`)
    } catch (err) {
      toast.error(`${label} - greska: ${(err as Error).message}`)
    }
  }, [markJobRunning])

  const handleRefreshOrders = () => {
    if (isSyncRunning('refreshOrders')) return
    launchSync('refreshOrders', 'Osvjezi naloge', () => syncApi.refreshOrders(undefined))
  }

  const handleSyncOrders = () => {
    if (isSyncRunning('syncOrders')) return
    if (!syncOrdersDateFrom || !syncOrdersDateTo) {
      toast.warning('Odaberite period', 'Molim odaberite datum OD i DO za sinkronizaciju.')
      return
    }
    launchSync('syncOrders', 'Sinkronizacija naloga', () =>
      syncApi.syncOrders({ datum_od: syncOrdersDateFrom, datum_do: syncOrdersDateTo }),
    )
  }

  const handleSyncPartners = () => {
    if (isSyncRunning('syncPartners')) return
    launchSync('syncPartners', 'Sinkronizacija partnera', () => syncApi.syncPartners())
  }

  const handleSyncArtikli = () => {
    if (isSyncRunning('syncArtikli')) return
    launchSync('syncArtikli', 'Sinkronizacija artikala', () => syncApi.syncArtikli())
  }

  const formatSyncTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { return iso }
  }

  const handleSettingChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    const toSave: Record<string, string | null> = {}
    Object.entries(editedSettings).forEach(([key, value]) => {
      toSave[key] = value || null
    })
    saveSettingsMutation.mutate(toSave)
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
      setPrioritetForm({
        naziv: '',
        tezina: 0,
        aktivan: true,
      })
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
      updatePrioritetMutation.mutate({ id: editingPrioritet.id, data: prioritetForm })
    } else {
      createPrioritetMutation.mutate(prioritetForm)
    }
  }

  // Status handlers
  const openStatusModal = (s?: StatusNaloga) => {
    if (s) {
      setEditingStatus(s)
      setStatusForm({
        id: s.id,
        naziv: s.naziv,
        opis: s.opis || '',
        redoslijed: s.redoslijed,
        aktivan: s.aktivan,
      })
    } else {
      setEditingStatus(null)
      setStatusForm({
        id: '',
        naziv: '',
        opis: '',
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

  return (
    <div className="settings-page">
      <Header title="Postavke" subtitle="Konfiguracija sustava" />

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          Opce postavke
        </button>
        <button
          className={`tab ${activeTab === 'prioriteti' ? 'active' : ''}`}
          onClick={() => setActiveTab('prioriteti')}
        >
          Prioriteti ({prioriteti.length})
        </button>
        <button
          className={`tab ${activeTab === 'paleta' ? 'active' : ''}`}
          onClick={() => setActiveTab('paleta')}
        >
          Izračun palete
        </button>
        <button
          className={`tab ${activeTab === 'statusi' ? 'active' : ''}`}
          onClick={() => setActiveTab('statusi')}
        >
          Statusi ({statusi.length})
        </button>
        <button
          className={`tab ${activeTab === 'geocoding' ? 'active' : ''}`}
          onClick={() => setActiveTab('geocoding')}
        >
          Geocoding {failedGeocoding.length > 0 && <span className="tab-badge">{failedGeocoding.length}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'sync-kriteriji' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync-kriteriji')}
        >
          Sync kriteriji
        </button>
        <button
          className={`tab ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          Sinkronizacija s ERP
        </button>
      </div>

      {activeTab === 'general' && (
        <Card
          className="settings-compact-card"
          title="Opce postavke"
          actions={
            <Button
              onClick={handleSaveSettings}
              isLoading={saveSettingsMutation.isPending}
            >
              Spremi promjene
            </Button>
          }
        >
          {settingsLoading ? (
            <div className="loading-state">Ucitavanje...</div>
          ) : (
            <>
            <div className="routing-tips" style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
              <strong>Preporuke za najtočnije rutiranje:</strong>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li><strong>ORS:</strong> OpenRouteService – postavite ORS_API_KEY u .env (besplatno, dobro za HR)</li>
                <li><strong>TomTom:</strong> Profesionalni provider s truck profilom – idealan za HR + SI dostave</li>
                <li><strong>OSRM:</strong> Besplatni demo server – brz, bez API ključa, ali samo osobna vozila</li>
                <li><strong>Algoritam:</strong> nearest_neighbor za brže rute, ortools za složenije s ograničenjima vozila</li>
                <li><strong>Depot:</strong> Točno postavite DEPOT_LAT i DEPOT_LNG – koordinate skladišta polaska</li>
              </ul>
            </div>
            <div className="settings-grid">
              {Object.entries(SETTING_DEFINITIONS).map(([key, def]) => (
                <div key={key} className="setting-item">
                  <div className="setting-info">
                    <label htmlFor={key}>{def.label}</label>
                    <span className="setting-description">{def.description}</span>
                  </div>
                  <div className="setting-input">
                    {def.type === 'select' && def.options ? (
                      <select
                        id={key}
                        value={editedSettings[key] || def.defaultValue}
                        onChange={(e) => handleSettingChange(key, e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                      >
                        {def.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={key}
                        type={def.type === 'number' ? 'number' : 'text'}
                        value={editedSettings[key] || ''}
                        onChange={(e) => handleSettingChange(key, e.target.value)}
                        placeholder={`Default: ${def.defaultValue}`}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Custom settings that aren't predefined */}
              {Object.keys(editedSettings)
                .filter((key) => !(key in SETTING_DEFINITIONS) && !(key in PALETA_SETTINGS) && key !== 'geocoding_provider' && key !== 'map_provider')
                .map((key) => (
                  <div key={key} className="setting-item custom">
                    <div className="setting-info">
                      <label htmlFor={key}>{key}</label>
                      <span className="setting-description">Custom postavka</span>
                    </div>
                    <div className="setting-input">
                      <input
                        id={key}
                        type="text"
                        value={editedSettings[key] || ''}
                        onChange={(e) => handleSettingChange(key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
            </div>
            </>
          )}

          {saveSettingsMutation.isSuccess && (
            <div className="success-message">Postavke su uspjesno spremljene!</div>
          )}
        </Card>
      )}

      {activeTab === 'paleta' && (
        <Card
          className="settings-compact-card"
          title="Izračun palete"
          actions={
            <Button
              onClick={handleSaveSettings}
              isLoading={saveSettingsMutation.isPending}
            >
              Spremi promjene
            </Button>
          }
        >
          <div className="paleta-info">
            <p>
              Konfigurirajte parametre za izračun broja paleta. Broj paleta se računa kao
              maksimum od volumena i težine, uzimajući u obzir i visinu artikala.
            </p>
            <div className="paleta-formula">
              <strong>Formula:</strong> Broj paleta = MAX( Σ volumen / volumen_palete , Σ težina / max_težina )
              <br />
              <strong>Visina:</strong> Ako artikl ima visinu &gt; max visina artikla, broji se kao 2 palete
            </div>
          </div>

          <div className="settings-grid">
            {Object.entries(PALETA_SETTINGS).map(([key, def]) => (
                <div key={key} className="setting-item">
                  <div className="setting-info">
                    <label htmlFor={key}>{def.label}</label>
                    <span className="setting-description">{def.description}</span>
                  </div>
                  <div className="setting-input paleta-input">
                    <input
                      id={key}
                      type="number"
                      value={editedSettings[key] || def.defaultValue}
                      onChange={(e) => handleSettingChange(key, e.target.value)}
                      min="0"
                    />
                    <span className="input-unit">{def.unit}</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Prikaz izračunatog volumena palete */}
          <div className="paleta-calculated">
            <div className="paleta-calc-item">
              <span className="paleta-calc-label">Volumen palete:</span>
              <span className="paleta-calc-value">
                {(() => {
                  const d = Number(editedSettings['PALETA_DUZINA_MM']) || 1200
                  const s = Number(editedSettings['PALETA_SIRINA_MM']) || 800
                  const v = Number(editedSettings['PALETA_VISINA_MM']) || 1800
                  return ((d * s * v) / 1_000_000_000).toFixed(3)
                })()} m³
              </span>
            </div>
          </div>

          {saveSettingsMutation.isSuccess && (
            <div className="success-message">Postavke palete su uspješno spremljene!</div>
          )}
        </Card>
      )}

      {activeTab === 'prioriteti' && (
        <Card
          title="Prioriteti isporuke"
          actions={<Button onClick={() => openPrioritetModal()}>Novi prioritet</Button>}
        >
          <DataTable<Prioritet>
            storageKey="ft-prioriteti"
            columns={[
              { key: 'naziv', label: 'Naziv' },
              { key: 'tezina', label: 'Težina' },
              { key: 'aktivan', label: 'Status' },
            ] as DataTableColumn[]}
            data={prioriteti}
            rowKey={(p) => p.id}
            isLoading={prioritetiLoading}
            emptyMessage="Nema prioriteta."
            cellValue={(p, key) => {
              if (key === 'aktivan') return p.aktivan ? 'Aktivan' : 'Neaktivan'
              return (p as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(p, key) => {
              if (key === 'aktivan') return (
                <span className={`status-badge ${p.aktivan ? 'active' : 'inactive'}`}>
                  {p.aktivan ? 'Aktivan' : 'Neaktivan'}
                </span>
              )
              return String((p as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(p) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openPrioritetModal(p)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati prioritet?')) deletePrioritetMutation.mutate(p.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {activeTab === 'statusi' && (
        <Card
          title="Statusi naloga"
          actions={<Button onClick={() => openStatusModal()}>Novi status</Button>}
        >
          <DataTable<StatusNaloga>
            storageKey="ft-statusi"
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'naziv', label: 'Naziv' },
              { key: 'opis', label: 'Opis' },
              { key: 'redoslijed', label: 'Redoslijed' },
              { key: 'aktivan', label: 'Status' },
            ] as DataTableColumn[]}
            data={statusi}
            rowKey={(s) => s.id}
            isLoading={statusiLoading}
            emptyMessage="Nema statusa."
            cellValue={(s, key) => {
              if (key === 'aktivan') return s.aktivan ? 'Aktivan' : 'Neaktivan'
              return (s as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(s, key) => {
              if (key === 'opis') return s.opis || '—'
              if (key === 'aktivan') return (
                <span className={`status-badge ${s.aktivan ? 'active' : 'inactive'}`}>
                  {s.aktivan ? 'Aktivan' : 'Neaktivan'}
                </span>
              )
              return String((s as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(s) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openStatusModal(s)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati status?')) deleteStatusMutation.mutate(s.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {activeTab === 'geocoding' && (<>
        <Card
          title="Geocoding - neuspjele adrese"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="ghost"
                onClick={() => refetchFailed()}
                size="sm"
              >
                Osvježi
              </Button>
              <Button
                onClick={() => retryGeoMutation.mutate()}
                isLoading={retryGeoMutation.isPending}
                disabled={failedGeocoding.length === 0}
              >
                Ponovi geocoding za sve ({failedGeocoding.length})
              </Button>
            </div>
          }
        >
          <div className="routing-tips" style={{ marginBottom: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
            <strong>Zašto geocoding ne uspijeva?</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Skraćenice:</strong> "RIMSKE CENT." umjesto "RIMSKE CESTE" - sustav automatski pokušava proširiti</li>
              <li><strong>Zagrade:</strong> "Dr.Franje Tuđmana 134 ( Pokupska 53 )" - uklanjaju se automatski</li>
              <li><strong>Mala mjesta:</strong> Neka mjesta nisu u bazi providera</li>
              <li><strong>Rješenje:</strong> Koristite "Ponovi geocoding" (poboljšano čišćenje adresa) ili ručno unesite GPS koordinate</li>
            </ul>
          </div>

          {failedGeoLoading ? (
            <div className="loading-state">Učitavanje...</div>
          ) : failedGeocoding.length === 0 ? (
            <div className="loading-state" style={{ color: '#059669' }}>
              Sve adrese su uspješno geocodirane!
            </div>
          ) : (
            <div className="geocoding-failed-list">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>ID</th>
                    <th style={{ padding: '8px 12px' }}>Adresa</th>
                    <th style={{ padding: '8px 12px' }}>Provider</th>
                    <th style={{ padding: '8px 12px' }}>Datum</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {failedGeocoding.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>{entry.id}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{entry.address}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>{entry.provider || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>
                        {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString('hr-HR') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {manualCoordsId === entry.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.0001"
                                placeholder="Lat"
                                value={manualLat}
                                onChange={(e) => setManualLat(e.target.value)}
                                style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                              />
                              <input
                                type="number"
                                step="0.0001"
                                placeholder="Lng"
                                value={manualLng}
                                onChange={(e) => setManualLng(e.target.value)}
                                style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  const lat = parseFloat(manualLat)
                                  const lng = parseFloat(manualLng)
                                  if (isNaN(lat) || isNaN(lng)) {
                                    toast.error('Unesite valjane koordinate')
                                    return
                                  }
                                  setManualCoordsMutation.mutate({ id: entry.id, lat, lng })
                                }}
                                isLoading={setManualCoordsMutation.isPending}
                              >
                                Spremi
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setManualCoordsId(null); setManualLat(''); setManualLng('') }}
                              >
                                X
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setManualCoordsId(entry.id)}
                                title="Ručno unesite GPS koordinate"
                              >
                                GPS
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  window.open(
                                    `https://www.google.com/maps/search/${encodeURIComponent(entry.address)}`,
                                    '_blank'
                                  )
                                }}
                                title="Otvori u Google Maps za pronalaženje koordinata"
                              >
                                Mapa
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  if (confirm(`Obrisati cache za "${entry.address}"?\nSljedeći geocode će ponovo pokušati.`)) {
                                    deleteCacheMutation.mutate(entry.id)
                                  }
                                }}
                                title="Obriši iz cache-a (sljedeći put će se ponovo pokušati)"
                              >
                                Obriši
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pretraga i korekcija svih geocoding zapisa */}
        <Card title="Pretraži i ispravi geocoding koordinate" style={{ marginTop: 16 }}>
          <div className="routing-tips" style={{ marginBottom: 16, padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <strong>Kako ispraviti krivo geocodirane adrese?</strong>
            <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>Pretražite adresu u polju ispod</li>
              <li>Kliknite "Otvori u Google Maps" da pronađete ispravnu lokaciju</li>
              <li>Na Google Maps desni klik na ispravnu lokaciju → kopirajte koordinate (format: <code>45.82466, 15.70094</code>)</li>
              <li>Kliknite "Uredi" i zalijepite koordinate</li>
              <li>Ruta se ažurira automatski pri sljedećem kreiranju</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={geoCacheSearchInput}
              onChange={(e) => setGeoCacheSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setGeoCacheSearch(geoCacheSearchInput) }}
              placeholder="Pretražite adresu (npr. Samobor, Mažuranića, Zagreb...)"
              style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6 }}
            />
            <Button onClick={() => setGeoCacheSearch(geoCacheSearchInput)}>
              Pretraži
            </Button>
          </div>

          {geoCacheLoading ? (
            <div className="loading-state">Pretraživanje...</div>
          ) : geoCacheSearch.length === 0 ? (
            <div className="loading-state" style={{ color: '#6b7280' }}>
              Unesite pojam pretrage za pregled geocoding cache-a
            </div>
          ) : geoCacheResults.length === 0 ? (
            <div className="loading-state" style={{ color: '#6b7280' }}>
              Nema rezultata za "{geoCacheSearch}"
            </div>
          ) : (
            <div className="geocoding-failed-list">
              <div style={{ marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
                Pronađeno {geoCacheResults.length} zapisa
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>ID</th>
                    <th style={{ padding: '8px 12px' }}>Adresa</th>
                    <th style={{ padding: '8px 12px' }}>Lat</th>
                    <th style={{ padding: '8px 12px' }}>Lng</th>
                    <th style={{ padding: '8px 12px' }}>Provider</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {geoCacheResults.map((entry) => (
                    <tr key={entry.id} style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: !entry.lat ? '#fef2f2' : entry.provider === 'manual' ? '#f0fdf4' : undefined,
                    }}>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>{entry.id}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: 13, maxWidth: 300 }}>
                        <div style={{ wordBreak: 'break-word' }}>{entry.address}</div>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'monospace' }}>
                        {entry.lat ? entry.lat.toFixed(6) : <span style={{ color: '#ef4444' }}>NULL</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'monospace' }}>
                        {entry.lng ? entry.lng.toFixed(6) : <span style={{ color: '#ef4444' }}>NULL</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 11,
                          background: entry.provider === 'manual' ? '#dcfce7' : entry.provider === 'tomtom' ? '#dbeafe' : '#f3f4f6',
                          color: entry.provider === 'manual' ? '#166534' : entry.provider === 'tomtom' ? '#1e40af' : '#374151',
                        }}>
                          {entry.provider || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {editingCacheId === entry.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <input
                              type="text"
                              placeholder="45.82466, 15.70094"
                              value={editCoords}
                              onChange={(e) => setEditCoords(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const parts = editCoords.split(',').map(s => s.trim())
                                  if (parts.length === 2) {
                                    const lat = parseFloat(parts[0])
                                    const lng = parseFloat(parts[1])
                                    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                      editCoordsMutation.mutate({ id: entry.id, lat, lng })
                                    } else {
                                      toast.error('Neispravne koordinate. Format: lat, lng (npr. 45.82466, 15.70094)')
                                    }
                                  } else {
                                    toast.error('Format: lat, lng (npr. 45.82466, 15.70094)')
                                  }
                                }
                              }}
                              style={{ width: 220, padding: '4px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4 }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const parts = editCoords.split(',').map(s => s.trim())
                                if (parts.length === 2) {
                                  const lat = parseFloat(parts[0])
                                  const lng = parseFloat(parts[1])
                                  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                    editCoordsMutation.mutate({ id: entry.id, lat, lng })
                                  } else {
                                    toast.error('Neispravne koordinate')
                                  }
                                } else {
                                  toast.error('Format: lat, lng (npr. 45.82466, 15.70094)')
                                }
                              }}
                              isLoading={editCoordsMutation.isPending}
                            >
                              Spremi
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingCacheId(null); setEditCoords('') }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCacheId(entry.id)
                                setEditCoords(entry.lat && entry.lng ? `${entry.lat.toFixed(6)}, ${entry.lng.toFixed(6)}` : '')
                              }}
                              title="Uredi koordinate (zalijepite iz Google Maps)"
                            >
                              ✏️ Uredi
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                window.open(
                                  `https://www.google.com/maps/search/${encodeURIComponent(entry.address)}`,
                                  '_blank'
                                )
                              }}
                              title="Otvori adresu u Google Maps"
                            >
                              🗺️ Maps
                            </Button>
                            {entry.lat && entry.lng && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  window.open(
                                    `https://www.google.com/maps?q=${entry.lat},${entry.lng}`,
                                    '_blank'
                                  )
                                }}
                                title="Prikaži trenutne koordinate na Google Maps"
                              >
                                📍 Vidi
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                if (confirm(`Obrisati cache za "${entry.address}"?\nSljedeći geocode će ponovo pokušati.`)) {
                                  deleteCacheMutation.mutate(entry.id, {
                                    onSuccess: () => refetchGeoCache(),
                                  })
                                }
                              }}
                            >
                              🗑️
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </>)}

      {activeTab === 'sync-kriteriji' && (
        <div className="sync-kriteriji-tab">
          {/* === Sekcija 1: Vrste isporuke === */}
          <Card title={`Vrste isporuke (${vrsteIsporuke.length})`}>
            <p className="section-description">
              Samo nalozi s aktivnom vrstom isporuke se sinkroniziraju iz ERP-a.
              Deaktivirajte vrstu da privremeno isključite sync za tu vrstu, ili je obrišite ako više nije potrebna.
            </p>

            <div className="criteria-add-form">
              <input
                type="text"
                placeholder="Šifra (npr. DOSTAVA)"
                value={newVrstaIsporuke}
                onChange={(e) => setNewVrstaIsporuke(e.target.value)}
                className="criteria-input"
              />
              <input
                type="text"
                placeholder="Opis (opcijski)"
                value={newVrstaOpis}
                onChange={(e) => setNewVrstaOpis(e.target.value)}
                className="criteria-input criteria-input-wide"
              />
              <Button
                onClick={() => {
                  if (!newVrstaIsporuke.trim()) return toast.error('Unesite šifru vrste isporuke')
                  createVrstaMutation.mutate({ vrsta_isporuke: newVrstaIsporuke.trim(), opis: newVrstaOpis.trim() || undefined })
                }}
                isLoading={createVrstaMutation.isPending}
                size="sm"
              >
                + Dodaj
              </Button>
            </div>

            <table className="criteria-table">
              <thead>
                <tr>
                  <th>Vrsta isporuke</th>
                  <th>Opis</th>
                  <th>Aktivna</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {vrsteIsporuke.length === 0 && (
                  <tr><td colSpan={4} className="criteria-empty">Nema definiranih vrsta isporuke</td></tr>
                )}
                {vrsteIsporuke.map((v: VrstaIsporuke) => (
                  <tr key={v.id} className={!v.aktivan ? 'criteria-inactive' : ''}>
                    <td className="criteria-code">{v.vrsta_isporuke}</td>
                    <td>{v.opis || '—'}</td>
                    <td>
                      <label className="criteria-toggle">
                        <input
                          type="checkbox"
                          checked={v.aktivan}
                          onChange={(e) => updateVrstaMutation.mutate({ id: v.id, data: { aktivan: e.target.checked } })}
                        />
                        <span className="criteria-toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <button
                        className="criteria-delete-btn"
                        onClick={() => {
                          if (confirm(`Obrisati vrstu isporuke "${v.vrsta_isporuke}"?`))
                            deleteVrstaMutation.mutate(v.id)
                        }}
                        title="Obriši"
                      >
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* === Sekcija 2: Statusi za sinkronizaciju === */}
          <Card title={`Statusi naloga za sync (${syncStatusi.length})`}>
            <p className="section-description">
              Definirajte u kojim ERP statusima se nalozi sinkroniziraju s aplikacijom.
              Samo nalozi čiji je status aktivan u ovoj listi će biti uvezeni pri sinkronizaciji.
              {syncStatusi.length === 0 && (
                <strong> Ako je lista prazna, koriste se defaultni statusi: 08, 101, 102, 103.</strong>
              )}
            </p>

            <div className="criteria-add-form">
              <input
                type="text"
                placeholder="Status ID (npr. 08, 101)"
                value={newSyncStatusId}
                onChange={(e) => setNewSyncStatusId(e.target.value)}
                className="criteria-input"
              />
              <input
                type="text"
                placeholder="Naziv (npr. Odobreno)"
                value={newSyncStatusNaziv}
                onChange={(e) => setNewSyncStatusNaziv(e.target.value)}
                className="criteria-input criteria-input-wide"
              />
              <Button
                onClick={() => {
                  if (!newSyncStatusId.trim()) return toast.error('Unesite status ID')
                  createSyncStatusMutation.mutate({
                    status_id: newSyncStatusId.trim(),
                    naziv: newSyncStatusNaziv.trim() || undefined,
                  })
                }}
                isLoading={createSyncStatusMutation.isPending}
                size="sm"
              >
                + Dodaj
              </Button>
            </div>

            <table className="criteria-table">
              <thead>
                <tr>
                  <th>Status ID</th>
                  <th>Naziv</th>
                  <th>Aktivan</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {syncStatusi.length === 0 && (
                  <tr><td colSpan={4} className="criteria-empty">
                    Nema definiranih statusa — koriste se defaultni (08, 101, 102, 103)
                  </td></tr>
                )}
                {syncStatusi.map((ss: SyncStatus) => (
                  <tr key={ss.id} className={!ss.aktivan ? 'criteria-inactive' : ''}>
                    <td className="criteria-code">{ss.status_id}</td>
                    <td>{ss.naziv || '—'}</td>
                    <td>
                      <label className="criteria-toggle">
                        <input
                          type="checkbox"
                          checked={ss.aktivan}
                          onChange={(e) => updateSyncStatusMutation.mutate({ id: ss.id, data: { aktivan: e.target.checked } })}
                        />
                        <span className="criteria-toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <button
                        className="criteria-delete-btn"
                        onClick={() => {
                          if (confirm(`Obrisati sync status "${ss.status_id}"?`))
                            deleteSyncStatusMutation.mutate(ss.id)
                        }}
                        title="Obriši"
                      >
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* === Sekcija 3: Dodatni filteri === */}
          <Card title="Dodatni filteri za sinkronizaciju">
            <div className="criteria-filter-section">
              <div className="criteria-filter-item">
                <div className="criteria-filter-info">
                  <h4>Zahtijevaj raspored (datum isporuke)</h4>
                  <p>
                    Ako je uključeno, nalozi koji nemaju ispunjen datum rasporeda (isporuke) u ERP-u
                    neće se sinkronizirati s aplikacijom. Korisno za filtriranje naloga koji još nisu
                    planirani za dostavu.
                  </p>
                </div>
                <label className="criteria-toggle criteria-toggle-large">
                  <input
                    type="checkbox"
                    checked={editedSettings['SYNC_REQUIRE_RASPORED'] === '1' || editedSettings['SYNC_REQUIRE_RASPORED'] === 'true'}
                    onChange={(e) => {
                      const val = e.target.checked ? '1' : '0'
                      setEditedSettings(prev => ({ ...prev, SYNC_REQUIRE_RASPORED: val }))
                      saveSettingsMutation.mutate({ SYNC_REQUIRE_RASPORED: val }, {
                        onSuccess: () => toast.success(e.target.checked ? 'Filter rasporeda uključen' : 'Filter rasporeda isključen'),
                      })
                    }}
                  />
                  <span className="criteria-toggle-slider" />
                </label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'sync' && (<>
        <Card title="Sinkronizacija s ERP sustavom">
          <div className="sync-section">
            <div className="sync-info">
              <p>
                Upravljajte sinkronizacijom podataka između lokalne baze i ERP sustava (Luceed).
                Svaka akcija pokreće pozadinsku sinkronizaciju. Dok je sinkronizacija u tijeku,
                ikona se vrti i gumb je onemogućen.
              </p>
            </div>

            <div className="sync-actions-grid">
              {/* Osvježi naloge */}
              <div className={`sync-action-card ${isSyncRunning('refreshOrders') ? 'sync-running' : ''}`}>
                <div className="sync-action-header">
                  <span className={`sync-action-icon ${isSyncRunning('refreshOrders') ? 'spin' : ''}`}>&#x21bb;</span>
                  <h3>Osvježi naloge</h3>
                </div>
                <p className="sync-action-desc">
                  Osvježava naloge koji su u statusu <strong>Odobreno (08)</strong> s najnovijim
                  podacima iz ERP-a. Ažurira header naloga i podatke o partnerima ako je došlo do promjene.
                </p>
                <button
                  className={`sync-btn ${isSyncRunning('refreshOrders') ? 'sync-btn-running' : ''}`}
                  onClick={handleRefreshOrders}
                  disabled={isSyncRunning('refreshOrders')}
                >
                  {isSyncRunning('refreshOrders') ? (
                    <><span className="sync-spinner" /> U tijeku...</>
                  ) : 'Osvježi naloge'}
                </button>
                {isSyncRunning('refreshOrders') && syncProgress.refreshOrders && (
                  <div className="sync-progress-info">
                    <div className="sync-progress-text">{syncProgress.refreshOrders}</div>
                  </div>
                )}
                {lastResults.refreshOrders && (
                  <div className={`sync-last-result ${lastResults.refreshOrders.status === 'COMPLETED' ? 'success' : 'error'}`}>
                    <span className="sync-last-time">{formatSyncTime(lastResults.refreshOrders.finishedAt)}</span>
                    <span className="sync-last-status">{lastResults.refreshOrders.status === 'COMPLETED' ? 'Uspješno' : 'Greška'}</span>
                    {lastResults.refreshOrders.message && (
                      <span className="sync-last-message">{lastResults.refreshOrders.message}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sinkronizacija naloga s datumima */}
              <div className={`sync-action-card ${isSyncRunning('syncOrders') ? 'sync-running' : ''}`}>
                <div className="sync-action-header">
                  <span className={`sync-action-icon ${isSyncRunning('syncOrders') ? 'spin' : ''}`}>&#x21bb;</span>
                  <h3>Sinkroniziraj naloge</h3>
                </div>
                <p className="sync-action-desc">
                  Puni import naloga iz ERP-a za odabrani period.
                  Importiraju se samo nalozi čija je <strong>vrsta_isporuke</strong> unesena u tablicu <strong>vrste_isporuke</strong>.
                </p>
                <div className="sync-date-filters">
                  <div className="sync-date-group">
                    <label>Datum od</label>
                    <input
                      type="date"
                      value={syncOrdersDateFrom}
                      onChange={(e) => setSyncOrdersDateFrom(e.target.value)}
                      disabled={isSyncRunning('syncOrders')}
                    />
                  </div>
                  <div className="sync-date-group">
                    <label>Datum do</label>
                    <input
                      type="date"
                      value={syncOrdersDateTo}
                      onChange={(e) => setSyncOrdersDateTo(e.target.value)}
                      disabled={isSyncRunning('syncOrders')}
                    />
                  </div>
                </div>
                <button
                  className={`sync-btn ${isSyncRunning('syncOrders') ? 'sync-btn-running' : ''}`}
                  onClick={handleSyncOrders}
                  disabled={isSyncRunning('syncOrders')}
                >
                  {isSyncRunning('syncOrders') ? (
                    <><span className="sync-spinner" /> U tijeku...</>
                  ) : 'Pokreni sync naloga'}
                </button>
                {isSyncRunning('syncOrders') && syncProgress.syncOrders && (
                  <div className="sync-progress-info">
                    <div className="sync-progress-text">{syncProgress.syncOrders}</div>
                    {(() => {
                      const match = syncProgress.syncOrders?.match(/\((\d+)%\)/)
                      const pct = match ? parseInt(match[1], 10) : 0
                      return (
                        <div className="sync-progress-bar-container">
                          <div className="sync-progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      )
                    })()}
                  </div>
                )}
                {lastResults.syncOrders && (
                  <div className={`sync-last-result ${lastResults.syncOrders.status === 'COMPLETED' ? 'success' : 'error'}`}>
                    <span className="sync-last-time">{formatSyncTime(lastResults.syncOrders.finishedAt)}</span>
                    <span className="sync-last-status">{lastResults.syncOrders.status === 'COMPLETED' ? 'Uspješno' : 'Greška'}</span>
                    {lastResults.syncOrders.message && (
                      <span className="sync-last-message">{lastResults.syncOrders.message}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sinkroniziraj partnere */}
              <div className={`sync-action-card ${isSyncRunning('syncPartners') ? 'sync-running' : ''}`}>
                <div className="sync-action-header">
                  <span className={`sync-action-icon ${isSyncRunning('syncPartners') ? 'spin' : ''}`}>&#x21bb;</span>
                  <h3>Sinkroniziraj partnere</h3>
                </div>
                <p className="sync-action-desc">
                  Ažurira podatke o partnerima (kupci, adrese, kontakti) iz ERP sustava.
                </p>
                <button
                  className={`sync-btn ${isSyncRunning('syncPartners') ? 'sync-btn-running' : ''}`}
                  onClick={handleSyncPartners}
                  disabled={isSyncRunning('syncPartners')}
                >
                  {isSyncRunning('syncPartners') ? (
                    <><span className="sync-spinner" /> U tijeku...</>
                  ) : 'Pokreni sync partnera'}
                </button>
                {isSyncRunning('syncPartners') && syncProgress.syncPartners && (
                  <div className="sync-progress-info">
                    <div className="sync-progress-text">{syncProgress.syncPartners}</div>
                  </div>
                )}
                {lastResults.syncPartners && (
                  <div className={`sync-last-result ${lastResults.syncPartners.status === 'COMPLETED' ? 'success' : 'error'}`}>
                    <span className="sync-last-time">{formatSyncTime(lastResults.syncPartners.finishedAt)}</span>
                    <span className="sync-last-status">{lastResults.syncPartners.status === 'COMPLETED' ? 'Uspješno' : 'Greška'}</span>
                    {lastResults.syncPartners.message && (
                      <span className="sync-last-message">{lastResults.syncPartners.message}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sinkroniziraj artikle */}
              <div className={`sync-action-card ${isSyncRunning('syncArtikli') ? 'sync-running' : ''}`}>
                <div className="sync-action-header">
                  <span className={`sync-action-icon ${isSyncRunning('syncArtikli') ? 'spin' : ''}`}>&#x21bb;</span>
                  <h3>Sinkroniziraj artikle</h3>
                </div>
                <p className="sync-action-desc">
                  Ažurira šifarnik artikala (nazivi, mase, volumeni, grupe) iz ERP sustava.
                </p>
                <button
                  className={`sync-btn ${isSyncRunning('syncArtikli') ? 'sync-btn-running' : ''}`}
                  onClick={handleSyncArtikli}
                  disabled={isSyncRunning('syncArtikli')}
                >
                  {isSyncRunning('syncArtikli') ? (
                    <><span className="sync-spinner" /> U tijeku...</>
                  ) : 'Pokreni sync artikala'}
                </button>
                {isSyncRunning('syncArtikli') && syncProgress.syncArtikli && (
                  <div className="sync-progress-info">
                    <div className="sync-progress-text">{syncProgress.syncArtikli}</div>
                  </div>
                )}
                {lastResults.syncArtikli && (
                  <div className={`sync-last-result ${lastResults.syncArtikli.status === 'COMPLETED' ? 'success' : 'error'}`}>
                    <span className="sync-last-time">{formatSyncTime(lastResults.syncArtikli.finishedAt)}</span>
                    <span className="sync-last-status">{lastResults.syncArtikli.status === 'COMPLETED' ? 'Uspješno' : 'Greška'}</span>
                    {lastResults.syncArtikli.message && (
                      <span className="sync-last-message">{lastResults.syncArtikli.message}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <BlacklistSection />
      </>)}

      {/* Prioritet Modal */}
      {showPrioritetModal && (
        <div className="modal-overlay" onClick={closePrioritetModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPrioritet ? 'Uredi prioritet' : 'Novi prioritet'}</h2>
            <form onSubmit={handlePrioritetSubmit}>
              <div className="form-group">
                <label>Naziv *</label>
                <input
                  type="text"
                  value={prioritetForm.naziv}
                  onChange={(e) => setPrioritetForm({ ...prioritetForm, naziv: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tezina (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={prioritetForm.tezina}
                  onChange={(e) =>
                    setPrioritetForm({ ...prioritetForm, tezina: Number(e.target.value) })
                  }
                />
                <span className="input-help">Visa tezina = veci prioritet</span>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={prioritetForm.aktivan}
                    onChange={(e) =>
                      setPrioritetForm({ ...prioritetForm, aktivan: e.target.checked })
                    }
                  />
                  Aktivan prioritet
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closePrioritetModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createPrioritetMutation.isPending || updatePrioritetMutation.isPending}
                >
                  {editingPrioritet ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={closeStatusModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingStatus ? 'Uredi status' : 'Novi status'}</h2>
            <form onSubmit={handleStatusSubmit}>
              <div className="form-group">
                <label>ID (šifra) *</label>
                <input
                  type="text"
                  value={statusForm.id}
                  onChange={(e) => setStatusForm({ ...statusForm, id: e.target.value })}
                  required
                  disabled={!!editingStatus}
                  placeholder="npr. 08, 101, 30..."
                />
                {editingStatus && (
                  <span className="input-help">ID se ne može mijenjati</span>
                )}
              </div>
              <div className="form-group">
                <label>Naziv *</label>
                <input
                  type="text"
                  value={statusForm.naziv}
                  onChange={(e) => setStatusForm({ ...statusForm, naziv: e.target.value })}
                  required
                  placeholder="npr. Odobreno, Na dostavi..."
                />
              </div>
              <div className="form-group">
                <label>Opis</label>
                <input
                  type="text"
                  value={statusForm.opis}
                  onChange={(e) => setStatusForm({ ...statusForm, opis: e.target.value })}
                  placeholder="Opcijski opis statusa"
                />
              </div>
              <div className="form-group">
                <label>Redoslijed</label>
                <input
                  type="number"
                  min="0"
                  value={statusForm.redoslijed}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, redoslijed: Number(e.target.value) })
                  }
                />
                <span className="input-help">Manji broj = ranije u listi</span>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={statusForm.aktivan}
                    onChange={(e) =>
                      setStatusForm({ ...statusForm, aktivan: e.target.checked })
                    }
                  />
                  Aktivan status
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closeStatusModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createStatusMutation.isPending || updateStatusMutation.isPending}
                >
                  {editingStatus ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
