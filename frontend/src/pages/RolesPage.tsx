import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card } from '../components/common'
import { useAuth } from '../contexts/AuthContext'
import './RolesPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

interface RoleItem {
  id: number
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]
}

interface PermissionItem {
  id: number
  name: string
  description: string | null
  module: string
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

const MODULE_LABELS: Record<string, string> = {
  orders: 'Nalozi',
  routes: 'Rute',
  vehicles: 'Vozila',
  warehouses: 'Skladišta',
  users: 'Korisnici',
  roles: 'Role',
  settings: 'Postavke',
  sync: 'Sinkronizacija',
  reports: 'Izvještaji',
  audit: 'Audit',
  geocoding: 'Geokodiranje',
}

export default function RolesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editRole, setEditRole] = useState<RoleItem | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [permModal, setPermModal] = useState<RoleItem | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())

  const { data: roles = [], isLoading } = useQuery<RoleItem[]>({
    queryKey: ['roles'],
    queryFn: () => apiFetch('/roles'),
  })

  const { data: allPermissions = [] } = useQuery<PermissionItem[]>({
    queryKey: ['permissions'],
    queryFn: () => apiFetch('/roles/permissions/all'),
  })

  const permsByModule = useMemo(() => {
    const map: Record<string, PermissionItem[]> = {}
    for (const p of allPermissions) {
      if (!map[p.module]) map[p.module] = []
      map[p.module].push(p)
    }
    return map
  }, [allPermissions])

  const createMut = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      apiFetch('/roles', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setShowModal(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name?: string; description?: string | null } }) =>
      apiFetch(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setShowModal(false); setEditRole(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  const setPermsMut = useMutation({
    mutationFn: ({ id, perms }: { id: number; perms: string[] }) =>
      apiFetch(`/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permission_names: perms }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setPermModal(null) },
  })

  const openCreate = () => {
    setEditRole(null)
    setForm({ name: '', description: '' })
    setShowModal(true)
  }

  const openEdit = (r: RoleItem) => {
    setEditRole(r)
    setForm({ name: r.name, description: r.description || '' })
    setShowModal(true)
  }

  const openPermissions = (r: RoleItem) => {
    setPermModal(r)
    setSelectedPerms(new Set(r.permissions))
  }

  const handleSubmit = () => {
    if (editRole) {
      updateMut.mutate({ id: editRole.id, body: { name: form.name, description: form.description || null } })
    } else {
      createMut.mutate({ name: form.name, description: form.description || null })
    }
  }

  const handleDelete = (r: RoleItem) => {
    if (r.is_system) return
    if (confirm(`Jeste li sigurni da želite obrisati rolu "${r.name}"?`)) {
      deleteMut.mutate(r.id)
    }
  }

  const togglePerm = (pname: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev)
      if (next.has(pname)) next.delete(pname)
      else next.add(pname)
      return next
    })
  }

  const toggleModule = (module: string) => {
    const modulePerms = permsByModule[module] || []
    const allSelected = modulePerms.every(p => selectedPerms.has(p.name))
    setSelectedPerms(prev => {
      const next = new Set(prev)
      for (const p of modulePerms) {
        if (allSelected) next.delete(p.name)
        else next.add(p.name)
      }
      return next
    })
  }

  const savePermissions = () => {
    if (!permModal) return
    setPermsMut.mutate({ id: permModal.id, perms: Array.from(selectedPerms) })
  }

  const canManage = hasPermission('roles.create') || hasPermission('users.manage_roles')

  return (
    <div className="roles-page">
      <div className="roles-header">
        <h1>Role i dozvole</h1>
        {canManage && <Button onClick={openCreate}>+ Nova rola</Button>}
      </div>

      <div className="roles-grid">
        {isLoading ? (
          <p>Učitavanje...</p>
        ) : (
          roles.map(r => (
            <Card key={r.id} className="role-card">
              <div className="role-card-header">
                <div className="role-card-title">
                  <h3>{r.name}</h3>
                  {r.is_system && <span className="system-badge">Sistemska</span>}
                </div>
                {canManage && (
                  <div className="role-card-actions">
                    <button className="action-btn" onClick={() => openEdit(r)} title="Uredi">✏️</button>
                    <button className="action-btn perm-btn" onClick={() => openPermissions(r)} title="Dozvole">🔑</button>
                    {!r.is_system && (
                      <button className="action-btn danger" onClick={() => handleDelete(r)} title="Obriši">🗑️</button>
                    )}
                  </div>
                )}
              </div>
              {r.description && <p className="role-desc">{r.description}</p>}
              <div className="role-perms-summary">
                <span className="perm-count">{r.permissions.length} dozvola</span>
                <div className="perm-modules">
                  {[...new Set(r.permissions.map(p => p.split('.')[0]))].map(mod => (
                    <span key={mod} className="module-chip">{MODULE_LABELS[mod] || mod}</span>
                  ))}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content role-modal" onClick={e => e.stopPropagation()}>
            <h2>{editRole ? 'Uredi rolu' : 'Nova rola'}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>Naziv role *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="npr. Skladištar"
                  disabled={editRole?.is_system}
                />
              </div>
              <div className="form-group">
                <label>Opis</label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Kratki opis role..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Odustani</Button>
              <Button onClick={handleSubmit} disabled={!form.name || createMut.isPending || updateMut.isPending}>
                {editRole ? 'Spremi' : 'Kreiraj'}
              </Button>
            </div>
            {(createMut.error || updateMut.error) && (
              <p className="modal-error">{(createMut.error || updateMut.error)?.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permModal && (
        <div className="modal-overlay" onClick={() => setPermModal(null)}>
          <div className="modal-content perm-modal" onClick={e => e.stopPropagation()}>
            <h2>Dozvole: {permModal.name}</h2>
            <p className="perm-modal-hint">Označite dozvole koje ova rola treba imati.</p>

            <div className="perm-modules-list">
              {Object.entries(permsByModule).map(([module, perms]) => {
                const allChecked = perms.every(p => selectedPerms.has(p.name))
                const someChecked = perms.some(p => selectedPerms.has(p.name))
                return (
                  <div key={module} className="perm-module-group">
                    <label className="module-header" onClick={() => toggleModule(module)}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                        onChange={() => toggleModule(module)}
                      />
                      <span className="module-name">{MODULE_LABELS[module] || module}</span>
                    </label>
                    <div className="perm-items">
                      {perms.map(p => (
                        <label key={p.name} className="perm-item">
                          <input
                            type="checkbox"
                            checked={selectedPerms.has(p.name)}
                            onChange={() => togglePerm(p.name)}
                          />
                          <div className="perm-info">
                            <span className="perm-name">{p.name}</span>
                            {p.description && <span className="perm-desc">{p.description}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="perm-modal-footer">
              <span className="selected-count">{selectedPerms.size} od {allPermissions.length} odabrano</span>
              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setPermModal(null)}>Odustani</Button>
                <Button onClick={savePermissions} disabled={setPermsMut.isPending}>
                  Spremi dozvole
                </Button>
              </div>
            </div>

            {setPermsMut.error && <p className="modal-error">{setPermsMut.error.message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
