import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Header } from '../components/layout'
import { Card, Button, toast } from '../components/common'
import { RouteStopList, MapView } from '../components/routing'
import { routesApi, routingOrdersApi } from '../services/api'
import { useRoutingStore } from '../store/routingStore'
import { useEffect } from 'react'
import type { RouteStop } from '../types'
import './RouteDetailPage.css'

export default function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setActiveRoute } = useRoutingStore()
  const [returningStop, setReturningStop] = useState<string | null>(null)
  const [showDriverModal, setShowDriverModal] = useState(false)

  const { data: route, isLoading } = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => routesApi.get(Number(routeId)),
    enabled: !!routeId,
  })

  // Postavi aktivnu rutu za MapView
  useEffect(() => {
    if (route) {
      setActiveRoute(route)
    }
    return () => setActiveRoute(null)
  }, [route, setActiveRoute])

  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['drivers', showDriverModal],
    queryFn: () => routesApi.listDrivers(),
    enabled: showDriverModal,
    staleTime: 0,
    gcTime: 0,
  })

  const assignDriverMutation = useMutation({
    mutationFn: (driverUserId: number | null) =>
      routesApi.assignDriver(Number(routeId), driverUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      setShowDriverModal(false)
      toast.success('Vozač dodijeljen', data.driver_name || 'Vozač uklonjen s rute')
    },
    onError: (err: Error) => {
      toast.error('Greška', err.message)
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => routesApi.updateStatus(Number(routeId), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (newOrder: string[]) => routesApi.reorder(Number(routeId), newOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
    },
  })

  const optimizeMutation = useMutation({
    mutationFn: (algoritam: string) => routesApi.optimize(Number(routeId), algoritam),
    onSuccess: (newRoute) => {
      navigate(`/routes/${newRoute.id}`)
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => routesApi.delete(Number(routeId)),
    onSuccess: () => {
      navigate('/routes')
    },
  })

  // Obradi završenu rutu (arhivaj + vrati neuspjele)
  const obradiRutuMutation = useMutation({
    mutationFn: () => routingOrdersApi.obradiRutu(Number(routeId)),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  // Vrati pojedinačni stop
  const vratiStopMutation = useMutation({
    mutationFn: ({ nalogUid, destination }: { nalogUid: string; destination: 'nalozi' | 'rutiranje' }) =>
      routingOrdersApi.vratiStop(Number(routeId), nalogUid, destination),
    onSuccess: (data) => {
      const destLabel = data.destination === 'nalozi' ? 'naloge' : 'rutiranje'
      toast.success(`Nalog vraćen u ${destLabel}`)
      setReturningStop(null)
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const handleReorder = (newOrder: string[]) => {
    reorderMutation.mutate(newOrder)
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'DRAFT': return 'Nacrt'
      case 'PLANNED': return 'Planirano'
      case 'IN_PROGRESS': return 'U tijeku'
      case 'COMPLETED': return 'Završeno'
      case 'CANCELLED': return 'Otkazano'
      default: return status || '—'
    }
  }

  if (isLoading) {
    return (
      <div className="route-detail-page">
        <Header title="Učitavanje..." />
        <Card>
          <div className="loading-state">Učitavanje detalja rute...</div>
        </Card>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="route-detail-page">
        <Header title="Ruta nije pronađena" />
        <Card>
          <div className="empty-state">
            <p>Ruta s ID {routeId} nije pronađena.</p>
            <Link to="/routes">
              <Button>Povratak na listu</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // Izračunaj statistike za completed rutu
  const deliveredStops = route.stops.filter((s: RouteStop) => s.status === 'DELIVERED')
  const failedStops = route.stops.filter((s: RouteStop) => s.status === 'FAILED')
  const skippedStops = route.stops.filter((s: RouteStop) => s.status === 'SKIPPED')
  const undeliveredStops = [...failedStops, ...skippedStops]
  const isCompleted = route.status === 'COMPLETED'
  const hasUndelivered = undeliveredStops.length > 0

  return (
    <div className="route-detail-page">
      <Header
        title={`Ruta #${route.id}`}
        subtitle={`${route.datum || 'Bez datuma'} - ${getStatusLabel(route.status)}`}
        actions={
          <div className="header-actions">
            <Link to="/routes">
              <Button variant="ghost">Povratak</Button>
            </Link>
            {route.status !== 'COMPLETED' && (
              <Button variant="secondary" onClick={() => setShowDriverModal(true)}>
                Vozači
              </Button>
            )}
            {route.status === 'DRAFT' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => optimizeMutation.mutate('ortools')}
                  isLoading={optimizeMutation.isPending}
                >
                  Re-optimiziraj
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate('PLANNED')}
                  isLoading={updateStatusMutation.isPending}
                >
                  Potvrdi rutu
                </Button>
              </>
            )}
            {route.status === 'PLANNED' && (
              <Button
                onClick={() => updateStatusMutation.mutate('IN_PROGRESS')}
                isLoading={updateStatusMutation.isPending}
              >
                Pokreni dostavu
              </Button>
            )}
            {route.status === 'IN_PROGRESS' && (
              <Button
                onClick={() => updateStatusMutation.mutate('COMPLETED')}
                isLoading={updateStatusMutation.isPending}
              >
                Završi rutu
              </Button>
            )}
            {isCompleted && hasUndelivered && (
              <Button
                onClick={() => {
                  if (confirm(
                    `Obraditi nedostavljene naloge s rute #${route.id}?\n\n` +
                    `❌ ${failedStops.length} neuspjelih → Natrag u rutiranje\n` +
                    `⏭️ ${skippedStops.length} preskočenih → Natrag u rutiranje`
                  )) {
                    obradiRutuMutation.mutate()
                  }
                }}
                isLoading={obradiRutuMutation.isPending}
              >
                Obradi nedostavljene
              </Button>
            )}
            <a href={routesApi.exportExcel(Number(routeId))} download>
              <Button variant="secondary">Excel</Button>
            </a>
            <a href={routesApi.exportPdf(Number(routeId))} download>
              <Button variant="secondary">PDF</Button>
            </a>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Jeste li sigurni da želite obrisati rutu?')) {
                  deleteMutation.mutate()
                }
              }}
              isLoading={deleteMutation.isPending}
            >
              Obriši
            </Button>
          </div>
        }
      />

      <div className="route-detail-layout">
        <div className="route-info-section">
          <Card title="Informacije o ruti">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className={`status-badge status-${route.status}`}>
                  {getStatusLabel(route.status)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Algoritam</span>
                <span className="info-value">{route.algoritam || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Vozilo</span>
                <span className="info-value">{route.vozilo_oznaka || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Vozač</span>
                <span className="info-value" style={route.driver_name ? { color: '#059669', fontWeight: 600 } : undefined}>
                  {route.driver_name || '—'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Udaljenost</span>
                <span className="info-value">{route.distance_km?.toFixed(1) || '—'} km</span>
              </div>
              <div className="info-item">
                <span className="info-label">Trajanje</span>
                <span className="info-value">{route.duration_min || '—'} min</span>
              </div>
              <div className="info-item">
                <span className="info-label">Broj stopova</span>
                <span className="info-value">{route.stops.length}</span>
              </div>
              {isCompleted && (
                <>
                  <div className="info-item">
                    <span className="info-label">Dostavljeno</span>
                    <span className="info-value" style={{ color: '#059669', fontWeight: 600 }}>
                      ✅ {deliveredStops.length}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Neuspjelo</span>
                    <span className="info-value" style={{ color: undeliveredStops.length > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                      {undeliveredStops.length > 0 ? `❌ ${failedStops.length} / ⏭️ ${skippedStops.length}` : '0'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Sekcija za neuspjele naloge na završenoj ruti */}
          {isCompleted && hasUndelivered && (
            <Card title={`Nedostavljeni nalozi (${undeliveredStops.length})`} className="undelivered-card">
              <div className="undelivered-info">
                Ovi nalozi nisu uspješno dostavljeni. Možete ih vratiti u rutiranje za novu rutu ili natrag u naloge.
              </div>
              <div className="undelivered-list">
                {undeliveredStops.map((stop: RouteStop) => (
                  <div key={stop.id} className={`undelivered-item status-${stop.status?.toLowerCase()}`}>
                    <div className="undelivered-item-info">
                      <span className="undelivered-status-icon">
                        {stop.status === 'FAILED' ? '❌' : '⏭️'}
                      </span>
                      <div>
                        <div className="undelivered-name">{stop.partner_naziv || 'Nepoznat'}</div>
                        <div className="undelivered-address">
                          {stop.partner_adresa && `${stop.partner_adresa}, `}
                          {stop.partner_mjesto || ''}
                        </div>
                      </div>
                    </div>
                    <div className="undelivered-actions">
                      {returningStop === stop.nalog_uid ? (
                        <div className="return-options">
                          <Button
                            size="sm"
                            onClick={() => vratiStopMutation.mutate({ nalogUid: stop.nalog_uid, destination: 'rutiranje' })}
                            isLoading={vratiStopMutation.isPending}
                          >
                            U rutiranje
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => vratiStopMutation.mutate({ nalogUid: stop.nalog_uid, destination: 'nalozi' })}
                            isLoading={vratiStopMutation.isPending}
                          >
                            U naloge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReturningStop(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setReturningStop(stop.nalog_uid)}
                        >
                          Vrati
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Stopovi" className="stops-card">
            <RouteStopList
              stops={route.stops}
              routeId={route.id}
              routeStatus={route.status}
              onReorder={handleReorder}
            />
          </Card>
        </div>

        <div className="route-map-section">
          <MapView />
        </div>
      </div>

      {showDriverModal && (
        <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
          <div className="driver-assign-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Dodjeli vozača</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px' }}>
              Odaberite vozača za rutu #{route.id}
            </p>
            {route.driver_name && (
              <div style={{
                padding: '8px 12px',
                background: '#ecfdf5',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '14px',
              }}>
                Trenutni vozač: <strong style={{ color: '#059669' }}>{route.driver_name}</strong>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {availableDrivers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => assignDriverMutation.mutate(d.id)}
                  disabled={assignDriverMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: route.driver_user_id === d.id ? '2px solid #059669' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background: route.driver_user_id === d.id ? '#ecfdf5' : '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (route.driver_user_id !== d.id) e.currentTarget.style.background = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    if (route.driver_user_id !== d.id) e.currentTarget.style.background = '#fff'
                  }}
                >
                  <span style={{ fontWeight: route.driver_user_id === d.id ? 600 : 400 }}>
                    {d.full_name}
                  </span>
                  {route.driver_user_id === d.id && (
                    <span style={{ color: '#059669', fontSize: '12px', fontWeight: 600 }}>Dodijeljen</span>
                  )}
                </button>
              ))}
              {availableDrivers.length === 0 && (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                  Nema dostupnih vozača
                </p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', gap: '8px' }}>
              {route.driver_name && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => assignDriverMutation.mutate(null)}
                  isLoading={assignDriverMutation.isPending}
                >
                  Ukloni vozača
                </Button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="ghost" onClick={() => setShowDriverModal(false)}>
                  Zatvori
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
