import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, Button, toast } from '../components/common'
import { ordersApi, settingsApi, statusiApi, partnersApi, itemsApi, routingOrdersApi, mantisApi } from '../services/api'
import type { NalogHeader, StatusNaloga } from '../types'
import {
  ORDER_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  VIRTUAL_COLUMN_PARTNER_KUPAC,
  loadVisibleColumnKeys,
  saveVisibleColumnKeys,
} from './ordersColumns'
import './OrdersPage.css'

const COLUMN_WIDTHS_STORAGE_KEY = 'ft-logistika-orders-column-widths'
const DEFAULT_COLUMN_WIDTH = 140
const MIN_COLUMN_WIDTH = 80

function loadColumnWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveColumnWidths(widths: Record<string, number>) {
  try {
    localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths))
  } catch {
    /* ignore */
  }
}

type TabId = 'list'

/** Vraća naziv statusa iz dinamičkog popisa, ili ID ako nije pronađen. */
function getStatusLabel(statusId: string | null, statusiMap: Map<string, string>): string {
  if (!statusId) return '—'
  return statusiMap.get(statusId) || statusId
}

/** Vrijednost ćelije za prikaz/filter/sort; virtualna kolona "Kupac": prazan naziv → ime prezime, inače naziv => ime prezime. */
function getOrderCellValue(order: NalogHeader, key: string): unknown {
  if (key === VIRTUAL_COLUMN_PARTNER_KUPAC) {
    const imePrezime = [order.partner_ime, order.partner_prezime]
      .filter(Boolean)
      .join(' ')
      .trim()
    const naziv = (order.partner_naziv ?? '').trim()
    if (!naziv) return imePrezime || ''
    if (imePrezime) return `${naziv} => ${imePrezime}`
    return naziv
  }
  return (order as unknown as Record<string, unknown>)[key]
}

function cellDisplay(key: string, value: unknown, _order: NalogHeader, statusiMap?: Map<string, string>): string {
  if (value === null || value === undefined) return '—'
  if (key === 'status') return getStatusLabel(String(value), statusiMap ?? new Map())
  if (key === 'za_naplatu')
    return `${Number(value).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
  if (key === 'total_weight') {
    const n = Number(value)
    if (Number.isNaN(n)) return '—'
    return `${n.toFixed(2)} kg`
  }
  if (key === 'total_volume') {
    const n = Number(value)
    if (Number.isNaN(n)) return '—'
    const m3 = n / 1_000_000
    return `${m3.toFixed(3)} m³`
  }
  if (
    key === 'datum' ||
    key === 'raspored' ||
    key === 'rezervacija_do_datuma' ||
    key === 'created_at' ||
    key === 'updated_at' ||
    key === 'synced_at'
  )
    return String(value)
  if (typeof value === 'object' && value !== null && 'toString' in value)
    return String(value)
  return String(value)
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeTab] = useState<TabId>('list')
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    rasporedFrom: '',
    rasporedTo: '',
    vrstaIsporuke: '',
    search: '',
  })
  const [selectedOrderUid, setSelectedOrderUid] = useState<string | null>(null)
  const [checkedOrderUids, setCheckedOrderUids] = useState<Set<string>>(new Set())
  const PAGE_SIZE = 100
  const [currentPage, setCurrentPage] = useState(0)
  const updateFilters = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setCurrentPage(0)
  }

  // Resizable detail panel
  const [detailWidth, setDetailWidth] = useState(() => {
    const saved = localStorage.getItem('ft-orders-detail-width')
    return saved ? parseInt(saved) : 520
  })
  const detailDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const layoutRef = useRef<HTMLDivElement>(null)

  const handleDetailResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    detailDragRef.current = { startX: e.clientX, startW: detailWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [detailWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!detailDragRef.current) return
      // Pomicanje ulijevo = povećanje detail panela, udesno = smanjivanje
      const delta = detailDragRef.current.startX - e.clientX
      const next = Math.max(350, Math.min(900, detailDragRef.current.startW + delta))
      setDetailWidth(next)
    }
    const onUp = () => {
      if (!detailDragRef.current) return
      detailDragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist
      localStorage.setItem('ft-orders-detail-width', String(detailWidth))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [detailWidth])
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    const saved = loadVisibleColumnKeys()
    if (!saved) return DEFAULT_VISIBLE_COLUMN_KEYS
    const migrated = saved
      .map((k) =>
        k === 'partner_naziv' || k === 'partner_ime_prezime'
          ? VIRTUAL_COLUMN_PARTNER_KUPAC
          : k
      )
      .filter((k, i, arr) => arr.indexOf(k) === i)
    const validKeys = migrated.filter((k) =>
      ORDER_TABLE_COLUMNS.some((c) => c.key === k)
    )
    return validKeys.length > 0 ? validKeys : DEFAULT_VISIBLE_COLUMN_KEYS
  })
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {}
  )
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [columnPickerPosition, setColumnPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [filterDropdownKey, setFilterDropdownKey] = useState<string | null>(null)
  const [filterDropdownPosition, setFilterDropdownPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    loadColumnWidths
  )
  const columnPickerRef = useRef<HTMLDivElement>(null)
  const columnPickerButtonRef = useRef<HTMLSpanElement>(null)
  const columnPickerDropdownRef = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLDivElement>(null)
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null)
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () =>
      ordersApi.list({
        status: filters.status || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        raspored_from: filters.rasporedFrom || undefined,
        raspored_to: filters.rasporedTo || undefined,
        vrsta_isporuke: filters.vrstaIsporuke || undefined,
        limit: 1000,
      }),
  })

  const { data: selectedOrder } = useQuery({
    queryKey: ['order', selectedOrderUid],
    queryFn: () => ordersApi.get(selectedOrderUid!),
    enabled: !!selectedOrderUid,
  })

  // Mantis WMS SSCC podaci za odabrani nalog
  const { data: mantisData, refetch: refetchMantis, isFetching: mantisFetching } = useQuery({
    queryKey: ['mantis-order', selectedOrderUid],
    queryFn: () => mantisApi.getOrder(selectedOrderUid!),
    enabled: !!selectedOrderUid,
    staleTime: 5 * 60 * 1000, // 5 minuta
  })

  // Kad se mantis detalj podaci osvježe, invalidiraj i bulk query da tablica vidi nove podatke
  useEffect(() => {
    if (mantisData?.has_data) {
      queryClient.invalidateQueries({ queryKey: ['mantis-bulk-orders'] })
    }
  }, [mantisData, queryClient])

  // Inline edit za partner polja u detaljima naloga
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const updatePartnerMutation = useMutation({
    mutationFn: ({ partnerUid, data }: { partnerUid: string; data: Record<string, string> }) =>
      partnersApi.update(partnerUid, data),
    onSuccess: () => {
      toast.success('Podaci partnera ažurirani.')
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderUid] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setEditingField(null)
    },
    onError: (error) => {
      toast.error(`Greška: ${(error as Error).message}`)
    },
  })

  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field)
    setEditValue(currentValue ?? '')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEdit = (field: string) => {
    if (!selectedOrder?.partner_uid) return
    updatePartnerMutation.mutate({
      partnerUid: selectedOrder.partner_uid,
      data: { [field]: editValue },
    })
  }

  // Dohvati statuse
  const { data: statusi = [] } = useQuery({
    queryKey: ['statusi'],
    queryFn: statusiApi.list,
  })

  // Mapa statusa za brzi lookup
  const statusiMap = useMemo(() => {
    const map = new Map<string, string>()
    statusi.forEach((s: StatusNaloga) => map.set(s.id, s.naziv))
    return map
  }, [statusi])

  // Dohvati paleta settings
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
  })

  // Dohvati UID-ove naloga u rutiranju (za filtriranje)
  const { data: rutiranjeUids = [] } = useQuery({
    queryKey: ['rutiranje-uids'],
    queryFn: routingOrdersApi.getRutiranjeUids,
  })
  const rutiranjeUidsSet = useMemo(() => new Set(rutiranjeUids), [rutiranjeUids])

  // State za loading gumba "Kreiraj rutu"
  const [prebaciLoading, setPrebaciLoading] = useState(false)

  // Dohvati set naloga koji sadrže artikle s kriterijima (za highlight)
  const { data: ordersWithCriteria = [] } = useQuery({
    queryKey: ['orders-with-criteria'],
    queryFn: ordersApi.getOrdersWithCriteria,
  })
  const criteriaOrderUids = useMemo(() => new Set(ordersWithCriteria), [ordersWithCriteria])

  // Dohvati set šifri artikala s kriterijem (za highlight stavki u detaljima)
  const { data: criteriaArtiklSifre = [] } = useQuery({
    queryKey: ['artikli-kriterija-sifre'],
    queryFn: itemsApi.getArtiklSifreWithCriteria,
  })
  const criteriaArtiklSet = useMemo(() => new Set(criteriaArtiklSifre), [criteriaArtiklSifre])

  // Paleta parametri
  const paletaConfig = useMemo(() => {
    const getVal = (key: string, def: number) => {
      const s = settings.find((s: { key: string; value: string | null }) => s.key === key)
      return s?.value ? Number(s.value) : def
    }
    const duzina = getVal('PALETA_DUZINA_MM', 1200)
    const sirina = getVal('PALETA_SIRINA_MM', 800)
    const visina = getVal('PALETA_VISINA_MM', 1800)
    const maxTezina = getVal('PALETA_MAX_TEZINA_KG', 1200)
    const maxVisinaArtikla = getVal('PALETA_MAX_VISINA_ARTIKLA_MM', 2000)
    const volumenM3 = (duzina * sirina * visina) / 1_000_000_000 // mm³ to m³
    return { duzina, sirina, visina, maxTezina, maxVisinaArtikla, volumenM3 }
  }, [settings])



  // Filtriraj naloge koji su u rutiranju (ne prikazuj ih)
  const ordersWithoutRutiranje = useMemo(() => {
    if (rutiranjeUidsSet.size === 0) return orders
    return orders.filter((o: NalogHeader) => !rutiranjeUidsSet.has(o.nalog_prodaje_uid))
  }, [orders, rutiranjeUidsSet])

  const searchFiltered = useMemo(() => {
    if (!filters.search) return ordersWithoutRutiranje
    const search = filters.search.toLowerCase()
    return ordersWithoutRutiranje.filter((order: NalogHeader) => {
      const kupac = String(
        getOrderCellValue(order, VIRTUAL_COLUMN_PARTNER_KUPAC) ?? ''
      ).toLowerCase()
      return (
        order.nalog_prodaje_uid?.toLowerCase().includes(search) ||
        order.korisnik__partner?.toLowerCase().includes(search) ||
        order.partner?.toLowerCase().includes(search) ||
        kupac.includes(search) ||
        order.broj?.toString().includes(search) ||
        order.narudzba?.toLowerCase().includes(search)
      )
    })
  }, [ordersWithoutRutiranje, filters.search])

  /**
   * Za svaku kolonu izračunaj dostupne vrijednosti filtriranjem po SVIM OSTALIM filterima
   * (osim filtera te konkretne kolone). Tako korisnik vidi koje opcije su dostupne
   * s obzirom na ostale aktivne filtere.
   */
  const distinctByColumn = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    ORDER_TABLE_COLUMNS.forEach(({ key: targetKey }) => {
      map[targetKey] = new Set()
      // Filtriraj po svim filterima OSIM filtera za targetKey
      const relevantOrders = searchFiltered.filter((order: NalogHeader) => {
        for (const colKey of visibleColumnKeys) {
          if (colKey === targetKey) continue // preskoči filter za ovu kolonu
          const selected = columnFilters[colKey]
          if (!selected || selected.length === 0) continue
          const raw = getOrderCellValue(order, colKey)
          const cellVal =
            raw === null || raw === undefined ? '' : String(raw).trim()
          if (!selected.includes(cellVal)) return false
        }
        return true
      })
      // Skupi dostupne vrijednosti za targetKey
      relevantOrders.forEach((order: NalogHeader) => {
        const raw = getOrderCellValue(order, targetKey)
        const v = raw === null || raw === undefined ? '' : String(raw).trim()
        map[targetKey].add(v)
      })
    })
    return map
  }, [searchFiltered, visibleColumnKeys, columnFilters])

  const filteredOrders = useMemo(() => {
    return searchFiltered.filter((order: NalogHeader) => {
      for (const colKey of visibleColumnKeys) {
        const selected = columnFilters[colKey]
        if (!selected || selected.length === 0) continue
        const raw = getOrderCellValue(order, colKey)
        const cellVal =
          raw === null || raw === undefined ? '' : String(raw).trim()
        if (!selected.includes(cellVal)) return false
      }
      return true
    })
  }, [searchFiltered, visibleColumnKeys, columnFilters])

  const sortedOrders = useMemo(() => {
    if (!sortBy) return filteredOrders
    const key = sortBy
    return [...filteredOrders].sort((a, b) => {
      const rawA = getOrderCellValue(a, key)
      const rawB = getOrderCellValue(b, key)
      const aVal = rawA === null || rawA === undefined ? '' : rawA
      const bVal = rawB === null || rawB === undefined ? '' : rawB
      const numA = typeof aVal === 'number' ? aVal : Number(aVal)
      const numB = typeof bVal === 'number' ? bVal : Number(bVal)
      if (!Number.isNaN(numA) && !Number.isNaN(numB))
        return sortDir === 'asc' ? numA - numB : numB - numA
      const strA = String(aVal)
      const strB = String(bVal)
      const cmp = strA.localeCompare(strB, 'hr', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredOrders, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages - 1)
  const paginatedOrders = useMemo(() => {
    const start = safePage * PAGE_SIZE
    return sortedOrders.slice(start, start + PAGE_SIZE)
  }, [sortedOrders, safePage])

  // WMS bulk status za naloge na stranici (samo ako je WMS kolona vidljiva)
  const wmsColumnVisible = visibleColumnKeys.includes('wms_status')
  const visibleOrderUids = useMemo(() => paginatedOrders.map((o) => o.nalog_prodaje_uid), [paginatedOrders])
  const { data: wmsBulkMap } = useQuery({
    queryKey: ['mantis-bulk-orders', visibleOrderUids],
    queryFn: () => mantisApi.getOrdersBulk(visibleOrderUids),
    enabled: wmsColumnVisible && visibleOrderUids.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Izračunaj sume za označene naloge
  const checkedTotals = useMemo(() => {
    let totalWeight = 0
    let totalVolume = 0
    let count = 0
    sortedOrders.forEach((order) => {
      if (checkedOrderUids.has(order.nalog_prodaje_uid)) {
        count++
        if (order.total_weight) totalWeight += order.total_weight
        if (order.total_volume) totalVolume += order.total_volume
      }
    })
    // Izračun broja paleta
    // Volumen je u cm³, pretvori u m³
    const volumeM3 = totalVolume / 1_000_000
    const paletaByVolume = paletaConfig.volumenM3 > 0 ? volumeM3 / paletaConfig.volumenM3 : 0
    const paletaByWeight = paletaConfig.maxTezina > 0 ? totalWeight / paletaConfig.maxTezina : 0
    const paletaCount = Math.ceil(Math.max(paletaByVolume, paletaByWeight))
    return { totalWeight, totalVolume, count, paletaCount, paletaByVolume, paletaByWeight }
  }, [sortedOrders, checkedOrderUids, paletaConfig])

  // WMS SSCC podaci za označene naloge (summary kartice)
  const checkedUidsArray = useMemo(() => [...checkedOrderUids], [checkedOrderUids])
  const { data: wmsCheckedBulk } = useQuery({
    queryKey: ['mantis-bulk-checked', checkedUidsArray],
    queryFn: () => mantisApi.getOrdersBulk(checkedUidsArray),
    enabled: checkedUidsArray.length > 0,
    staleTime: 60 * 1000,
  })

  const wmsCheckedTotals = useMemo(() => {
    if (!wmsCheckedBulk || checkedUidsArray.length === 0) return { totalPallets: 0, allComplete: false, partialCount: 0, noneCount: 0, hasData: false }
    const allSscc = new Set<string>()
    let completeCount = 0
    let partialCount = 0
    let noneCount = 0
    let hasAnyData = false
    for (const uid of checkedUidsArray) {
      const s = wmsCheckedBulk[uid]
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
  }, [wmsCheckedBulk, checkedUidsArray])

  // Checkbox funkcije
  const toggleOrderCheck = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation() // ne otvara detalje
    setCheckedOrderUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  const toggleAllChecked = () => {
    if (checkedOrderUids.size === sortedOrders.length) {
      // Sve je označeno - odznači sve
      setCheckedOrderUids(new Set())
    } else {
      // Označi sve
      setCheckedOrderUids(new Set(sortedOrders.map((o) => o.nalog_prodaje_uid)))
    }
  }

  const clearChecked = () => {
    setCheckedOrderUids(new Set())
  }

  const handleSort = (colKey: string) => {
    setSortBy((prev) => {
      if (prev === colKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return colKey
      }
      setSortDir('asc')
      return colKey
    })
  }

  useEffect(() => {
    if (activeTab === 'list') {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [activeTab])

  useEffect(() => {
    if (columnPickerOpen && columnPickerButtonRef.current) {
      const rect = columnPickerButtonRef.current.getBoundingClientRect()
      setColumnPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    } else {
      setColumnPickerPosition(null)
    }
  }, [columnPickerOpen])

  useEffect(() => {
    if (filterDropdownKey && filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect()
      setFilterDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    } else {
      setFilterDropdownPosition(null)
    }
  }, [filterDropdownKey])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const inPicker =
        columnPickerRef.current?.contains(target) ||
        columnPickerDropdownRef.current?.contains(target)
      if (!inPicker) setColumnPickerOpen(false)
      const inFilterDropdown = filterDropdownRef.current?.contains(target)
      const inFilterButton = filterButtonRef.current?.contains(target)
      if (!inFilterDropdown && !inFilterButton) setFilterDropdownKey(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResizeStart = (colKey: string, currentWidth: number, clientX: number) => {
    resizeRef.current = { key: colKey, startX: clientX, startW: currentWidth }
    setResizingColumnKey(colKey)
  }

  useEffect(() => {
    if (!resizingColumnKey) return
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      const delta = e.clientX - r.startX
      const next = Math.max(MIN_COLUMN_WIDTH, r.startW + delta)
      setColumnWidths((prev) => {
        const nextMap = { ...prev, [r.key]: next }
        saveColumnWidths(nextMap)
        return nextMap
      })
    }
    const onUp = () => {
      resizeRef.current = null
      setResizingColumnKey(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return onUp
  }, [resizingColumnKey])

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
      saveVisibleColumnKeys(next)
      return next
    })
  }

  const reorderColumns = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    setVisibleColumnKeys((prev) => {
      const fromIdx = prev.indexOf(fromKey)
      const toIdx = prev.indexOf(toKey)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, removed)
      saveVisibleColumnKeys(next)
      return next
    })
  }

  const toggleFilterValue = (colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const arr = prev[colKey] ?? []
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value]
      return { ...prev, [colKey]: next }
    })
  }

  const clearColumnFilter = (colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[colKey]
      return next
    })
    setFilterDropdownKey(null)
  }


  const visibleColumns = useMemo(
    () =>
      visibleColumnKeys
        .map((key) => ORDER_TABLE_COLUMNS.find((c) => c.key === key))
        .filter((c): c is { key: string; label: string } => !!c),
    [visibleColumnKeys]
  )

  return (
    <div className="orders-page orders-page--fixed">
      {activeTab === 'list' && (
        <div className="orders-list-content">
          <Card className="filters-card">
            <div className="filters-row">
              <div className="filter-group">
                <label>Pretraga</label>
                <input
                  type="text"
                  placeholder="Nalog UID, partner, broj..."
                  value={filters.search}
                  onChange={(e) =>
                    updateFilters({ ...filters, search: e.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    updateFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">Svi statusi</option>
                  {statusi.map((s: StatusNaloga) => (
                    <option key={s.id} value={s.id}>
                      {s.naziv}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Vrsta isporuke</label>
                <select
                  value={filters.vrstaIsporuke}
                  onChange={(e) =>
                    updateFilters({ ...filters, vrstaIsporuke: e.target.value })
                  }
                >
                  <option value="">Sve vrste</option>
                  <option value="B2BD">B2B dostava</option>
                  <option value="B2BD-SLO">B2B dostava Slovenija</option>
                  <option value="VDK">Vlastita dostava HR</option>
                  <option value="VDK-SLO">Vlastita dostava SLO</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Datum od</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    updateFilters({ ...filters, dateFrom: e.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label>Datum do</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    updateFilters({ ...filters, dateTo: e.target.value })
                  }
                />
              </div>
              <div className="filter-group column-picker-wrap" ref={columnPickerRef}>
                <span ref={columnPickerButtonRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setColumnPickerOpen((o) => !o)}
                  >
                    Kolone
                  </Button>
                </span>
                {columnPickerOpen &&
                  columnPickerPosition &&
                  createPortal(
                    <div
                      ref={columnPickerDropdownRef}
                      className="column-picker-dropdown column-picker-dropdown-portal"
                      style={{
                        position: 'fixed',
                        top: columnPickerPosition.top,
                        left: columnPickerPosition.left,
                        zIndex: 9999,
                      }}
                    >
                      <div className="column-picker-header">Prikaži kolone</div>
                      {ORDER_TABLE_COLUMNS.map(({ key, label }) => (
                        <label key={key} className="column-picker-item">
                          <input
                            type="checkbox"
                            checked={visibleColumnKeys.includes(key)}
                            onChange={() => toggleColumn(key)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>,
                    document.body
                  )}
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  updateFilters({
                    status: '',
                    dateFrom: '',
                    dateTo: '',
                    rasporedFrom: '',
                    rasporedTo: '',
                    vrstaIsporuke: '',
                    search: '',
                  })
                }
              >
                Ponisti
              </Button>
            </div>
          </Card>

          {/* Kartice sa sumama označenih naloga */}
          {checkedTotals.count > 0 && (
            <div className="selected-totals-row">
              <div className="selected-totals-card">
                <div className="totals-card-icon">📦</div>
                <div className="totals-card-content">
                  <span className="totals-card-value">{checkedTotals.count}</span>
                  <span className="totals-card-label">Označenih naloga</span>
                </div>
              </div>
              <div className="selected-totals-card">
                <div className="totals-card-icon">⚖️</div>
                <div className="totals-card-content">
                  <span className="totals-card-value">
                    {checkedTotals.totalWeight.toLocaleString('hr-HR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} kg
                  </span>
                  <span className="totals-card-label">Ukupna težina</span>
                </div>
              </div>
              <div className="selected-totals-card">
                <div className="totals-card-icon">📐</div>
                <div className="totals-card-content">
                  <span className="totals-card-value">
                    {(checkedTotals.totalVolume / 1_000_000).toLocaleString('hr-HR', {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })} m³
                  </span>
                  <span className="totals-card-label">Ukupni volumen</span>
                </div>
              </div>
              <div className="selected-totals-card totals-card-highlight">
                <div className="totals-card-icon">🚛</div>
                <div className="totals-card-content">
                  <span className="totals-card-value">{checkedTotals.paletaCount}</span>
                  <span className="totals-card-label">
                    Paleta (procjena) <span className="totals-card-detail">(V: {checkedTotals.paletaByVolume.toFixed(1)} / T: {checkedTotals.paletaByWeight.toFixed(1)})</span>
                  </span>
                </div>
              </div>
              {wmsCheckedTotals.hasData && (
                <div className={`selected-totals-card ${
                  wmsCheckedTotals.allComplete ? 'totals-card-wms-green' : 'totals-card-wms-yellow'
                }`}>
                  <div className="totals-card-icon">📋</div>
                  <div className="totals-card-content">
                    <span className="totals-card-value">{wmsCheckedTotals.totalPallets}</span>
                    <span className="totals-card-label">
                      WMS Palete
                      {wmsCheckedTotals.partialCount > 0 && ` (${wmsCheckedTotals.partialCount} djelom.)`}
                      {wmsCheckedTotals.noneCount > 0 && ` (${wmsCheckedTotals.noneCount} bez)`}
                    </span>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="totals-create-route-btn"
                disabled={prebaciLoading}
                onClick={async () => {
                  const checkedUids = sortedOrders
                    .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
                    .map((o) => o.nalog_prodaje_uid)
                  if (checkedUids.length === 0) return
                  setPrebaciLoading(true)
                  try {
                    const result = await routingOrdersApi.prebaciURutiranje(checkedUids)
                    toast.success(`Prebačeno ${result.prebaceno} naloga u rutiranje.`)
                    // Osvježi liste
                    queryClient.invalidateQueries({ queryKey: ['orders'] })
                    queryClient.invalidateQueries({ queryKey: ['rutiranje-uids'] })
                    setCheckedOrderUids(new Set())
                    navigate('/routing')
                  } catch (err) {
                    toast.error(`Greška: ${(err as Error).message}`)
                  } finally {
                    setPrebaciLoading(false)
                  }
                }}
                title="Prebaci označene naloge u rutiranje i otvori stranicu za kreiranje rute"
              >
                {prebaciLoading ? '⏳ ' : '🗺️ '}Kreiraj rutu ({checkedTotals.count})
              </button>
              <button
                type="button"
                className="totals-clear-btn"
                onClick={clearChecked}
                title="Poništi odabir"
              >
                ✕ Poništi odabir
              </button>
              <button
                type="button"
                className="totals-delete-btn"
                onClick={async () => {
                  const checkedUids = sortedOrders
                    .filter((o) => checkedOrderUids.has(o.nalog_prodaje_uid))
                    .map((o) => o.nalog_prodaje_uid)
                  if (checkedUids.length === 0) return
                  if (!confirm(`Obrisati ${checkedUids.length} naloga i blokirati ponovni import?\n\nNaloge ćete moći ručno reimportirati kasnije.`)) return
                  try {
                    const result = await ordersApi.deleteAndBlacklist(checkedUids)
                    toast.success(`Obrisano ${result.obrisano} naloga. Blokirani za automatski import.`)
                    queryClient.invalidateQueries({ queryKey: ['orders'] })
                    setCheckedOrderUids(new Set())
                  } catch (err) {
                    toast.error(`Greška: ${(err as Error).message}`)
                  }
                }}
                title="Obriši označene naloge i blokiraj ponovni automatski import"
              >
                🗑️ Obriši ({checkedTotals.count})
              </button>
            </div>
          )}

          <div
            ref={layoutRef}
            className={`orders-layout ${selectedOrderUid ? '' : 'no-detail'}`}
            style={selectedOrderUid ? { gridTemplateColumns: `minmax(0, 1fr) 8px ${detailWidth}px` } as React.CSSProperties : undefined}
          >
            <Card className="orders-table-card">
              {isLoading ? (
                <div className="loading-state">Ucitavanje...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="empty-state">
                  <p>Nema naloga za prikaz.</p>
                  <p>
                    Koristite tab „Sinkronizacija s ERP-om” za ručni uvoz
                    naloga.
                  </p>
                </div>
              ) : (
                <div className="orders-table-scroll">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th className="th-checkbox">
                          <input
                            type="checkbox"
                            checked={sortedOrders.length > 0 && checkedOrderUids.size === sortedOrders.length}
                            onChange={toggleAllChecked}
                            title="Označi sve / Poništi sve"
                          />
                        </th>
                        {visibleColumns.map(({ key, label }) => {
                          const colWidth = columnWidths[key] ?? DEFAULT_COLUMN_WIDTH
                          const hasActiveFilter = (columnFilters[key]?.length ?? 0) > 0
                          return (
                          <th
                            key={key}
                            className={`th-with-filter ${draggedColumnKey === key ? 'th-dragging' : ''} ${hasActiveFilter ? 'th-filter-active' : ''}`}
                            style={{ width: colWidth, minWidth: colWidth }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (draggedColumnKey && draggedColumnKey !== key) {
                                e.dataTransfer.dropEffect = 'move'
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromKey = e.dataTransfer.getData('text/plain')
                              if (fromKey && fromKey !== key) reorderColumns(fromKey, key)
                              setDraggedColumnKey(null)
                            }}
                          >
                            <div className="th-inner">
                              <span
                                className="th-drag-handle"
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', key)
                                  e.dataTransfer.effectAllowed = 'move'
                                  setDraggedColumnKey(key)
                                }}
                                onDragEnd={() => setDraggedColumnKey(null)}
                                title="Povuci za promjenu redoslijeda kolona"
                                aria-label="Promijeni redoslijed kolone"
                              >
                                ⋮⋮
                              </span>
                              <div className="th-content">
                              <button
                                type="button"
                                className="th-sort-label"
                                onClick={() => handleSort(key)}
                                title="Sortiraj po koloni"
                              >
                                <span>{label}</span>
                                {sortBy === key && (
                                  <span className="th-sort-icon" aria-hidden>
                                    {sortDir === 'asc' ? ' ↑' : ' ↓'}
                                  </span>
                                )}
                              </button>
                              <div
                                className="th-filter-wrap"
                                ref={
                                  filterDropdownKey === key
                                    ? filterButtonRef
                                    : undefined
                                }
                              >
                                <button
                                  type="button"
                                  className={`th-filter-btn ${(columnFilters[key]?.length ?? 0) > 0 ? 'active' : ''}`}
                                  onClick={() =>
                                    setFilterDropdownKey((prev) =>
                                      prev === key ? null : key
                                    )
                                  }
                                  title="Filter"
                                >
                                  ⋮
                                </button>
                              </div>
                            </div>
                            </div>
                            <div
                              className="th-resize-handle"
                              role="separator"
                              aria-label="Promijeni širinu kolone"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleResizeStart(key, colWidth, e.clientX)
                              }}
                            />
                          </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((order: NalogHeader) => {
                        const isChecked = checkedOrderUids.has(order.nalog_prodaje_uid)
                        const hasCriteria = criteriaOrderUids.has(order.nalog_prodaje_uid)
                        return (
                        <tr
                          key={order.nalog_prodaje_uid}
                          className={`${selectedOrderUid === order.nalog_prodaje_uid ? 'selected' : ''} ${isChecked ? 'checked' : ''} ${hasCriteria ? 'order-row-warning' : ''}`}
                          onClick={() =>
                            setSelectedOrderUid(order.nalog_prodaje_uid)
                          }
                        >
                          <td className="td-checkbox" onClick={(e) => toggleOrderCheck(order.nalog_prodaje_uid, e)}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                            />
                          </td>
                          {visibleColumns.map(({ key }) => {
                            const colWidth = columnWidths[key] ?? DEFAULT_COLUMN_WIDTH
                            const rawValue = getOrderCellValue(order, key)
                            let content: React.ReactNode = null
                            if (key === 'wms_status') {
                              const wmsInfo = wmsBulkMap?.[order.nalog_prodaje_uid]
                              if (wmsInfo && wmsInfo.has_data) {
                                const dotClass = wmsInfo.is_complete ? 'green' : wmsInfo.total_paleta > 0 ? 'yellow' : 'red'
                                content = (
                                  <span title={`${wmsInfo.total_paleta} paleta${wmsInfo.is_complete ? ' (složeno)' : ' (u procesu)'}`}>
                                    <span className={`wms-status-dot ${dotClass}`} />
                                    {wmsInfo.total_paleta > 0 ? wmsInfo.total_paleta : ''}
                                  </span>
                                )
                              } else {
                                content = <span className="wms-status-dot gray" title="Nema WMS podataka" />
                              }
                            } else if (key === VIRTUAL_COLUMN_PARTNER_KUPAC) {
                              const display = String(rawValue ?? '').trim()
                              if (!display) {
                                content = '—'
                              } else {
                                const [before, after] = display.split('=>')
                                if (after) {
                                  content = (
                                    <>
                                      {before.trim()} {'=>'}{' '}
                                      <span className="kupac-strong">
                                        {after.trim()}
                                      </span>
                                    </>
                                  )
                                } else {
                                  content = display
                                }
                              }
                            } else {
                              content = cellDisplay(key, rawValue, order, statusiMap)
                            }
                            return (
                              <td
                                key={key}
                                className={
                                  key === 'za_naplatu' ? 'text-right' : ''
                                }
                                style={{ width: colWidth, minWidth: colWidth }}
                              >
                                {content}
                              </td>
                            )
                          })}
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div className="orders-pagination">
                <span className="pagination-info">
                  Stranica {safePage + 1} / {totalPages} &middot; Prikazano {paginatedOrders.length} od {sortedOrders.length} naloga
                </span>
                <div className="pagination-buttons">
                  <button
                    className="pagination-btn"
                    disabled={safePage === 0}
                    onClick={() => setCurrentPage(0)}
                    title="Prva stranica"
                  >
                    ⟨⟨
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={safePage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    ← Prethodna
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Sljedeća →
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setCurrentPage(totalPages - 1)}
                    title="Zadnja stranica"
                  >
                    ⟩⟩
                  </button>
                </div>
              </div>

              {filterDropdownKey &&
                filterDropdownPosition &&
                createPortal(
                  <div
                    ref={filterDropdownRef}
                    className="th-filter-dropdown th-filter-dropdown-portal"
                    style={{
                      position: 'fixed',
                      top: filterDropdownPosition.top,
                      left: filterDropdownPosition.left,
                      zIndex: 9999,
                    }}
                  >
                    <button
                      type="button"
                      className="filter-item filter-all"
                      onClick={() => clearColumnFilter(filterDropdownKey)}
                    >
                      (Sve)
                    </button>
                    {Array.from(
                      distinctByColumn[filterDropdownKey] || []
                    )
                      .sort((a, b) =>
                        a === ''
                          ? -1
                          : b === ''
                            ? 1
                            : a.localeCompare(b, 'hr')
                      )
                      .slice(0, 200)
                      .map((val) => (
                        <label
                          key={val || '(prazno)'}
                          className="filter-item"
                        >
                          <input
                            type="checkbox"
                            checked={(
                              columnFilters[filterDropdownKey] ?? []
                            ).includes(val)}
                            onChange={() =>
                              toggleFilterValue(filterDropdownKey, val)
                            }
                          />
                          <span>{val || '(prazno)'}</span>
                        </label>
                      ))}
                    {(distinctByColumn[filterDropdownKey]?.size ?? 0) > 200 && (
                      <div className="filter-more">
                        + još{' '}
                        {(distinctByColumn[filterDropdownKey]?.size ?? 0) -
                          200}{' '}
                        vrijednosti
                      </div>
                    )}
                  </div>,
                  document.body
                )}
            </Card>

            {selectedOrder && (
              <>
              {/* Resize handle */}
              <div
                className="detail-resize-handle"
                onMouseDown={handleDetailResizeDown}
              >
                <div className="detail-resize-dots"><span /><span /><span /></div>
              </div>
              <Card
                className="order-detail-card"
                title="Detalji naloga"
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedOrderUid(null)}
                  >
                    Zatvori
                  </Button>
                }
              >
                <div className="order-detail-body">
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <span className="detail-label">Kupac</span>
                    <span className="detail-value">
                      {(() => {
                        const imePrezime = [selectedOrder.partner_ime, selectedOrder.partner_prezime]
                          .filter(Boolean)
                          .join(' ')
                          .trim()
                        const naziv = (selectedOrder.partner_naziv ?? '').trim()
                        if (!naziv && !imePrezime) return '—'
                        if (!naziv) return imePrezime
                        if (!imePrezime) return naziv
                        return `${naziv} => ${imePrezime}`
                      })()}
                    </span>
                  </div>

                  {/* Adresa, Poštanski broj, Mjesto - editable */}
                  <div className="detail-item full-width">
                    <span className="detail-label">
                      Adresa
                      {editingField !== 'adresa' && (
                        <button className="edit-inline-btn" onClick={() => startEdit('adresa', selectedOrder.partner_adresa)} title="Uredi adresu">&#9998;</button>
                      )}
                    </span>
                    {editingField === 'adresa' ? (
                      <div className="edit-inline-row">
                        <input
                          type="text"
                          className="edit-inline-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('adresa'); if (e.key === 'Escape') cancelEdit() }}
                        />
                        <button className="edit-inline-save" onClick={() => saveEdit('adresa')} disabled={updatePartnerMutation.isPending}>&#10003;</button>
                        <button className="edit-inline-cancel" onClick={cancelEdit}>&#10005;</button>
                      </div>
                    ) : (
                      <span className="detail-value">{selectedOrder.partner_adresa ?? '—'}</span>
                    )}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">
                      Poštanski broj
                      {editingField !== 'postanski_broj' && (
                        <button className="edit-inline-btn" onClick={() => startEdit('postanski_broj', selectedOrder.partner_postanski_broj)} title="Uredi poštanski broj">&#9998;</button>
                      )}
                    </span>
                    {editingField === 'postanski_broj' ? (
                      <div className="edit-inline-row">
                        <input
                          type="text"
                          className="edit-inline-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('postanski_broj'); if (e.key === 'Escape') cancelEdit() }}
                        />
                        <button className="edit-inline-save" onClick={() => saveEdit('postanski_broj')} disabled={updatePartnerMutation.isPending}>&#10003;</button>
                        <button className="edit-inline-cancel" onClick={cancelEdit}>&#10005;</button>
                      </div>
                    ) : (
                      <span className="detail-value">{selectedOrder.partner_postanski_broj ?? '—'}</span>
                    )}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">
                      Mjesto
                      {editingField !== 'naziv_mjesta' && (
                        <button className="edit-inline-btn" onClick={() => startEdit('naziv_mjesta', selectedOrder.partner_naziv_mjesta)} title="Uredi mjesto">&#9998;</button>
                      )}
                    </span>
                    {editingField === 'naziv_mjesta' ? (
                      <div className="edit-inline-row">
                        <input
                          type="text"
                          className="edit-inline-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('naziv_mjesta'); if (e.key === 'Escape') cancelEdit() }}
                        />
                        <button className="edit-inline-save" onClick={() => saveEdit('naziv_mjesta')} disabled={updatePartnerMutation.isPending}>&#10003;</button>
                        <button className="edit-inline-cancel" onClick={cancelEdit}>&#10005;</button>
                      </div>
                    ) : (
                      <span className="detail-value">{selectedOrder.partner_naziv_mjesta ?? '—'}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Broj</span>
                    <span className="detail-value">
                      {selectedOrder.broj ?? '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Datum</span>
                    <span className="detail-value">
                      {selectedOrder.datum ?? '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Raspored (isporuka)</span>
                    <span className="detail-value">
                      {selectedOrder.raspored ?? '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Skladište</span>
                    <span className="detail-value">
                      {selectedOrder.skladiste ?? '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span
                      className={`status-badge status-${selectedOrder.status}`}
                    >
                      {getStatusLabel(selectedOrder.status, statusiMap)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Kreirao</span>
                    <span className="detail-value">
                      {selectedOrder.kreirao__radnik_ime ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Poruke i napomene */}
                <div className="detail-section">
                  <h4>Napomene</h4>
                  <div className="detail-notes-grid">
                    <div className="detail-note-item">
                      <span className="detail-label">Poruka gore</span>
                      <span className="detail-value">
                        {selectedOrder.poruka_gore ?? '—'}
                      </span>
                    </div>
                    <div className="detail-note-item">
                      <span className="detail-label">Poruka dolje</span>
                      <span className="detail-value">
                        {selectedOrder.poruka_dolje ?? '—'}
                      </span>
                    </div>
                    <div className="detail-note-item">
                      <span className="detail-label">Napomena</span>
                      <span className="detail-value">
                        {selectedOrder.napomena ?? '—'}
                      </span>
                    </div>
                    <div className="detail-note-item">
                      <span className="detail-label">Na uvid</span>
                      <span className="detail-value">
                        {selectedOrder.na_uvid ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedOrder.details && selectedOrder.details.length > 0 && (
                  <div className="detail-section">
                    <h4>Stavke ({selectedOrder.details.length})</h4>
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>Artikl</th>
                          <th>Naziv</th>
                          <th>Količina</th>
                          <th>JM</th>
                          <th>Masa (kg)</th>
                          <th>Volumen (m³)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.details.map((item, idx) => (
                          <tr key={idx} className={item.artikl && criteriaArtiklSet.has(item.artikl) ? 'item-row-warning' : ''}>
                            <td>{item.artikl ?? '—'}</td>
                            <td>{item.artikl_naziv_kratki ?? '—'}</td>
                            <td>{item.kolicina ?? '—'}</td>
                            <td>{item.artikl_jm ?? '—'}</td>
                            <td>
                              {item.artikl_masa != null
                                ? item.artikl_masa.toFixed(2)
                                : '—'}
                            </td>
                            <td>
                              {item.artikl_volumen != null
                                ? (item.artikl_volumen / 1_000_000).toFixed(4)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mantis WMS SSCC sekcija */}
                <div className="detail-section mantis-section">
                  <div className="mantis-header">
                    <h4>
                      Mantis WMS
                      {mantisData && mantisData.has_data && (
                        <span className={`mantis-pallet-badge ${mantisData.is_complete ? 'complete' : 'partial'}`}>
                          {mantisData.total_paleta} {mantisData.total_paleta === 1 ? 'paleta' : 'paleta'}
                        </span>
                      )}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchMantis()}
                      disabled={mantisFetching}
                    >
                      {mantisFetching ? 'Osvježavam...' : 'Osvježi'}
                    </Button>
                  </div>
                  {mantisData && mantisData.has_data ? (
                    <>
                      <table className="items-table mantis-table">
                        <thead>
                          <tr>
                            <th>Proizvod</th>
                            <th>Količina</th>
                            <th>Status</th>
                            <th>SSCC</th>
                            <th>Lokacija</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mantisData.items.map((item, idx) => {
                            // Grupiraj boje po SSCC kodu
                            const ssccIdx = item.sscc
                              ? [...new Set(mantisData.items.filter(i => i.sscc).map(i => i.sscc))].indexOf(item.sscc)
                              : -1
                            const rowClass = item.sscc
                              ? (ssccIdx % 2 === 0 ? 'mantis-sscc-even' : 'mantis-sscc-odd')
                              : 'mantis-no-sscc'
                            return (
                              <tr key={item.id || idx} className={rowClass}>
                                <td className="mantis-product">{item.product ?? '—'}</td>
                                <td>{item.quantity ?? '—'}</td>
                                <td>{item.item_status ?? '—'}</td>
                                <td className={item.sscc ? 'mantis-sscc-code' : 'mantis-not-packed'}>
                                  {item.sscc ?? 'Nije složeno'}
                                </td>
                                <td>{item.location ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {mantisData.synced_at && (
                        <div className="mantis-sync-info">
                          Zadnji sync: {new Date(mantisData.synced_at).toLocaleString('hr-HR')}
                        </div>
                      )}
                    </>
                  ) : mantisData && !mantisData.has_data ? (
                    <div className="mantis-empty">Nema WMS podataka za ovaj nalog</div>
                  ) : mantisFetching ? (
                    <div className="mantis-empty">Učitavanje WMS podataka...</div>
                  ) : (
                    <div className="mantis-empty">WMS podaci nisu dostupni</div>
                  )}
                </div>

                </div>
              </Card>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
