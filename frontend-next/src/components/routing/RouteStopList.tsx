"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/status-badge"
import { toast } from "@/lib/toast"
import { routesApi } from "@/services/api"
import { useRoutingStore } from "@/store/routingStore"
import type { RouteStop } from "@/types"
import {
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  SkipForward,
  RotateCcw,
  X,
  GripVertical,
} from "lucide-react"
import GeoEditModal from "./GeoEditModal"

const STOP_STATUSES: Record<
  string,
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  PENDING: {
    label: "Na čekanju",
    icon: <Clock className="h-3.5 w-3.5" />,
    colorClass: "text-amber-400",
  },
  ARRIVED: {
    label: "Stigao",
    icon: <MapPin className="h-3.5 w-3.5" />,
    colorClass: "text-blue-400",
  },
  DELIVERED: {
    label: "Dostavljeno",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    colorClass: "text-emerald-400",
  },
  FAILED: {
    label: "Neuspjelo",
    icon: <XCircle className="h-3.5 w-3.5" />,
    colorClass: "text-red-400",
  },
  SKIPPED: {
    label: "Preskočeno",
    icon: <SkipForward className="h-3.5 w-3.5" />,
    colorClass: "text-muted-foreground",
  },
}

function getStatusInfo(status: string | null) {
  return (
    STOP_STATUSES[status as keyof typeof STOP_STATUSES] ||
    STOP_STATUSES.PENDING
  )
}

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

  const statusInfo = getStatusInfo(stop.status)
  const isDeliveryActive = routeStatus === "IN_PROGRESS" || routeStatus === "PLANNED"
  const isDone =
    stop.status === "DELIVERED" ||
    stop.status === "FAILED" ||
    stop.status === "SKIPPED"

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors
        ${isDragging ? "opacity-60 shadow-lg" : ""}
        ${isHighlighted ? "ring-2 ring-primary bg-primary/5" : "bg-secondary/30 hover:bg-secondary/50"}
      `}
      onClick={() => onHighlight(stop.id)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick(stop)
      }}
      title="Dvostruki klik za korekciju lokacije"
    >
      <div
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold
          ${isDone ? statusInfo.colorClass : "bg-primary/20 text-primary"}
        `}
      >
        {isDone ? statusInfo.icon : index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">
          {stop.partner_naziv || "Nepoznat partner"}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {[stop.partner_adresa, stop.partner_mjesto].filter(Boolean).join(", ")}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {stop.eta && (
            <span className="text-muted-foreground">
              ETA:{" "}
              {new Date(stop.eta).toLocaleTimeString("hr-HR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <StatusBadge status={stop.status} className="text-[10px]" />
        </div>
      </div>

      {isDeliveryActive && (
        <div className="flex shrink-0 items-center">
          {!showActions ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                setShowActions(true)
              }}
              title="Prikaži opcije dostave"
            >
              <span className="text-muted-foreground">•••</span>
            </Button>
          ) : (
            <div
              className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary p-1"
              onClick={(e) => e.stopPropagation()}
            >
              {stop.status !== "DELIVERED" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/20"
                  onClick={() => {
                    onStatusChange(stop.id, "DELIVERED")
                    setShowActions(false)
                  }}
                  disabled={isUpdating}
                  title="Označi kao dostavljeno"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {stop.status !== "FAILED" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                  onClick={() => {
                    onStatusChange(stop.id, "FAILED")
                    setShowActions(false)
                  }}
                  disabled={isUpdating}
                  title="Označi kao neuspjelo"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {stop.status !== "SKIPPED" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-orange-400 hover:bg-orange-500/20"
                  onClick={() => {
                    onStatusChange(stop.id, "SKIPPED")
                    setShowActions(false)
                  }}
                  disabled={isUpdating}
                  title="Preskoči dostavu"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
              )}
              {stop.status !== "PENDING" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => {
                    onStatusChange(stop.id, "PENDING")
                    setShowActions(false)
                  }}
                  disabled={isUpdating}
                  title="Vrati na čekanje"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowActions(false)}
                title="Zatvori"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
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

export default function RouteStopList({
  stops,
  routeId,
  routeStatus,
  onReorder,
}: RouteStopListProps) {
  const { highlightedStopId, setHighlightedStop } = useRoutingStore()
  const [items, setItems] = useState(stops)
  const [geoEditStop, setGeoEditStop] = useState<RouteStop | null>(null)
  const queryClient = useQueryClient()

  const updateStopMutation = useMutation({
    mutationFn: ({ stopId, status }: { stopId: number; status: string }) =>
      routesApi.updateStopStatus(routeId!, stopId, status),
    onSuccess: (data: {
      stop: { id: number; status: string }
      summary: { total: number; delivered: number }
      route_auto_completed?: boolean
      auto_archived?: number
    }) => {
      const stopResult = data.stop
      const summary = data.summary
      setItems((prev) =>
        prev.map((s) =>
          s.id === stopResult.id ? { ...s, status: stopResult.status } : s
        )
      )
      const statusInfo = getStatusInfo(stopResult.status)
      toast.success(
        `${statusInfo.label}`,
        `${summary.delivered}/${summary.total} dostavljeno`
      )
      if (data.route_auto_completed) {
        toast.success(
          "Ruta završena!",
          data.auto_archived && data.auto_archived > 0
            ? `${data.auto_archived} naloga automatski arhivirano.`
            : "Svi stopovi obrađeni — ruta je automatski završena!"
        )
      }
      queryClient.invalidateQueries({ queryKey: ["route", String(routeId)] })
      queryClient.invalidateQueries({ queryKey: ["routes"] })
      queryClient.invalidateQueries({ queryKey: ["rutiranje-nalozi"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  const completedStatuses = new Set(["DELIVERED", "FAILED", "SKIPPED"])
  const done = items.filter((s) =>
    completedStatuses.has(s.status || "")
  ).length
  const delivered = items.filter((s) => s.status === "DELIVERED").length
  const total = items.length
  const progressPct = total > 0 ? (done / total) * 100 : 0
  const isDeliveryActive =
    routeStatus === "IN_PROGRESS" || routeStatus === "PLANNED"

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/30 p-6 text-center text-muted-foreground">
        Nema stopova na ruti
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{items.length} stopova</span>
        <span>Povuci za promjenu redoslijeda</span>
      </div>

      {isDeliveryActive && total > 0 && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-emerald-500/80 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-emerald-400">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              {delivered}
            </span>
            <span className="text-red-400">
              <XCircle className="mr-1 inline h-3 w-3" />
              {items.filter((s) => s.status === "FAILED").length}
            </span>
            <span className="text-orange-400">
              <SkipForward className="mr-1 inline h-3 w-3" />
              {items.filter((s) => s.status === "SKIPPED").length}
            </span>
            <span className="text-amber-400">
              <Clock className="mr-1 inline h-3 w-3" />
              {total - done}
            </span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {items.map((stop, index) => (
              <SortableStop
                key={stop.id}
                stop={stop}
                index={index}
                isHighlighted={highlightedStopId === stop.id}
                routeId={routeId || 0}
                routeStatus={routeStatus ?? null}
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
          open={!!geoEditStop}
          address={[geoEditStop.partner_adresa, geoEditStop.partner_mjesto]
            .filter(Boolean)
            .join(", ")}
          currentLat={geoEditStop.lat}
          currentLng={geoEditStop.lng}
          partnerName={geoEditStop.partner_naziv || "Nepoznat partner"}
          onClose={() => setGeoEditStop(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  )
}
