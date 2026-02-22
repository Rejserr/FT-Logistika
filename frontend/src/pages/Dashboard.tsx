import { useQuery, useMutation } from '@tanstack/react-query'
import { Header } from '../components/layout'
import { Card, Button, toast } from '../components/common'
import { ordersApi, vehiclesApi, routesApi, syncApi } from '../services/api'
import './Dashboard.css'

export default function Dashboard() {
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', { limit: 10 }],
    queryFn: () => ordersApi.list({ limit: 10 }),
  })

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehiclesApi.list,
  })

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['routes', { limit: 5 }],
    queryFn: () => routesApi.list({ limit: 5 }),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncApi.syncOrders(),
    onSuccess: () => {
      toast.success('Sinkronizacija pokrenuta', 'Nalozi se sinkroniziraju u pozadini')
    },
    onError: (error: Error) => {
      toast.error('Greska pri sinkronizaciji', error.message)
    },
  })

  const handleSyncOrders = () => {
    syncMutation.mutate()
  }

  const stats = [
    {
      label: 'Ukupno naloga',
      value: orders?.length ?? 0,
      icon: '📦',
      color: '#3b82f6',
    },
    {
      label: 'Aktivna vozila',
      value: vehicles?.filter((v) => v.aktivan).length ?? 0,
      icon: '🚚',
      color: '#10b981',
    },
    {
      label: 'Rute danas',
      value: routes?.length ?? 0,
      icon: '🗺️',
      color: '#f59e0b',
    },
    {
      label: 'Isporuceno',
      value: '—',
      icon: '✅',
      color: '#8b5cf6',
    },
  ]

  return (
    <div className="dashboard-page">
      <Header
        title="Dashboard"
        subtitle="Pregled stanja i brze akcije"
        actions={
          <Button onClick={handleSyncOrders}>Sync naloga</Button>
        }
      />

      <div className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card title="Zadnji nalozi" className="recent-orders">
          {ordersLoading ? (
            <p>Ucitavanje...</p>
          ) : orders && orders.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Broj</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.nalog_prodaje_uid}>
                    <td>{order.broj ?? '—'}</td>
                    <td>{order.korisnik__partner ?? order.partner ?? '—'}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status || '—'}
                      </span>
                    </td>
                    <td>{order.datum || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">Nema naloga. Pokrenite sinkronizaciju.</p>
          )}
        </Card>

        <Card title="Aktivne rute" className="active-routes">
          {routesLoading ? (
            <p>Ucitavanje...</p>
          ) : routes && routes.length > 0 ? (
            <ul className="route-list">
              {routes.map((route) => (
                <li key={route.id} className="route-item">
                  <div className="route-info">
                    <strong>Ruta #{route.id}</strong>
                    <span>{route.datum}</span>
                  </div>
                  <div className="route-meta">
                    <span>{route.stops_count} stopova</span>
                    <span className={`status-badge status-${route.status}`}>
                      {route.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Nema aktivnih ruta.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
