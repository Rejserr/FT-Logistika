import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RouteStop } from '../../types'
import { useRoutingStore } from '../../store/routingStore'
import { routesApi } from '../../services/api'
import { toast } from '../common'
import GeoEditModal from './GeoEditModal'
import './RouteStopList.css'

const STOP_STATUSES = {
  PENDING: { label: 'Na čekanju', icon: '⏳', color: '#f59e0b' },
  ARRIVED: { label: 'Stigao', icon: '📍', color: '#3b82f6' },
  DELIVERED: { label: 'Dostavljeno', icon: '✅', color: '#10b981' },
  FAILED: { label: 'Neuspjelo', icon: '❌', color: '#ef4444' },
  SKIPPED: { label: 'Preskočeno', icon: '⏭️', color: '#6b7280' },
} as const

interface SortableStopProps {
  stop: RouteStop
  index: number
  isHighlighted: boolean
  routeId: number
  routeStatus: string | null
  onHighlight: (id: number) => void
  onDoubleClick: (stop: RouteStop) => void
  onStatusChange: (stopId: number, status: string) => void
  isUpdating: boolean
}

function SortableStop({
  stop,
  index,
  isHighlighted,
  routeStatus,
  onHighlight,
  onDoubleClick,
  onStatusChange,
  isUpdating,
}: SortableStopProps) {
  const [showActions, setShowActions] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const statusInfo = STOP_STATUSES[stop.status as keyof typeof STOP_STATUSES] || STOP_STATUSES.PENDING
  const isDeliveryActive = routeStatus === 'IN_PROGRESS' || routeStatus === 'PLANNED'
  const isDone = stop.status === 'DELIVERED' || stop.status === 'FAILED' || stop.status === 'SKIPPED'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`stop-item ${isDragging ? 'is-dragging' : ''} ${isHighlighted ? 'is-highlighted' : ''} stop-status-${(stop.status || 'PENDING').toLowerCase()}`}
      onClick={() => onHighlight(stop.id)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(stop) }}
      title="Dvostruki klik za korekciju lokacije"
    >
      <div className="stop-drag-handle" {...attributes} {...listeners}>
        <span className="drag-icon">⋮⋮</span>
      </div>

      <div className={`stop-number stop-number-${(stop.status || 'PENDING').toLowerCase()}`}>
        {isDone ? statusInfo.icon : index + 1}
      </div>

      <div className="stop-content">
        <div className="stop-name">{stop.partner_naziv || 'Nepoznat partner'}</div>
        <div className="stop-address">
          {stop.partner_adresa && `${stop.partner_adresa}, `}
          {stop.partner_mjesto || ''}
        </div>
        <div className="stop-meta-row">
          {stop.eta && (
            <span className="stop-eta">
              ETA: {new Date(stop.eta).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span className={`stop-status-badge status-badge-${(stop.status || 'PENDING').toLowerCase()}`}>
            {statusInfo.icon} {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {isDeliveryActive && (
        <div className="stop-actions-container">
          {!showActions ? (
            <button
              className="stop-action-toggle"
              onClick={(e) => { e.stopPropagation(); setShowActions(true) }}
              title="Prikaži opcije dostave"
            >
              •••
            </button>
          ) : (
            <div className="stop-actions-menu" onClick={(e) => e.stopPropagation()}>
              {stop.status !== 'DELIVERED' && (
                <button
                  className="stop-action-btn action-delivered"
                  onClick={() => { onStatusChange(stop.id, 'DELIVERED'); setShowActions(false) }}
                  disabled={isUpdating}
                  title="Označi kao dostavljeno"
                >
                  ✅
                </button>
              )}
              {stop.status !== 'FAILED' && (
                <button
                  className="stop-action-btn action-failed"
                  onClick={() => { onStatusChange(stop.id, 'FAILED'); setShowActions(false) }}
                  disabled={isUpdating}
                  title="Označi kao neuspjelo"
                >
                  ❌
                </button>
              )}
              {stop.status !== 'SKIPPED' && (
                <button
                  className="stop-action-btn action-skipped"
                  onClick={() => { onStatusChange(stop.id, 'SKIPPED'); setShowActions(false) }}
                  disabled={isUpdating}
                  title="Preskoči dostavu"
                >
                  ⏭️
                </button>
              )}
              {stop.status !== 'PENDING' && (
                <button
                  className="stop-action-btn action-reset"
                  onClick={() => { onStatusChange(stop.id, 'PENDING'); setShowActions(false) }}
                  disabled={isUpdating}
                  title="Vrati na čekanje"
                >
                  ↩️
                </button>
              )}
              <button
                className="stop-action-btn action-close"
                onClick={() => setShowActions(false)}
                title="Zatvori"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

interface RouteStopListProps {
  stops: RouteStop[]
  routeId?: number
  routeStatus?: string | null
  onReorder: (newOrder: string[]) => void
}

export default function RouteStopList({ stops, routeId, routeStatus, onReorder }: RouteStopListProps) {
  const { highlightedStopId, setHighlightedStop } = useRoutingStore()
  const [items, setItems] = useState(stops)
  const [geoEditStop, setGeoEditStop] = useState<RouteStop | null>(null)
  const queryClient = useQueryClient()

  const updateStopMutation = useMutation({
    mutationFn: ({ stopId, status }: { stopId: number; status: string }) =>
      routesApi.updateStopStatus(routeId!, stopId, status),
    onSuccess: (data: any) => {
      const stopResult = data.stop
      const summary = data.summary

      // Ažuriraj lokalni state
      setItems(prev =>
        prev.map(s => s.id === stopResult.id ? { ...s, status: stopResult.status } : s)
      )

      // Status feedback
      const statusInfo = STOP_STATUSES[stopResult.status as keyof typeof STOP_STATUSES]
      if (statusInfo) {
        toast.success(`${statusInfo.icon} ${statusInfo.label} (${summary.delivered}/${summary.total} dostavljeno)`)
      }

      // Auto-complete notification
      if (data.route_auto_completed) {
        if (data.auto_archived && data.auto_archived > 0) {
          toast.success(`🎉 Ruta završena! ${data.auto_archived} naloga automatski arhivirano.`)
        } else {
          toast.success('🎉 Svi stopovi obrađeni — ruta je automatski završena!')
        }
      }

      // Osvježi rutu
      queryClient.invalidateQueries({ queryKey: ['route', String(routeId)] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['rutiranje-nalozi'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id)
        const newIndex = currentItems.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(currentItems, oldIndex, newIndex)
        onReorder(newItems.map((item) => item.nalog_uid))
        return newItems
      })
    }
  }

  const handleStatusChange = (stopId: number, status: string) => {
    if (!routeId) return
    updateStopMutation.mutate({ stopId, status })
  }

  // Izračunaj progress
  const completedStatuses = new Set(['DELIVERED', 'FAILED', 'SKIPPED'])
  const done = items.filter(s => completedStatuses.has(s.status || '')).length
  const delivered = items.filter(s => s.status === 'DELIVERED').length
  const total = items.length
  const progressPct = total > 0 ? (done / total) * 100 : 0

  if (items.length === 0) {
    return (
      <div className="stop-list-empty">
        <p>Nema stopova na ruti</p>
      </div>
    )
  }

  const isDeliveryActive = routeStatus === 'IN_PROGRESS' || routeStatus === 'PLANNED'

  return (
    <div className="stop-list-container">
      <div className="stop-list-header">
        <span>{items.length} stopova</span>
        <span className="drag-hint">Povuci za promjenu redoslijeda</span>
      </div>

      {/* Progress bar */}
      {isDeliveryActive && total > 0 && (
        <div className="stop-progress-section">
          <div className="stop-progress-bar">
            <div
              className="stop-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="stop-progress-stats">
            <span className="progress-stat delivered">✅ {delivered}</span>
            <span className="progress-stat failed">❌ {items.filter(s => s.status === 'FAILED').length}</span>
            <span className="progress-stat skipped">⏭️ {items.filter(s => s.status === 'SKIPPED').length}</span>
            <span className="progress-stat pending">⏳ {total - done}</span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="stop-list">
            {items.map((stop, index) => (
              <SortableStop
                key={stop.id}
                stop={stop}
                index={index}
                isHighlighted={highlightedStopId === stop.id}
                routeId={routeId || 0}
                routeStatus={routeStatus || null}
                onHighlight={setHighlightedStop}
                onDoubleClick={setGeoEditStop}
                onStatusChange={handleStatusChange}
                isUpdating={updateStopMutation.isPending}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {geoEditStop && (
        <GeoEditModal
          address={[geoEditStop.partner_adresa, geoEditStop.partner_mjesto].filter(Boolean).join(', ')}
          currentLat={geoEditStop.lat}
          currentLng={geoEditStop.lng}
          partnerName={geoEditStop.partner_naziv || 'Nepoznat partner'}
          onClose={() => setGeoEditStop(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  )
}
