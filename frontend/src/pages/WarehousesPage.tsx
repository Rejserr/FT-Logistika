import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card } from '../components/common'
import { useAuth } from '../contexts/AuthContext'
import './WarehousesPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

interface Warehouse {
  id: number
  code: string | null
  naziv: string
  adresa: string | null
  mjesto: string | null
  postanski_broj: string | null
  drzava: string | null
  lat: number | null
  lng: number | null
  tip: string
  is_central: boolean
  radno_vrijeme_od: string | null
  radno_vrijeme_do: string | null
  kontakt_telefon: string | null
  kontakt_email: string | null
  max_vozila: number | null
  aktivan: boolean
}

async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Greška' }))
    throw new Error(err.detail || `HTTP ${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

const emptyForm = {
  code: '', naziv: '', adresa: '', mjesto: '', postanski_broj: '', drzava: 'Hrvatska',
  lat: '', lng: '', tip: 'store', is_central: false, aktivan: true,
  radno_vrijeme_od: '07:00', radno_vrijeme_do: '15:00',
  kontakt_telefon: '', kontakt_email: '', max_vozila: '',
}

export default function WarehousesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editWh, setEditWh] = useState<Warehouse | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiFetch('/warehouses'),
  })

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (editWh) {
        return apiFetch(`/warehouses/${editWh.id}`, { method: 'PUT', body: JSON.stringify(body) })
      }
      return apiFetch('/warehouses', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); setShowModal(false) },
  })

  const openCreate = () => {
    setEditWh(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (w: Warehouse) => {
    setEditWh(w)
    setForm({
      code: w.code || '', naziv: w.naziv, adresa: w.adresa || '', mjesto: w.mjesto || '',
      postanski_broj: w.postanski_broj || '', drzava: w.drzava || 'Hrvatska',
      lat: w.lat?.toString() || '', lng: w.lng?.toString() || '',
      tip: w.tip, is_central: w.is_central, aktivan: w.aktivan,
      radno_vrijeme_od: w.radno_vrijeme_od || '', radno_vrijeme_do: w.radno_vrijeme_do || '',
      kontakt_telefon: w.kontakt_telefon || '', kontakt_email: w.kontakt_email || '',
      max_vozila: w.max_vozila?.toString() || '',
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    saveMut.mutate({
      code: form.code || null, naziv: form.naziv, adresa: form.adresa || null,
      mjesto: form.mjesto || null, postanski_broj: form.postanski_broj || null,
      drzava: form.drzava || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      tip: form.tip, is_central: form.is_central, aktivan: form.aktivan,
      radno_vrijeme_od: form.radno_vrijeme_od || null,
      radno_vrijeme_do: form.radno_vrijeme_do || null,
      kontakt_telefon: form.kontakt_telefon || null,
      kontakt_email: form.kontakt_email || null,
      max_vozila: form.max_vozila ? parseInt(form.max_vozila) : null,
    })
  }

  const canManage = hasPermission('warehouses.create')

  return (
    <div className="warehouses-page">
      <div className="wh-header">
        <h1>Skladišta</h1>
        {canManage && <Button onClick={openCreate}>+ Novo skladište</Button>}
      </div>

      <div className="wh-grid">
        {isLoading ? (
          <p>Učitavanje...</p>
        ) : [...warehouses].sort((a, b) => (a.naziv || '').localeCompare(b.naziv || '', 'hr')).map(w => (
          <Card key={w.id} className={`wh-card ${!w.aktivan ? 'inactive' : ''}`}>
            <div className="wh-card-header">
              <div className="wh-type-badge">
                {w.is_central ? '🏭 Centralno' : '🏪 Poslovnica'}
              </div>
              {w.code && <span className="wh-code">{w.code}</span>}
            </div>
            <h3>{w.naziv}</h3>
            <p className="wh-address">{w.adresa || '—'}, {w.mjesto || ''} {w.postanski_broj || ''}</p>
            <div className="wh-meta">
              {w.radno_vrijeme_od && w.radno_vrijeme_do && (
                <span>🕐 {w.radno_vrijeme_od}–{w.radno_vrijeme_do}</span>
              )}
              {w.kontakt_telefon && <span>📞 {w.kontakt_telefon}</span>}
              {w.max_vozila && <span>🚚 Max {w.max_vozila} vozila</span>}
            </div>
            <div className="wh-coords">
              {w.lat && w.lng ? `📍 ${w.lat}, ${w.lng}` : '📍 Bez koordinata'}
            </div>
            {canManage && (
              <button className="wh-edit-btn" onClick={() => openEdit(w)}>✏️ Uredi</button>
            )}
          </Card>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content wh-modal" onClick={e => e.stopPropagation()}>
            <h2>{editWh ? 'Uredi skladište' : 'Novo skladište'}</h2>
            <div className="wh-form-grid">
              <label>
                Kod (npr. 01, 100)
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              </label>
              <label>
                Naziv *
                <input value={form.naziv} onChange={e => setForm({ ...form, naziv: e.target.value })} />
              </label>
              <label>
                Tip
                <select value={form.tip} onChange={e => setForm({ ...form, tip: e.target.value })}>
                  <option value="store">Poslovnica</option>
                  <option value="central">Centralno</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_central} onChange={e => setForm({ ...form, is_central: e.target.checked })} />
                Centralno skladište
              </label>
              <label>
                Država
                <input value={form.drzava} onChange={e => setForm({ ...form, drzava: e.target.value })} />
              </label>
              {editWh && (
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.aktivan} onChange={e => setForm({ ...form, aktivan: e.target.checked })} />
                  Aktivno skladište
                </label>
              )}
              <label>
                Adresa
                <input value={form.adresa} onChange={e => setForm({ ...form, adresa: e.target.value })} />
              </label>
              <label>
                Mjesto
                <input value={form.mjesto} onChange={e => setForm({ ...form, mjesto: e.target.value })} />
              </label>
              <label>
                Poštanski broj
                <input value={form.postanski_broj} onChange={e => setForm({ ...form, postanski_broj: e.target.value })} />
              </label>
              <label>
                Lat
                <input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="45.xxxx" />
              </label>
              <label>
                Lng
                <input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="15.xxxx" />
              </label>
              <label>
                Radno vrijeme od
                <input value={form.radno_vrijeme_od} onChange={e => setForm({ ...form, radno_vrijeme_od: e.target.value })} placeholder="07:00" />
              </label>
              <label>
                Radno vrijeme do
                <input value={form.radno_vrijeme_do} onChange={e => setForm({ ...form, radno_vrijeme_do: e.target.value })} placeholder="15:00" />
              </label>
              <label>
                Kontakt telefon
                <input value={form.kontakt_telefon} onChange={e => setForm({ ...form, kontakt_telefon: e.target.value })} />
              </label>
              <label>
                Kontakt email
                <input value={form.kontakt_email} onChange={e => setForm({ ...form, kontakt_email: e.target.value })} />
              </label>
              <label>
                Max vozila
                <input type="number" value={form.max_vozila} onChange={e => setForm({ ...form, max_vozila: e.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Odustani</Button>
              <Button onClick={handleSubmit} disabled={!form.naziv || saveMut.isPending}>
                {editWh ? 'Spremi' : 'Kreiraj'}
              </Button>
            </div>
            {saveMut.error && <p className="modal-error">{saveMut.error.message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
