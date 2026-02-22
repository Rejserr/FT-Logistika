import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout'
import { Card, Button, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { routesApi } from '../services/api'
import type { RouteListItem } from '../types'
import './RoutesHistoryPage.css'

const COLUMNS: DataTableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'datum', label: 'Datum kreiranja' },
  { key: 'status', label: 'Status' },
  { key: 'stops_count', label: 'Stopovi' },
  { key: 'distance_km', label: 'Udaljenost (km)' },
  { key: 'duration_min', label: 'Trajanje (min)' },
  { key: 'vozilo', label: 'Vozilo' },
  { key: 'driver_name', label: 'Vozač' },
  { key: 'wms_paleta', label: 'Palete (WMS)' },
  { key: 'raspored', label: 'Datum dostave' },
]

function getStatusLabel(status: string | null): string {
  switch (status) {
    case 'DRAFT': return 'Nacrt'
    case 'PLANNED': return 'Planirano'
    case 'IN_PROGRESS': return 'U tijeku'
    case 'COMPLETED': return 'Završeno'
    case 'CANCELLED': return 'Otkazano'
    default: return status || '—'
  }
}

export default function RoutesHistoryPage() {
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesApi.list({ limit: 200 }),
  })

  return (
    <div className="routes-history-page">
      <Header
        title="Povijest ruta"
        subtitle="Pregled svih kreiranih ruta"
        actions={
          <Link to="/routing">
            <Button>Nova ruta</Button>
          </Link>
        }
      />

      <Card className="routes-table-card">
        <DataTable<RouteListItem>
          storageKey="ft-routes"
          columns={COLUMNS}
          data={routes}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="Nema ruta za prikaz."
          cellValue={(r, key) => {
            if (key === 'vozilo') return r.vozilo_oznaka || ''
            if (key === 'driver_name') return r.driver_name || ''
            if (key === 'raspored') return r.raspored || ''
            if (key === 'wms_paleta') return r.wms_paleta ?? 0
            return (r as unknown as Record<string, unknown>)[key]
          }}
          cellRenderer={(r, key) => {
            if (key === 'id') return `#${r.id}`
            if (key === 'status') {
              return (
                <span className={`status-badge status-${r.status}`}>
                  {getStatusLabel(r.status)}
                </span>
              )
            }
            if (key === 'distance_km') return r.distance_km?.toFixed(1) ?? '—'
            if (key === 'duration_min') return r.duration_min ?? '—'
            if (key === 'datum') return r.datum || '—'
            if (key === 'raspored') {
              if (!r.raspored) return '—'
              return <span style={{ fontWeight: 600, color: '#2563eb' }}>{r.raspored}</span>
            }
            if (key === 'vozilo') return r.vozilo_oznaka || '—'
            if (key === 'driver_name') {
              if (!r.driver_name) return '—'
              return <span style={{ fontWeight: 600, color: '#059669' }}>{r.driver_name}</span>
            }
            if (key === 'algoritam') return r.algoritam || '—'
            if (key === 'stops_count') return String(r.stops_count ?? 0)
            if (key === 'wms_paleta') return r.wms_paleta != null && r.wms_paleta > 0 ? String(r.wms_paleta) : '—'
            return String((r as unknown as Record<string, unknown>)[key] ?? '—')
          }}
          actions={(r) => (
            <Link to={`/routes/${r.id}`}>
              <Button size="sm" variant="ghost">Detalji</Button>
            </Link>
          )}
        />
      </Card>
    </div>
  )
}
