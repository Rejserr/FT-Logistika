import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Header } from '../components/layout'
import { Card, Button, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { vehiclesApi, driversApi, regionsApi } from '../services/api'
import type { Vozilo, Vozac, VoziloTip, Regija } from '../types'
import './VehiclesPage.css'

type TabType = 'vehicles' | 'drivers' | 'vehicleTypes'

interface VehicleFormData {
  oznaka: string
  tip_id: number | null
  warehouse_id: number | null
  nosivost_kg: number | null
  volumen_m3: number | null
  profil_rutiranja: string
  paleta: number | null
  aktivan: boolean
}

interface VehicleTypeFormData {
  naziv: string
  opis: string
  aktivan: boolean
}

interface DriverFormData {
  ime: string
  prezime: string
  telefon: string
  warehouse_id: number | null
  vozilo_id: number | null
  aktivan: boolean
}

export default function VehiclesPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'Admin'
  const [activeTab, setActiveTab] = useState<TabType>('vehicles')
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vozilo | null>(null)
  const [editingDriver, setEditingDriver] = useState<Vozac | null>(null)
  const [editingType, setEditingType] = useState<VoziloTip | null>(null)
  
  const [vehicleForm, setVehicleForm] = useState<VehicleFormData>({
    oznaka: '',
    tip_id: null,
    warehouse_id: currentUser?.warehouse_id ?? null,
    nosivost_kg: null,
    volumen_m3: null,
    profil_rutiranja: '',
    paleta: null,
    aktivan: true,
  })

  const [typeForm, setTypeForm] = useState<VehicleTypeFormData>({
    naziv: '',
    opis: '',
    aktivan: true,
  })
  
  const [driverForm, setDriverForm] = useState<DriverFormData>({
    ime: '',
    prezime: '',
    telefon: '',
    warehouse_id: currentUser?.warehouse_id ?? null,
    vozilo_id: null,
    aktivan: true,
  })

  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false)
  const regionDropdownRef = useRef<HTMLDivElement>(null)

  // Zatvaranje dropdowna klikom van
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setRegionDropdownOpen(false)
      }
    }
    if (regionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [regionDropdownOpen])

  // Queries
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehiclesApi.list,
  })

  const { data: vehicleTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: vehiclesApi.listTypes,
  })

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: regionsApi.list,
  })

  interface WarehouseItem { id: number; code: string | null; naziv: string }
  const { data: warehouses = [] } = useQuery<WarehouseItem[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const resp = await fetch('/api/v1/warehouses', { credentials: 'include' })
      if (!resp.ok) throw new Error('Greška pri dohvatu skladišta')
      return resp.json()
    },
  })

  const getWarehouseName = (whId: number | null | undefined) => {
    if (!whId) return '—'
    const wh = warehouses.find(w => w.id === whId)
    return wh ? `${wh.code || ''} - ${wh.naziv}`.trim() : `ID: ${whId}`
  }

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.list,
  })

  // Vehicle mutations
  const createVehicleMutation = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      closeVehicleModal()
    },
  })

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vozilo> }) =>
      vehiclesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      closeVehicleModal()
    },
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: vehiclesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })

  // Driver mutations
  const createDriverMutation = useMutation({
    mutationFn: driversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      closeDriverModal()
    },
  })

  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vozac> }) =>
      driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      closeDriverModal()
    },
  })

  const deleteDriverMutation = useMutation({
    mutationFn: driversApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })

  // Vehicle type mutations
  const createTypeMutation = useMutation({
    mutationFn: vehiclesApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] })
      closeTypeModal()
    },
  })

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VoziloTip> }) =>
      vehiclesApi.updateType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] })
      closeTypeModal()
    },
  })

  const deleteTypeMutation = useMutation({
    mutationFn: vehiclesApi.deleteType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] })
    },
  })

  const openVehicleModal = (vehicle?: Vozilo) => {
    if (vehicle) {
      setEditingVehicle(vehicle)
      setVehicleForm({
        oznaka: vehicle.oznaka || '',
        tip_id: vehicle.tip_id,
        warehouse_id: vehicle.warehouse_id ?? null,
        nosivost_kg: vehicle.nosivost_kg,
        volumen_m3: vehicle.volumen_m3,
        profil_rutiranja: vehicle.profil_rutiranja || '',
        paleta: vehicle.paleta,
        aktivan: vehicle.aktivan ?? true,
      })
    } else {
      setEditingVehicle(null)
      setVehicleForm({
        oznaka: '',
        tip_id: null,
        warehouse_id: currentUser?.warehouse_id ?? null,
        nosivost_kg: null,
        volumen_m3: null,
        profil_rutiranja: '',
        paleta: null,
        aktivan: true,
      })
    }
    setShowVehicleModal(true)
  }

  const closeVehicleModal = () => {
    setShowVehicleModal(false)
    setEditingVehicle(null)
  }

  const openDriverModal = (driver?: Vozac) => {
    if (driver) {
      setEditingDriver(driver)
      setDriverForm({
        ime: driver.ime,
        prezime: driver.prezime,
        telefon: driver.telefon || '',
        warehouse_id: driver.warehouse_id ?? null,
        vozilo_id: driver.vozilo_id,
        aktivan: driver.aktivan ?? true,
      })
    } else {
      setEditingDriver(null)
      setDriverForm({
        ime: '',
        prezime: '',
        telefon: '',
        warehouse_id: currentUser?.warehouse_id ?? null,
        vozilo_id: null,
        aktivan: true,
      })
    }
    setShowDriverModal(true)
  }

  const closeDriverModal = () => {
    setShowDriverModal(false)
    setEditingDriver(null)
  }

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data: vehicleForm })
    } else {
      createVehicleMutation.mutate(vehicleForm)
    }
  }

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingDriver) {
      updateDriverMutation.mutate({ id: editingDriver.id, data: driverForm })
    } else {
      createDriverMutation.mutate(driverForm)
    }
  }

  const openTypeModal = (type?: VoziloTip) => {
    if (type) {
      setEditingType(type)
      setTypeForm({
        naziv: type.naziv,
        opis: type.opis || '',
        aktivan: type.aktivan ?? true,
      })
    } else {
      setEditingType(null)
      setTypeForm({ naziv: '', opis: '', aktivan: true })
    }
    setShowTypeModal(true)
  }

  const closeTypeModal = () => {
    setShowTypeModal(false)
    setEditingType(null)
  }

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, data: typeForm })
    } else {
      createTypeMutation.mutate(typeForm)
    }
  }

  // --- Profil rutiranja helpers ---
  const parseProfilRegije = (profil: string | null): number[] => {
    if (!profil) return []
    return profil.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
  }

  const selectedRegionIds = parseProfilRegije(vehicleForm.profil_rutiranja)

  const toggleRegion = (regionId: number) => {
    const current = selectedRegionIds
    const next = current.includes(regionId)
      ? current.filter(id => id !== regionId)
      : [...current, regionId]
    setVehicleForm({ ...vehicleForm, profil_rutiranja: next.join(',') })
  }

  const getRegionNames = (profil: string | null): string => {
    const ids = parseProfilRegije(profil)
    if (ids.length === 0) return '—'
    return ids
      .map(id => regions.find((r: Regija) => r.id === id)?.naziv)
      .filter(Boolean)
      .join(', ') || '—'
  }

  const getVehicleTypeName = (tipId: number | null) => {
    if (!tipId) return '—'
    const tip = vehicleTypes.find((t: VoziloTip) => t.id === tipId)
    return tip?.naziv || '—'
  }

  const getVehicleLabel = (vehicleId: number | null) => {
    if (!vehicleId) return '—'
    const vehicle = vehicles.find((v: Vozilo) => v.id === vehicleId)
    return vehicle?.oznaka || '—'
  }

  return (
    <div className="vehicles-page">
      <Header
        title="Vozila i vozaci"
        subtitle="Upravljanje voznim parkom"
        actions={
          activeTab === 'vehicles' ? (
            <Button onClick={() => openVehicleModal()}>Novo vozilo</Button>
          ) : activeTab === 'drivers' ? (
            <Button onClick={() => openDriverModal()}>Novi vozac</Button>
          ) : (
            <Button onClick={() => openTypeModal()}>Novi tip vozila</Button>
          )
        }
      />

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicles')}
        >
          Vozila ({vehicles.length})
        </button>
        <button
          className={`tab ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          Vozaci ({drivers.length})
        </button>
        <button
          className={`tab ${activeTab === 'vehicleTypes' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicleTypes')}
        >
          Tipovi vozila ({vehicleTypes.length})
        </button>
      </div>

      {activeTab === 'vehicles' && (
        <Card className="data-card">
          <DataTable<Vozilo>
            storageKey="ft-vehicles"
            columns={[
              { key: 'oznaka', label: 'Oznaka' },
              { key: 'tip', label: 'Tip' },
              { key: 'skladiste', label: 'Skladište' },
              { key: 'nosivost_kg', label: 'Nosivost (kg)' },
              { key: 'volumen_m3', label: 'Volumen (m³)' },
              { key: 'profil_rutiranja', label: 'Profil rutiranja' },
              { key: 'paleta', label: 'Paleta' },
              { key: 'aktivan', label: 'Status' },
            ] as DataTableColumn[]}
            data={vehicles}
            rowKey={(v) => v.id}
            isLoading={vehiclesLoading}
            emptyMessage="Nema vozila."
            cellValue={(v, key) => {
              if (key === 'tip') return getVehicleTypeName(v.tip_id)
              if (key === 'skladiste') return getWarehouseName(v.warehouse_id)
              if (key === 'aktivan') return v.aktivan ? 'Aktivan' : 'Neaktivan'
              if (key === 'paleta') return v.paleta != null ? String(v.paleta) : ''
              if (key === 'profil_rutiranja') return getRegionNames(v.profil_rutiranja)
              return (v as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(v, key) => {
              if (key === 'tip') return getVehicleTypeName(v.tip_id)
              if (key === 'skladiste') return getWarehouseName(v.warehouse_id)
              if (key === 'nosivost_kg') return v.nosivost_kg?.toLocaleString() || '—'
              if (key === 'volumen_m3') return v.volumen_m3 != null ? String(v.volumen_m3) : '—'
              if (key === 'profil_rutiranja') return getRegionNames(v.profil_rutiranja)
              if (key === 'paleta') return v.paleta != null ? String(v.paleta) : '—'
              if (key === 'aktivan') return (
                <span className={`status-badge ${v.aktivan ? 'active' : 'inactive'}`}>
                  {v.aktivan ? 'Aktivan' : 'Neaktivan'}
                </span>
              )
              return String((v as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(vehicle) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openVehicleModal(vehicle)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati vozilo?')) deleteVehicleMutation.mutate(vehicle.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {activeTab === 'drivers' && (
        <Card className="data-card">
          <DataTable<Vozac>
            storageKey="ft-drivers"
            columns={[
              { key: 'ime_prezime', label: 'Ime i prezime' },
              { key: 'telefon', label: 'Telefon' },
              { key: 'skladiste', label: 'Skladište' },
              { key: 'vozilo', label: 'Vozilo' },
              { key: 'aktivan', label: 'Status' },
            ] as DataTableColumn[]}
            data={drivers}
            rowKey={(d) => d.id}
            isLoading={driversLoading}
            emptyMessage="Nema vozača."
            cellValue={(d, key) => {
              if (key === 'ime_prezime') return `${d.ime} ${d.prezime}`
              if (key === 'skladiste') return getWarehouseName(d.warehouse_id)
              if (key === 'vozilo') return getVehicleLabel(d.vozilo_id)
              if (key === 'aktivan') return d.aktivan ? 'Aktivan' : 'Neaktivan'
              return (d as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(d, key) => {
              if (key === 'ime_prezime') return `${d.ime} ${d.prezime}`
              if (key === 'telefon') return d.telefon || '—'
              if (key === 'skladiste') return getWarehouseName(d.warehouse_id)
              if (key === 'vozilo') return getVehicleLabel(d.vozilo_id)
              if (key === 'aktivan') return (
                <span className={`status-badge ${d.aktivan ? 'active' : 'inactive'}`}>
                  {d.aktivan ? 'Aktivan' : 'Neaktivan'}
                </span>
              )
              return String((d as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(driver) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openDriverModal(driver)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati vozača?')) deleteDriverMutation.mutate(driver.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {activeTab === 'vehicleTypes' && (
        <Card className="data-card">
          <DataTable<VoziloTip>
            storageKey="ft-vehicle-types"
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'naziv', label: 'Naziv' },
              { key: 'opis', label: 'Opis' },
              { key: 'aktivan', label: 'Status' },
            ] as DataTableColumn[]}
            data={vehicleTypes}
            rowKey={(t) => t.id}
            isLoading={typesLoading}
            emptyMessage="Nema tipova vozila."
            cellValue={(t, key) => {
              if (key === 'aktivan') return t.aktivan ? 'Aktivan' : 'Neaktivan'
              return (t as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(t, key) => {
              if (key === 'opis') return t.opis || '—'
              if (key === 'aktivan') return (
                <span className={`status-badge ${t.aktivan ? 'active' : 'inactive'}`}>
                  {t.aktivan ? 'Aktivan' : 'Neaktivan'}
                </span>
              )
              return String((t as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(type) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openTypeModal(type)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati tip vozila?')) deleteTypeMutation.mutate(type.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div className="modal-overlay" onClick={closeVehicleModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingVehicle ? 'Uredi vozilo' : 'Novo vozilo'}</h2>
            <form onSubmit={handleVehicleSubmit}>
              <div className="form-group">
                <label>Oznaka *</label>
                <input
                  type="text"
                  value={vehicleForm.oznaka}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, oznaka: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tip vozila</label>
                <select
                  value={vehicleForm.tip_id || ''}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, tip_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">-- Odaberi --</option>
                  {vehicleTypes.map((tip: VoziloTip) => (
                    <option key={tip.id} value={tip.id}>{tip.naziv}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Skladište</label>
                <select
                  value={vehicleForm.warehouse_id || ''}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, warehouse_id: e.target.value ? Number(e.target.value) : null })
                  }
                  disabled={!isAdmin && !!currentUser?.warehouse_id}
                >
                  {isAdmin && <option value="">— Sva skladišta —</option>}
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ''}{w.naziv}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nosivost (kg)</label>
                  <input
                    type="number"
                    value={vehicleForm.nosivost_kg || ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, nosivost_kg: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Volumen (m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vehicleForm.volumen_m3 || ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, volumen_m3: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Profil rutiranja (regije)</label>
                <div className="multi-select" ref={regionDropdownRef}>
                  <div
                    className="multi-select-trigger"
                    onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
                  >
                    {selectedRegionIds.length === 0 ? (
                      <span className="multi-select-placeholder">Odaberi regije...</span>
                    ) : (
                      <div className="multi-select-tags">
                        {selectedRegionIds.map(id => {
                          const reg = regions.find((r: Regija) => r.id === id)
                          if (!reg) return null
                          return (
                            <span key={id} className="multi-select-tag">
                              {reg.naziv}
                              <button
                                type="button"
                                className="multi-select-tag-remove"
                                onClick={(e) => { e.stopPropagation(); toggleRegion(id) }}
                              >
                                &times;
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <span className="multi-select-arrow">{regionDropdownOpen ? '▲' : '▼'}</span>
                  </div>
                  {regionDropdownOpen && (
                    <div className="multi-select-dropdown">
                      {regions.filter((r: Regija) => r.aktivan).length === 0 ? (
                        <div className="multi-select-empty">Nema aktivnih regija</div>
                      ) : (
                        regions.filter((r: Regija) => r.aktivan).map((r: Regija) => (
                          <label key={r.id} className="multi-select-option">
                            <input
                              type="checkbox"
                              checked={selectedRegionIds.includes(r.id)}
                              onChange={() => toggleRegion(r.id)}
                            />
                            <span>{r.naziv}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Broj paleta</label>
                <input
                  type="number"
                  value={vehicleForm.paleta ?? ''}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, paleta: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Max paleta"
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={vehicleForm.aktivan}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, aktivan: e.target.checked })}
                  />
                  Aktivno vozilo
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closeVehicleModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                >
                  {editingVehicle ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Modal */}
      {showDriverModal && (
        <div className="modal-overlay" onClick={closeDriverModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingDriver ? 'Uredi vozaca' : 'Novi vozac'}</h2>
            <form onSubmit={handleDriverSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Ime *</label>
                  <input
                    type="text"
                    value={driverForm.ime}
                    onChange={(e) => setDriverForm({ ...driverForm, ime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Prezime *</label>
                  <input
                    type="text"
                    value={driverForm.prezime}
                    onChange={(e) => setDriverForm({ ...driverForm, prezime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="text"
                  value={driverForm.telefon}
                  onChange={(e) => setDriverForm({ ...driverForm, telefon: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Skladište</label>
                <select
                  value={driverForm.warehouse_id || ''}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, warehouse_id: e.target.value ? Number(e.target.value) : null })
                  }
                  disabled={!isAdmin && !!currentUser?.warehouse_id}
                >
                  {isAdmin && <option value="">— Sva skladišta —</option>}
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ''}{w.naziv}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Vozilo</label>
                <select
                  value={driverForm.vozilo_id || ''}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, vozilo_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">-- Bez vozila --</option>
                  {vehicles.filter((v: Vozilo) => v.aktivan).map((vehicle: Vozilo) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.oznaka}</option>
                  ))}
                </select>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={driverForm.aktivan}
                    onChange={(e) => setDriverForm({ ...driverForm, aktivan: e.target.checked })}
                  />
                  Aktivan vozac
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closeDriverModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createDriverMutation.isPending || updateDriverMutation.isPending}
                >
                  {editingDriver ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Type Modal */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={closeTypeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingType ? 'Uredi tip vozila' : 'Novi tip vozila'}</h2>
            <form onSubmit={handleTypeSubmit}>
              <div className="form-group">
                <label>Naziv *</label>
                <input
                  type="text"
                  value={typeForm.naziv}
                  onChange={(e) => setTypeForm({ ...typeForm, naziv: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Opis</label>
                <textarea
                  value={typeForm.opis}
                  onChange={(e) => setTypeForm({ ...typeForm, opis: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={typeForm.aktivan}
                    onChange={(e) => setTypeForm({ ...typeForm, aktivan: e.target.checked })}
                  />
                  Aktivan
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closeTypeModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createTypeMutation.isPending || updateTypeMutation.isPending}
                >
                  {editingType ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
