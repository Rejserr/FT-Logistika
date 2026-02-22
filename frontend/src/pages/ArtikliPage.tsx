import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, toast, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { itemsApi, syncApi } from '../services/api'
import type { Artikl, KriterijaSku } from '../types'
import './ArtikliPage.css'

type TabType = 'artikli' | 'kriterija'

// ==============================================================================
// Artikli tab columns
// ==============================================================================
const ARTIKLI_COLUMNS: DataTableColumn[] = [
  { key: 'artikl', label: 'Šifra' },
  { key: 'naziv', label: 'Naziv' },
  { key: 'naziv_kratki', label: 'Kratki naziv' },
  { key: 'jm', label: 'JM' },
  { key: 'grupa_artikla', label: 'Grupa' },
  { key: 'grupa_artikla_naziv', label: 'Naziv grupe' },
  { key: 'duzina', label: 'Dužina (mm)' },
  { key: 'sirina', label: 'Širina (mm)' },
  { key: 'visina', label: 'Visina (mm)' },
  { key: 'masa', label: 'Masa (kg)' },
  { key: 'volumen_m3', label: 'Volumen (m³)' },
]

const ARTIKLI_DEFAULT_VISIBLE = ['artikl', 'naziv', 'jm', 'grupa_artikla', 'masa', 'volumen_m3']

// ==============================================================================
// Kriterija tab columns
// ==============================================================================
const KRITERIJA_COLUMNS: DataTableColumn[] = [
  { key: 'artikl', label: 'Šifra artikla' },
  { key: 'artikl_naziv', label: 'Naziv artikla' },
  { key: 'kriterija_naziv', label: 'Kriterija' },
  { key: 'akcije', label: 'Akcije' },
]

const KRITERIJA_DEFAULT_VISIBLE = ['artikl', 'artikl_naziv', 'kriterija_naziv', 'akcije']

// ==============================================================================
// Kriterije SKU columns (za upravljanje)
// ==============================================================================
const KRITERIJE_SKU_COLUMNS: DataTableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'naziv', label: 'Naziv' },
  { key: 'opis', label: 'Opis' },
  { key: 'akcije', label: 'Akcije' },
]

const KRITERIJE_SKU_DEFAULT_VISIBLE = ['id', 'naziv', 'opis', 'akcije']

export default function ArtikliPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('artikli')
  const [search, setSearch] = useState('')

  // -- Kriterija modals --
  const [showAddModal, setShowAddModal] = useState(false)
  const [addArtikl, setAddArtikl] = useState('')
  const [addKriterijaId, setAddKriterijaId] = useState<number | ''>('')

  // -- Kriterije SKU modal --
  const [showSkuModal, setShowSkuModal] = useState(false)
  const [skuEditId, setSkuEditId] = useState<number | null>(null)
  const [skuNaziv, setSkuNaziv] = useState('')
  const [skuOpis, setSkuOpis] = useState('')

  // -- Import --
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ==============================================================================
  // Queries
  // ==============================================================================
  const { data: artikli = [], isLoading: artikliLoading } = useQuery({
    queryKey: ['artikli', search],
    queryFn: () => itemsApi.listArtikli({ search: search || undefined, limit: 10000 }),
  })

  const { data: kriterije = [] } = useQuery({
    queryKey: ['kriterije-sku'],
    queryFn: () => itemsApi.listKriterije(),
  })

  const { data: artikliKriterija = [], isLoading: akLoading } = useQuery({
    queryKey: ['artikli-kriterija'],
    queryFn: () => itemsApi.listArtikliKriterija(),
  })

  // ==============================================================================
  // Mutations
  // ==============================================================================
  const syncMutation = useMutation({
    mutationFn: () => syncApi.syncArtikli(),
    onSuccess: (data) => toast.success(`Sinkronizacija artikala pokrenuta (ID: ${data.sync_id})`),
    onError: (error: Error) => toast.error(`Sinkronizacija nije uspjela: ${error.message}`),
  })

  const createAkMutation = useMutation({
    mutationFn: (data: { artikl: string; kriterija_id: number }) =>
      itemsApi.createArtiklKriterija(data),
    onSuccess: () => {
      toast.success('Artikl-kriterija dodana.')
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija'] })
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija-sifre'] })
      setShowAddModal(false)
      setAddArtikl('')
      setAddKriterijaId('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteAkMutation = useMutation({
    mutationFn: (id: number) => itemsApi.deleteArtiklKriterija(id),
    onSuccess: () => {
      toast.success('Artikl-kriterija obrisana.')
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija'] })
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija-sifre'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const createSkuMutation = useMutation({
    mutationFn: (data: { naziv: string; opis?: string }) => itemsApi.createKriterija(data),
    onSuccess: () => {
      toast.success('Kriterij kreiran.')
      queryClient.invalidateQueries({ queryKey: ['kriterije-sku'] })
      closeSkuModal()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateSkuMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { naziv?: string; opis?: string } }) =>
      itemsApi.updateKriterija(id, data),
    onSuccess: () => {
      toast.success('Kriterij ažuriran.')
      queryClient.invalidateQueries({ queryKey: ['kriterije-sku'] })
      closeSkuModal()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteSkuMutation = useMutation({
    mutationFn: (id: number) => itemsApi.deleteKriterija(id),
    onSuccess: () => {
      toast.success('Kriterij obrisan.')
      queryClient.invalidateQueries({ queryKey: ['kriterije-sku'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => itemsApi.importArtikliKriterija(file),
    onSuccess: (data) => {
      toast.success(`Import završen: ${data.imported} dodano, ${data.skipped} preskočeno.`)
      if (data.errors.length > 0) {
        toast.error(`Greške: ${data.errors.slice(0, 3).join('; ')}`)
      }
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija'] })
      queryClient.invalidateQueries({ queryKey: ['artikli-kriterija-sifre'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // ==============================================================================
  // Helpers
  // ==============================================================================
  const kriterijaMap = new Map(kriterije.map((k) => [k.id, k.naziv]))

  const akWithKriterija = artikliKriterija.map((ak) => ({
    ...ak,
    kriterija_naziv: kriterijaMap.get(ak.kriterija_id) || `#${ak.kriterija_id}`,
  }))

  const closeSkuModal = () => {
    setShowSkuModal(false)
    setSkuEditId(null)
    setSkuNaziv('')
    setSkuOpis('')
  }

  const openSkuEdit = (sku: KriterijaSku) => {
    setSkuEditId(sku.id)
    setSkuNaziv(sku.naziv)
    setSkuOpis(sku.opis || '')
    setShowSkuModal(true)
  }

  const handleSkuSubmit = () => {
    if (!skuNaziv.trim()) return
    if (skuEditId) {
      updateSkuMutation.mutate({ id: skuEditId, data: { naziv: skuNaziv, opis: skuOpis } })
    } else {
      createSkuMutation.mutate({ naziv: skuNaziv, opis: skuOpis || undefined })
    }
  }

  const handleAddAk = () => {
    if (!addArtikl.trim() || !addKriterijaId) return
    createAkMutation.mutate({ artikl: addArtikl.trim(), kriterija_id: Number(addKriterijaId) })
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        importMutation.mutate(file)
        e.target.value = ''
      }
    },
    [importMutation],
  )

  // ==============================================================================
  // Render
  // ==============================================================================
  return (
    <div className="artikli-page">
      {/* Tab navigation */}
      <div className="artikli-tabs">
        <button
          className={`artikli-tab ${activeTab === 'artikli' ? 'active' : ''}`}
          onClick={() => setActiveTab('artikli')}
        >
          Artikli ({artikli.length})
        </button>
        <button
          className={`artikli-tab ${activeTab === 'kriterija' ? 'active' : ''}`}
          onClick={() => setActiveTab('kriterija')}
        >
          Kriterija artikala ({artikliKriterija.length})
        </button>
      </div>

      {/* ========== TAB: Artikli ========== */}
      {activeTab === 'artikli' && (
        <div className="artikli-tab-content">
          <Card className="artikli-filters-card">
            <div className="artikli-filters-row">
              <div className="filter-group">
                <label>Pretraga</label>
                <input
                  type="text"
                  placeholder="Šifra ili naziv artikla..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filters-spacer" />
              <div className="sync-actions">
                <Button
                  onClick={() => syncMutation.mutate()}
                  isLoading={syncMutation.isPending}
                >
                  Sinkroniziraj artikle iz ERP-a
                </Button>
              </div>
            </div>
          </Card>

          <Card className="artikli-table-card">
            <DataTable<Artikl>
              storageKey="ft-artikli"
              columns={ARTIKLI_COLUMNS}
              defaultVisibleKeys={ARTIKLI_DEFAULT_VISIBLE}
              data={artikli}
              rowKey={(a) => a.artikl_uid}
              isLoading={artikliLoading}
              emptyMessage="Nema artikala za prikaz."
              pageSizes={[500, 1000, 0]}
              defaultPageSize={500}
              cellValue={(a, key) => {
                if (key === 'volumen_m3') {
                  return a.volumen != null ? (a.volumen / 1_000_000).toFixed(6) : ''
                }
                return (a as unknown as Record<string, unknown>)[key]
              }}
              cellRenderer={(a, key) => {
                if (key === 'volumen_m3') {
                  return a.volumen != null ? (a.volumen / 1_000_000).toFixed(6) : '—'
                }
                const val = (a as unknown as Record<string, unknown>)[key]
                return val != null ? String(val) : '—'
              }}
            />
          </Card>
        </div>
      )}

      {/* ========== TAB: Kriterija artikala ========== */}
      {activeTab === 'kriterija' && (
        <div className="artikli-kriterija-content">
          {/* Toolbar */}
          <Card className="artikli-filters-card">
            <div className="artikli-filters-row">
              <Button onClick={() => setShowAddModal(true)}>+ Dodaj kriterij artikla</Button>
              <Button onClick={handleImportClick} isLoading={importMutation.isPending}>
                Uvezi iz XLSX
              </Button>
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || '/api'}/artikli-kriterija/example-xlsx`}
                download
                className="btn-example-xlsx"
              >
                Preuzmi primjer XLSX
              </a>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="filters-spacer" />
              <Button
                variant="secondary"
                onClick={() => {
                  setSkuEditId(null)
                  setSkuNaziv('')
                  setSkuOpis('')
                  setShowSkuModal(true)
                }}
              >
                Upravljaj kriterijima
              </Button>
            </div>
          </Card>

          {/* Scrollabilna sekcija s obje tablice */}
          <div className="artikli-kriterija-scroll">
            {/* Artikli-kriterija tablica */}
            <Card className="artikli-kriterija-table-card">
              <DataTable<(typeof akWithKriterija)[number]>
                storageKey="ft-artikli-kriterija"
                columns={KRITERIJA_COLUMNS}
                defaultVisibleKeys={KRITERIJA_DEFAULT_VISIBLE}
                data={akWithKriterija}
                rowKey={(ak) => ak.id}
                isLoading={akLoading}
                emptyMessage="Nema artikala s dodijeljenim kriterijima."
                cellRenderer={(ak, key) => {
                  if (key === 'akcije') {
                    return (
                      <button
                        className="btn-delete-small"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Obrisati ovu vezu?')) deleteAkMutation.mutate(ak.id)
                        }}
                        title="Obriši"
                      >
                        ✕
                      </button>
                    )
                  }
                  const val = (ak as unknown as Record<string, unknown>)[key]
                  return val != null ? String(val) : '—'
                }}
              />
            </Card>

            {/* Kriterije SKU tablica */}
            <Card className="artikli-kriterija-table-card" style={{ marginTop: 20 }}>
              <div className="kriterije-sku-header">
                <h3>Tipovi kriterija</h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setSkuEditId(null)
                    setSkuNaziv('')
                    setSkuOpis('')
                    setShowSkuModal(true)
                  }}
                >
                  + Novi kriterij
                </Button>
              </div>
              <DataTable<KriterijaSku>
                storageKey="ft-kriterije-sku"
                columns={KRITERIJE_SKU_COLUMNS}
                defaultVisibleKeys={KRITERIJE_SKU_DEFAULT_VISIBLE}
                data={kriterije}
                rowKey={(k) => k.id}
                isLoading={false}
                emptyMessage="Nema kriterija."
                cellRenderer={(k, key) => {
                  if (key === 'akcije') {
                    return (
                      <div className="ak-actions">
                        <button
                          className="btn-edit-small"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSkuEdit(k)
                          }}
                          title="Uredi"
                        >
                          ✎
                        </button>
                        <button
                          className="btn-delete-small"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Obrisati kriterij?')) deleteSkuMutation.mutate(k.id)
                          }}
                          title="Obriši"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  }
                  const val = (k as unknown as Record<string, unknown>)[key]
                  return val != null ? String(val) : '—'
                }}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ========== MODAL: Dodaj artikl-kriterija ========== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dodaj artikl-kriterija vezu</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Šifra artikla</label>
                <input
                  type="text"
                  value={addArtikl}
                  onChange={(e) => setAddArtikl(e.target.value)}
                  placeholder="Unesite šifru artikla..."
                />
              </div>
              <div className="form-group">
                <label>Kriterija</label>
                <select
                  value={addKriterijaId}
                  onChange={(e) =>
                    setAddKriterijaId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">-- Odaberite kriterij --</option>
                  {kriterije.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.naziv}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Odustani
              </Button>
              <Button
                onClick={handleAddAk}
                isLoading={createAkMutation.isPending}
                disabled={!addArtikl.trim() || !addKriterijaId}
              >
                Spremi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Kriterij SKU ========== */}
      {showSkuModal && (
        <div className="modal-overlay" onClick={closeSkuModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{skuEditId ? 'Uredi kriterij' : 'Novi kriterij'}</h2>
              <button className="modal-close" onClick={closeSkuModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Naziv</label>
                <input
                  type="text"
                  value={skuNaziv}
                  onChange={(e) => setSkuNaziv(e.target.value)}
                  placeholder="Naziv kriterija..."
                />
              </div>
              <div className="form-group">
                <label>Opis</label>
                <textarea
                  value={skuOpis}
                  onChange={(e) => setSkuOpis(e.target.value)}
                  placeholder="Opis kriterija..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={closeSkuModal}>
                Odustani
              </Button>
              <Button
                onClick={handleSkuSubmit}
                isLoading={createSkuMutation.isPending || updateSkuMutation.isPending}
                disabled={!skuNaziv.trim()}
              >
                Spremi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
