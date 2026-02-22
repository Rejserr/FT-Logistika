const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options

  let url = `${API_BASE}${endpoint}`

  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

import type {
  NalogHeader,
  Partner,
  PartnerListItem,
  SyncStatus,
  VrstaIsporuke,
  Vozilo,
  Vozac,
  VoziloTip,
  Regija,
  RegijaTree,
  PostanskiBroj,
  Route,
  RouteListItem,
  CreateRouteRequest,
  SyncResponse,
  GeocodingResponse,
  DistanceResponse,
  Artikl,
  GrupaArtikla,
  KriterijaSku,
  ArtiklKriterija,
  GeocodeOrderResult,
  ProviderInfo,
  MantisOrderSummary,
  RutiranjeNalog,
  ImportRegionsResult,
  Setting,
  Prioritet,
  StatusNaloga,
} from '@/types'

export const ordersApi = {
  list: (params?: {
    status?: string
    date_from?: string
    date_to?: string
    raspored_from?: string
    raspored_to?: string
    partner_uid?: string
    vrsta_isporuke?: string
    limit?: number
    offset?: number
  }) => request<NalogHeader[]>('/orders', { params }),

  get: (nalogProdajeUid: string) => request<NalogHeader>(`/orders/${nalogProdajeUid}`),

  update: (nalogProdajeUid: string, data: Partial<NalogHeader>) =>
    request<NalogHeader>(`/orders/${nalogProdajeUid}`, { method: 'PUT', body: data }),

  getOrdersWithCriteria: () => request<string[]>('/orders/with-criteria'),

  setManualPaleta: (nalog_prodaje_uid: string, manual_paleta: number | null) =>
    request<{ nalog_prodaje_uid: string; manual_paleta: number | null }>(
      `/orders/${encodeURIComponent(nalog_prodaje_uid)}/manual-paleta`,
      { method: 'PATCH', body: { manual_paleta } },
    ),

  deleteAndBlacklist: (nalog_uids: string[], razlog?: string) =>
    request<{ obrisano: number; blacklisted: number }>('/orders/delete-and-blacklist', {
      method: 'POST',
      body: { nalog_uids, razlog },
    }),

  getBlacklist: () => request<{ nalog_prodaje_uid: string; razlog: string | null; blocked_by: string | null; blocked_at: string | null }[]>('/orders/blacklist'),

  unblacklist: (nalog_uids: string[]) =>
    request<{ uklonjeno: number }>('/orders/unblacklist', {
      method: 'POST',
      body: { nalog_uids },
    }),
}

export const partnersApi = {
  list: (params?: {
    search?: string
    blokiran?: string
    limit?: number
    offset?: number
  }) => request<PartnerListItem[]>('/partners', { params }),

  get: (partnerUid: string) => request<Partner>(`/partners/${partnerUid}`),

  update: (partnerUid: string, data: Partial<Partner>) =>
    request<Partner>(`/partners/${partnerUid}`, { method: 'PATCH', body: data }),
}

export const vrsteIsporukeApi = {
  list: (aktivan?: boolean) =>
    request<VrstaIsporuke[]>('/vrste-isporuke', { params: { aktivan } }),

  create: (data: { vrsta_isporuke: string; opis?: string; aktivan?: boolean }) =>
    request<VrstaIsporuke>('/vrste-isporuke', { method: 'POST', body: data }),

  update: (id: number, data: Partial<VrstaIsporuke>) =>
    request<VrstaIsporuke>(`/vrste-isporuke/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) => request<void>(`/vrste-isporuke/${id}`, { method: 'DELETE' }),
}

export const syncStatusiApi = {
  list: () => request<SyncStatus[]>('/sync-statusi'),

  create: (data: { status_id: string; naziv?: string; aktivan?: boolean }) =>
    request<SyncStatus>('/sync-statusi', { method: 'POST', body: data }),

  update: (id: number, data: Partial<SyncStatus>) =>
    request<SyncStatus>(`/sync-statusi/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) => request<void>(`/sync-statusi/${id}`, { method: 'DELETE' }),
}

export const vehiclesApi = {
  listTypes: () => request<VoziloTip[]>('/vehicle-types'),

  createType: (data: Partial<VoziloTip>) =>
    request<VoziloTip>('/vehicle-types', { method: 'POST', body: data }),

  updateType: (id: number, data: Partial<VoziloTip>) =>
    request<VoziloTip>(`/vehicle-types/${id}`, { method: 'PUT', body: data }),

  deleteType: (id: number) => request<void>(`/vehicle-types/${id}`, { method: 'DELETE' }),

  list: () => request<Vozilo[]>('/vehicles'),

  create: (data: Partial<Vozilo>) =>
    request<Vozilo>('/vehicles', { method: 'POST', body: data }),

  update: (id: number, data: Partial<Vozilo>) =>
    request<Vozilo>(`/vehicles/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) => request<void>(`/vehicles/${id}`, { method: 'DELETE' }),
}

export const driversApi = {
  list: () => request<Vozac[]>('/drivers'),

  create: (data: Partial<Vozac>) =>
    request<Vozac>('/drivers', { method: 'POST', body: data }),

  update: (id: number, data: Partial<Vozac>) =>
    request<Vozac>(`/drivers/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) => request<void>(`/drivers/${id}`, { method: 'DELETE' }),
}

export const regionsApi = {
  list: () => request<Regija[]>('/regions'),

  tree: () => request<RegijaTree[]>('/regions/tree'),

  create: (data: Partial<Regija>) =>
    request<Regija>('/regions', { method: 'POST', body: data }),

  update: (id: number, data: Partial<Regija>) =>
    request<Regija>(`/regions/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) => request<void>(`/regions/${id}`, { method: 'DELETE' }),

  listPostalCodes: () => request<PostanskiBroj[]>('/postal-codes'),

  createPostalCode: (data: Partial<PostanskiBroj>) =>
    request<PostanskiBroj>('/postal-codes', { method: 'POST', body: data }),

  updatePostalCode: (id: number, data: Partial<PostanskiBroj>) =>
    request<PostanskiBroj>(`/postal-codes/${id}`, { method: 'PUT', body: data }),

  deletePostalCode: (id: number) => request<void>(`/postal-codes/${id}`, { method: 'DELETE' }),

  bulkReassign: (postalCodeIds: number[], targetRegijaId: number) =>
    request<{ updated_postal_codes: number; updated_orders: number }>('/postal-codes/bulk-reassign', {
      method: 'POST',
      body: { postal_code_ids: postalCodeIds, target_regija_id: targetRegijaId },
    }),

  importRegions: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/regions/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(err.detail || 'Import nije uspio')
    }
    return response.json() as Promise<ImportRegionsResult>
  },
}

export const routesApi = {
  list: (params?: {
    datum_od?: string
    datum_do?: string
    status?: string
    vozilo_id?: number
    limit?: number
    offset?: number
  }) => request<RouteListItem[]>('/routes', { params }),

  get: (id: number) => request<Route>(`/routes/${id}`),

  create: (data: CreateRouteRequest) =>
    request<Route>('/routes', { method: 'POST', body: data }),

  updateStatus: (id: number, status: string) =>
    request<Route>(`/routes/${id}/status`, { method: 'PUT', body: { status } }),

  reorder: (id: number, newOrder: string[]) =>
    request<Route>(`/routes/${id}/reorder`, { method: 'PUT', body: { new_order: newOrder } }),

  optimize: (id: number, algoritam: string = 'nearest_neighbor') =>
    request<Route>(`/routes/${id}/optimize`, { method: 'POST', body: { algoritam } }),

  delete: (id: number) => request<void>(`/routes/${id}`, { method: 'DELETE' }),

  updateStopStatus: (routeId: number, stopId: number, newStatus: string) =>
    request<{
      stop: { id: number; nalog_uid: string; redoslijed: number; eta: string | null; status: string }
      route_status: string
      route_auto_completed: boolean
      summary: { total: number; delivered: number; failed: number; skipped: number; pending: number }
    }>(`/routes/${routeId}/stops/${stopId}/status`, {
      method: 'PUT',
      body: { status: newStatus },
    }),

  exportExcel: (id: number) => `${API_BASE}/routes/${id}/export/excel`,
  exportPdf: (id: number) => `${API_BASE}/routes/${id}/export/pdf`,

  listDrivers: (warehouseId?: number) =>
    request<{ id: number; username: string; full_name: string; warehouse_id: number | null }[]>(
      '/available-drivers',
      { params: warehouseId != null ? { warehouse_id: warehouseId } : undefined },
    ),

  assignDriver: (routeId: number, driverUserId: number | null) =>
    request<{ route_id: number; driver_user_id: number | null; driver_name: string | null }>(
      `/routes/${routeId}/assign-driver`,
      { method: 'PUT', body: { driver_user_id: driverUserId } },
    ),
}

export const routingOrdersApi = {
  prebaciURutiranje: (nalogUids: string[]) =>
    request<{ prebaceno: number; vec_u_rutiranju: number }>('/routing/prebaci-u-rutiranje', {
      method: 'POST',
      body: { nalog_uids: nalogUids },
    }),

  vratiIzRutiranja: (nalogUids: string[]) =>
    request<{ vraceno: number }>('/routing/vrati-iz-rutiranja', {
      method: 'POST',
      body: { nalog_uids: nalogUids },
    }),

  listRutiranjeNalogi: () =>
    request<RutiranjeNalog[]>('/routing/rutiranje-nalozi'),

  getRutiranjeUids: () =>
    request<string[]>('/routing/rutiranje-uids'),

  arhiviraj: (rutaId: number) =>
    request<{ arhivirano: number }>('/routing/arhiviraj', {
      method: 'POST',
      body: { ruta_id: rutaId },
    }),

  prerutiraj: (nalogUids: string[]) =>
    request<{ prerutirano: number }>('/routing/prerutiraj', {
      method: 'POST',
      body: { nalog_uids: nalogUids },
    }),

  obradiRutu: (rutaId: number) =>
    request<{ arhivirano: number; prerutirano: number; message: string }>('/routing/obradi-rutu', {
      method: 'POST',
      body: { ruta_id: rutaId },
    }),

  vratiStop: (rutaId: number, nalogUid: string, destination: 'nalozi' | 'rutiranje') =>
    request<{ status: string; destination: string; nalog_uid: string }>('/routing/vrati-stop', {
      method: 'POST',
      body: { ruta_id: rutaId, nalog_uid: nalogUid, destination },
    }),
}

export const mapsApi = {
  geocode: (address: string) =>
    request<GeocodingResponse>('/geocode', { method: 'POST', body: { address } }),

  distance: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    request<DistanceResponse>('/distance', {
      method: 'POST',
      body: { origin_lat: originLat, origin_lng: originLng, dest_lat: destLat, dest_lng: destLng },
    }),

  geocodeOrders: (nalogUids: string[]) =>
    request<GeocodeOrderResult[]>('/geocode-orders', {
      method: 'POST',
      body: { nalog_uids: nalogUids },
    }),

  getProvider: () => request<ProviderInfo>('/provider'),

  setProvider: (provider: string) =>
    request<ProviderInfo>(`/provider?provider=${provider}`, { method: 'PUT' }),

  getFailedGeocoding: () =>
    request<{ id: number; address: string; provider: string | null; updated_at: string | null }[]>('/geocode/failed'),

  retryFailedGeocoding: () =>
    request<{ retried: number; fixed: number; still_failed: number }>('/geocode/retry-failed', { method: 'POST' }),

  setManualCoordinates: (cacheId: number, lat: number, lng: number) =>
    request<{ id: number; address: string; lat: number; lng: number; old_lat: number | null; old_lng: number | null; provider: string }>(
      `/geocode/manual/${cacheId}?lat=${lat}&lng=${lng}`, { method: 'PUT' }
    ),

  deleteGeocodingCache: (cacheId: number) =>
    request<{ deleted: boolean; address: string }>(`/geocode/cache/${cacheId}`, { method: 'DELETE' }),

  searchGeocodingCache: (q: string, limit = 50) =>
    request<{ id: number; address: string; lat: number | null; lng: number | null; provider: string | null; updated_at: string | null }[]>(
      `/geocode/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
}

export const syncApi = {
  syncOrders: (data?: { statusi?: string[]; datum_od?: string; datum_do?: string }) =>
    request<SyncResponse>('/sync/orders', { method: 'POST', body: data || {} }),

  refreshOrders: (data?: { datum_od?: string }) =>
    request<SyncResponse>('/sync/refresh-orders', { method: 'POST', body: data || {} }),

  syncPartners: () => request<SyncResponse>('/sync/partners', { method: 'POST' }),

  syncArtikli: () => request<SyncResponse>('/sync/artikli', { method: 'POST' }),

  status: (syncId: number) => request<SyncResponse>(`/sync/status/${syncId}`),
}

export const itemsApi = {
  listArtikli: (params?: {
    search?: string
    grupa_artikla_uid?: string
    limit?: number
    offset?: number
  }) => request<Artikl[]>('/artikli', { params }),

  listGrupeArtikala: () => request<GrupaArtikla[]>('/grupe-artikala'),

  listKriterije: () => request<KriterijaSku[]>('/kriterije-sku'),
  createKriterija: (data: { naziv: string; opis?: string }) =>
    request<KriterijaSku>('/kriterije-sku', { method: 'POST', body: data }),
  updateKriterija: (id: number, data: { naziv?: string; opis?: string }) =>
    request<KriterijaSku>(`/kriterije-sku/${id}`, { method: 'PUT', body: data }),
  deleteKriterija: (id: number) =>
    request<void>(`/kriterije-sku/${id}`, { method: 'DELETE' }),

  listArtikliKriterija: () => request<ArtiklKriterija[]>('/artikli-kriterija'),
  createArtiklKriterija: (data: { artikl: string; kriterija_id: number }) =>
    request<ArtiklKriterija>('/artikli-kriterija', { method: 'POST', body: data }),
  deleteArtiklKriterija: (id: number) =>
    request<void>(`/artikli-kriterija/${id}`, { method: 'DELETE' }),
  getArtiklSifreWithCriteria: () => request<string[]>('/artikli-kriterija/artikl-sifre'),

  importArtikliKriterija: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/artikli-kriterija/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(err.detail || 'Import nije uspio')
    }
    return response.json() as Promise<{ imported: number; skipped: number; errors: string[] }>
  },
}

export const settingsApi = {
  list: () => request<Setting[]>('/settings'),
  get: (key: string) => request<Setting>(`/settings/${key}`),
  create: (data: { key: string; value: string | null }) =>
    request<Setting>('/settings', { method: 'POST', body: data }),
  update: (key: string, value: string | null) =>
    request<Setting>(`/settings/${key}`, { method: 'PUT', body: { value } }),
  bulkUpdate: (settings: Record<string, string | null>) =>
    request<Setting[]>('/settings', { method: 'PUT', body: { settings } }),
  delete: (key: string) => request<void>(`/settings/${key}`, { method: 'DELETE' }),
}

export const prioritetiApi = {
  list: () => request<Prioritet[]>('/prioriteti'),
  get: (id: number) => request<Prioritet>(`/prioriteti/${id}`),
  create: (data: Partial<Prioritet>) =>
    request<Prioritet>('/prioriteti', { method: 'POST', body: data }),
  update: (id: number, data: Partial<Prioritet>) =>
    request<Prioritet>(`/prioriteti/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => request<void>(`/prioriteti/${id}`, { method: 'DELETE' }),
}

export const statusiApi = {
  list: () => request<StatusNaloga[]>('/statusi'),
  get: (id: string) => request<StatusNaloga>(`/statusi/${id}`),
  create: (data: Partial<StatusNaloga>) =>
    request<StatusNaloga>('/statusi', { method: 'POST', body: data }),
  update: (id: string, data: Partial<StatusNaloga>) =>
    request<StatusNaloga>(`/statusi/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => request<void>(`/statusi/${id}`, { method: 'DELETE' }),
}

export const healthApi = {
  check: () => request<{ status: string }>('/health'),
}

export const mantisApi = {
  sync: (nalogUids?: string[]) =>
    request<{ status: string; synced_orders?: number; total_items?: number; total_pallets?: number }>(
      '/mantis/sync',
      { method: 'POST', body: nalogUids ? { nalog_uids: nalogUids } : {} }
    ),

  getOrder: (nalogUid: string, forceRefresh = false) =>
    request<MantisOrderSummary>(
      `/mantis/order/${nalogUid}${forceRefresh ? '?force_refresh=true' : ''}`
    ),

  getOrdersBulk: (nalogUids: string[]) =>
    request<Record<string, MantisOrderSummary>>(
      '/mantis/orders/bulk',
      { method: 'POST', body: { nalog_uids: nalogUids } }
    ),

  getRoutePallets: (rutaId: number) =>
    request<{ total_pallets: number; per_stop: Record<string, number> }>(
      `/mantis/route/${rutaId}/pallets`
    ),
}

export interface AuthUser {
  id: number
  username: string
  ime: string | null
  prezime: string | null
  email: string | null
  full_name: string
  role: string | null
  warehouse_id: number | null
  permissions: string[]
  force_password_change: boolean
}

export const authApi = {
  login: (username: string, password: string, remember_me = false) =>
    request<{ message: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { username, password, remember_me },
    }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<{ message: string }>('/auth/refresh', { method: 'POST' }),
  me: () => request<AuthUser>('/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: { current_password, new_password },
    }),
}

export const userPreferencesApi = {
  getAll: () =>
    request<{ pref_key: string; pref_value: string }[]>('/user-preferences'),

  get: (key: string) =>
    request<{ pref_key: string; pref_value: string } | null>(`/user-preferences/${encodeURIComponent(key)}`),

  set: (key: string, value: string) =>
    request<{ pref_key: string; pref_value: string }>(`/user-preferences/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { pref_value: value },
    }),

  bulkSet: (prefs: { pref_key: string; pref_value: string }[]) =>
    request<{ pref_key: string; pref_value: string }[]>('/user-preferences', {
      method: 'PUT',
      body: prefs,
    }),

  delete: (key: string) =>
    request<{ ok: boolean }>(`/user-preferences/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),
}

export const podApi = {
  list: (q?: string, rutaId?: number, limit = 50, offset = 0) =>
    request<unknown[]>('/pod/list', {
      params: { q, ruta_id: rutaId, limit, offset },
    }),

  detail: (podId: number) => request<unknown>(`/pod/detail/${podId}`),

  sendToLuceed: (podId: number) =>
    request<{ success: boolean; message: string; file_uids: string[] }>(
      `/pod/send-to-luceed/${podId}`,
      { method: 'POST' },
    ),
}
