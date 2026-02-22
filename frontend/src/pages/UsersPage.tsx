import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card } from '../components/common'
import { useAuth } from '../contexts/AuthContext'
import './UsersPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

interface UserItem {
  id: number
  username: string
  ime: string | null
  prezime: string | null
  email: string | null
  full_name: string
  aktivan: boolean
  locked: boolean
  role_id: number | null
  role_name: string | null
  warehouse_id: number | null
  warehouse_name?: string | null
  vozac_id: number | null
  force_password_change: boolean
  failed_login_attempts: number
  last_login: string | null
  created_at: string | null
}

interface RoleItem {
  id: number
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]
}

interface WarehouseItem {
  id: number
  naziv: string
  code: string | null
  tip: string
}

const USER_COLUMNS = [
  { key: 'username', label: 'Korisničko ime' },
  { key: 'full_name', label: 'Ime i prezime' },
  { key: 'email', label: 'Email' },
  { key: 'role_name', label: 'Rola' },
  { key: 'warehouse_name', label: 'Skladište' },
  { key: 'status', label: 'Status' },
  { key: 'last_login', label: 'Zadnji login' },
] as const

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

export default function UsersPage() {
  const { hasPermission, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'Admin'
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [form, setForm] = useState({
    username: '', password: '', ime: '', prezime: '', email: '',
    role_id: 0, warehouse_id: 0, force_password_change: true,
  })
  const [resetPwModal, setResetPwModal] = useState<UserItem | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users'),
  })

  const { data: roles = [] } = useQuery<RoleItem[]>({
    queryKey: ['roles'],
    queryFn: () => apiFetch('/roles'),
  })

  const { data: warehouses = [] } = useQuery<WarehouseItem[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiFetch('/warehouses'),
  })

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowModal(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); setEditUser(null) },
  })

  const lockMut = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'lock' | 'unlock' }) =>
      apiFetch(`/users/${id}/${action}`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const resetPwMut = useMutation({
    mutationFn: ({ id, pw }: { id: number; pw: string }) =>
      apiFetch(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: pw }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setResetPwModal(null); setNewPassword('') },
  })

  const getWarehouseName = (whId: number | null) => {
    if (!whId) return '—'
    const wh = warehouses.find(w => w.id === whId)
    return wh ? `${wh.code || ''} ${wh.naziv}`.trim() : `ID: ${whId}`
  }

  // --- Filters & sorting ---
  const [globalSearch, setGlobalSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterDropdownKey, setFilterDropdownKey] = useState<string | null>(null)
  const [filterDropdownPos, setFilterDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  const getCellValue = (u: UserItem, key: string): string => {
    if (key === 'status') {
      if (!u.aktivan) return 'Neaktivan'
      if (u.locked) return 'Zaključan'
      return 'Aktivan'
    }
    if (key === 'warehouse_name') return getWarehouseName(u.warehouse_id)
    if (key === 'last_login') return u.last_login ? new Date(u.last_login).toLocaleString('hr-HR') : ''
    const val = (u as unknown as Record<string, unknown>)[key]
    return val == null ? '' : String(val)
  }

  const globalFiltered = useMemo(() => {
    if (!globalSearch.trim()) return users
    const q = globalSearch.toLowerCase()
    return users.filter(u =>
      USER_COLUMNS.some(({ key }) => getCellValue(u, key).toLowerCase().includes(q))
    )
  }, [users, globalSearch, warehouses])

  const distinctByColumn = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    USER_COLUMNS.forEach(({ key: targetKey }) => {
      map[targetKey] = new Set()
      const relevantUsers = globalFiltered.filter(u => {
        for (const { key: colKey } of USER_COLUMNS) {
          if (colKey === targetKey) continue
          const selected = columnFilters[colKey]
          if (!selected || selected.length === 0) continue
          if (!selected.includes(getCellValue(u, colKey))) return false
        }
        return true
      })
      relevantUsers.forEach(u => map[targetKey].add(getCellValue(u, targetKey)))
    })
    return map
  }, [globalFiltered, columnFilters, warehouses])

  const columnFiltered = useMemo(() => {
    return globalFiltered.filter(u => {
      for (const { key } of USER_COLUMNS) {
        const selected = columnFilters[key]
        if (!selected || selected.length === 0) continue
        if (!selected.includes(getCellValue(u, key))) return false
      }
      return true
    })
  }, [globalFiltered, columnFilters, warehouses])

  const sortedUsers = useMemo(() => {
    if (!sortBy) return columnFiltered
    return [...columnFiltered].sort((a, b) => {
      const aVal = getCellValue(a, sortBy)
      const bVal = getCellValue(b, sortBy)
      const cmp = aVal.localeCompare(bVal, 'hr')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [columnFiltered, sortBy, sortDir])

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const toggleFilterValue = (colKey: string, val: string) => {
    setColumnFilters(prev => {
      const current = prev[colKey] ?? []
      const next = current.includes(val)
        ? current.filter(v => v !== val)
        : [...current, val]
      return { ...prev, [colKey]: next }
    })
  }

  const clearColumnFilter = (colKey: string) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: [] }))
  }

  const openFilterDropdown = (key: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left })
    setFilterDropdownKey(prev => prev === key ? null : key)
  }

  useEffect(() => {
    if (!filterDropdownKey) return
    const handleClick = (e: MouseEvent) => {
      if (filterDropdownRef.current?.contains(e.target as Node)) return
      if (filterBtnRef.current?.contains(e.target as Node)) return
      setFilterDropdownKey(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterDropdownKey])

  const activeFilterCount = Object.values(columnFilters).filter(v => v.length > 0).length

  const openCreate = () => {
    setEditUser(null)
    const defaultWhId = (!isAdmin && currentUser?.warehouse_id) ? currentUser.warehouse_id : 0
    setForm({ username: '', password: '', ime: '', prezime: '', email: '', role_id: 0, warehouse_id: defaultWhId, force_password_change: true })
    setShowModal(true)
  }

  const openEdit = (u: UserItem) => {
    setEditUser(u)
    setForm({
      username: u.username, password: '', ime: u.ime || '', prezime: u.prezime || '',
      email: u.email || '', role_id: u.role_id || 0, warehouse_id: u.warehouse_id || 0,
      force_password_change: u.force_password_change,
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (editUser) {
      updateMut.mutate({
        id: editUser.id,
        body: {
          ime: form.ime || null, prezime: form.prezime || null, email: form.email || null,
          role_id: form.role_id || null, warehouse_id: form.warehouse_id || null,
          aktivan: editUser.aktivan,
        },
      })
    } else {
      createMut.mutate({
        username: form.username, password: form.password,
        ime: form.ime || null, prezime: form.prezime || null, email: form.email || null,
        role_id: form.role_id || null, warehouse_id: form.warehouse_id || null,
        force_password_change: form.force_password_change,
      })
    }
  }

  const canManage = hasPermission('users.create')

  return (
    <div className="users-page">
      <div className="users-header">
        <h1>Korisnici</h1>
        <div className="users-header-right">
          <div className="users-global-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Pretraži korisnike..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
            />
            {globalSearch && (
              <button className="search-clear" onClick={() => setGlobalSearch('')}>✕</button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button className="users-clear-filters" onClick={() => setColumnFilters({})}>
              Očisti filtere ({activeFilterCount})
            </button>
          )}
          {canManage && <Button onClick={openCreate}>+ Novi korisnik</Button>}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <p>Učitavanje...</p>
        ) : (
          <>
            <div className="users-table-info">
              Prikazano {sortedUsers.length} od {users.length} korisnika
            </div>
            <table className="users-table">
              <thead>
                <tr>
                  {USER_COLUMNS.map(({ key, label }) => {
                    const hasFilter = (columnFilters[key]?.length ?? 0) > 0
                    return (
                      <th key={key} className={`th-filterable ${hasFilter ? 'th-col-active' : ''}`}>
                        <div className="th-cell">
                          <button type="button" className="th-sort-btn" onClick={() => handleSort(key)}>
                            {label}
                            {sortBy === key && (
                              <span className="th-sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </button>
                          <div ref={filterDropdownKey === key ? filterBtnRef : undefined}>
                            <button
                              type="button"
                              className={`th-col-filter-btn ${hasFilter ? 'active' : ''}`}
                              onClick={(e) => openFilterDropdown(key, e)}
                              title="Filter"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </th>
                    )
                  })}
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u.id} className={!u.aktivan ? 'user-inactive' : ''}>
                    <td className="user-username">{u.username}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email || '—'}</td>
                    <td>
                      <span className={`role-tag role-${(u.role_name || 'none').toLowerCase()}`}>
                        {u.role_name || '—'}
                      </span>
                    </td>
                    <td className="user-warehouse">{getWarehouseName(u.warehouse_id)}</td>
                    <td>
                      {!u.aktivan && <span className="status-tag inactive">Neaktivan</span>}
                      {u.locked && <span className="status-tag locked">Zaključan</span>}
                      {u.aktivan && !u.locked && <span className="status-tag active">Aktivan</span>}
                    </td>
                    <td className="user-login-info">
                      {u.last_login ? new Date(u.last_login).toLocaleString('hr-HR') : '—'}
                    </td>
                    <td className="user-actions">
                      {canManage && (
                        <>
                          <button className="action-btn edit" onClick={() => openEdit(u)} title="Uredi">✏️</button>
                          <button
                            className="action-btn"
                            onClick={() => lockMut.mutate({ id: u.id, action: u.locked ? 'unlock' : 'lock' })}
                            title={u.locked ? 'Otključaj' : 'Zaključaj'}
                          >
                            {u.locked ? '🔓' : '🔒'}
                          </button>
                          <button className="action-btn" onClick={() => setResetPwModal(u)} title="Reset lozinke">🔑</button>
                          {u.aktivan && (
                            <button className="action-btn danger" onClick={() => deactivateMut.mutate(u.id)} title="Deaktiviraj">❌</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedUsers.length === 0 && (
                  <tr><td colSpan={8} className="users-empty">Nema rezultata</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </Card>

      {/* Column filter dropdown (portal) */}
      {filterDropdownKey && filterDropdownPos && createPortal(
        <div
          ref={filterDropdownRef}
          className="users-filter-dropdown"
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          <button
            className="filter-all"
            onClick={() => clearColumnFilter(filterDropdownKey)}
          >
            ✕ Očisti filter
          </button>
          {Array.from(distinctByColumn[filterDropdownKey] || [])
            .sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'hr'))
            .map(val => (
              <label key={val || '(prazno)'} className="filter-option">
                <input
                  type="checkbox"
                  checked={(columnFilters[filterDropdownKey] ?? []).includes(val)}
                  onChange={() => toggleFilterValue(filterDropdownKey, val)}
                />
                <span>{val || '(prazno)'}</span>
              </label>
            ))}
        </div>,
        document.body
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content user-modal" onClick={e => e.stopPropagation()}>
            <h2>{editUser ? 'Uredi korisnika' : 'Novi korisnik'}</h2>
            <div className="modal-form">
              {!editUser && (
                <>
                  <div className="form-group">
                    <label>Korisničko ime *</label>
                    <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="npr. ivic.ivica" />
                  </div>
                  <div className="form-group">
                    <label>Lozinka *</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 5 znakova" />
                  </div>
                </>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Ime</label>
                  <input value={form.ime} onChange={e => setForm({ ...form, ime: e.target.value })} placeholder="Ime" />
                </div>
                <div className="form-group">
                  <label>Prezime</label>
                  <input value={form.prezime} onChange={e => setForm({ ...form, prezime: e.target.value })} placeholder="Prezime" />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@primjer.hr" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rola *</label>
                  <select value={form.role_id} onChange={e => setForm({ ...form, role_id: Number(e.target.value) })}>
                    <option value={0}>— Odaberi rolu —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.description ? ` (${r.description})` : ''}</option>)}
                  </select>
                  {roles.length === 0 && <span className="form-hint">Nema definiranih rola. Kreirajte ih u "Role" sekciji.</span>}
                </div>
                <div className="form-group">
                  <label>Skladište</label>
                  <select
                    value={form.warehouse_id}
                    onChange={e => setForm({ ...form, warehouse_id: Number(e.target.value) })}
                    disabled={!isAdmin && !!currentUser?.warehouse_id}
                  >
                    {isAdmin && <option value={0}>— Sva skladišta —</option>}
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ''}{w.naziv}</option>)}
                  </select>
                </div>
              </div>
              {!editUser && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.force_password_change}
                    onChange={e => setForm({ ...form, force_password_change: e.target.checked })}
                  />
                  Zahtijevaj promjenu lozinke pri prvoj prijavi
                </label>
              )}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Odustani</Button>
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
                {editUser ? 'Spremi' : 'Kreiraj'}
              </Button>
            </div>
            {(createMut.error || updateMut.error) && (
              <p className="modal-error">{(createMut.error || updateMut.error)?.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwModal && (
        <div className="modal-overlay" onClick={() => setResetPwModal(null)}>
          <div className="modal-content user-modal" onClick={e => e.stopPropagation()}>
            <h2>Reset lozinke: {resetPwModal.username}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>Nova lozinka (min 5 znakova)</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setResetPwModal(null)}>Odustani</Button>
              <Button
                onClick={() => resetPwMut.mutate({ id: resetPwModal.id, pw: newPassword })}
                disabled={newPassword.length < 5 || resetPwMut.isPending}
              >
                Resetiraj
              </Button>
            </div>
            {resetPwMut.error && <p className="modal-error">{resetPwMut.error.message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
