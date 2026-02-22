"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import type { LatLngExpression } from "leaflet"
import type { Route } from "@/types"
import { useRoutingStore } from "@/store/routingStore"

import "leaflet/dist/leaflet.css"

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  })
}

function createNumberedIcon(number: number, isHighlighted: boolean): L.DivIcon {
  const color = isHighlighted ? "#ef4444" : "#3b82f6"
  const size = isHighlighted ? 32 : 28
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: ${color};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: ${isHighlighted ? 14 : 12}px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function createPreviewIcon(number: number): L.DivIcon {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: #f59e0b;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 11px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

const depotIcon = L.divIcon({
  className: "depot-marker",
  html: `
    <div style="
      background: #10b981;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">D</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

interface TileConfig {
  url: string
  attribution: string
  maxZoom: number
  subdomains?: string
}

function FitBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [positions, map])
  return null
}

function ResizeObserverHook() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
  return null
}

interface MapViewInnerProps {
  activeRoute: Route | null
  depotCenter: LatLngExpression
  tile: TileConfig
  defaultCenter: LatLngExpression
  defaultZoom: number
}

export function MapViewInner({
  activeRoute,
  depotCenter,
  tile,
  defaultCenter,
  defaultZoom,
}: MapViewInnerProps) {
  const { highlightedStopId, setHighlightedStop, previewMarkers } = useRoutingStore()

  const { routeMarkers, routePositions, routeDepot, routePolyline } = useMemo(() => {
    const markers: Array<{
      position: LatLngExpression
      label: string
      stopId: number
      number: number
      isHighlighted: boolean
    }> = []
    const positions: LatLngExpression[] = []
    let depot: LatLngExpression | null = null
    let polyline: LatLngExpression[] | null = null

    if (activeRoute?.stops) {
      depot = depotCenter
      activeRoute.stops.forEach((stop, index) => {
        if (stop.lat && stop.lng) {
          const position: LatLngExpression = [stop.lat, stop.lng]
          markers.push({
            position,
            label: stop.partner_naziv || `Stop ${index + 1}`,
            stopId: stop.id,
            number: index + 1,
            isHighlighted: highlightedStopId === stop.id,
          })
          positions.push(position)
        }
      })
      if (depot && positions.length > 0) positions.unshift(depot)
      if (activeRoute.polyline && activeRoute.polyline.length >= 2) {
        polyline = activeRoute.polyline as LatLngExpression[]
      }
    }
    return {
      routeMarkers: markers,
      routePositions: positions,
      routeDepot: depot,
      routePolyline: polyline,
    }
  }, [activeRoute, highlightedStopId, depotCenter])

  const previewData = useMemo(() => {
    if (activeRoute || !previewMarkers?.length) return []
    return previewMarkers
      .filter((m) => m.lat && m.lng)
      .map((m, i) => ({
        position: [m.lat!, m.lng!] as LatLngExpression,
        label: m.kupac || m.address || `Nalog ${i + 1}`,
        number: i + 1,
        nalogProdaje: m.nalog_prodaje,
        address: m.address,
        demandKg: m.demand_kg ?? 0,
        demandM3: m.demand_m3 ?? 0,
      }))
  }, [previewMarkers, activeRoute])

  const allPositions = useMemo(() => {
    if (activeRoute) {
      const p = routeMarkers.map((m) => m.position)
      if (routeDepot) p.unshift(routeDepot)
      return p
    }
    return previewData.map((m) => m.position)
  }, [routeMarkers, routeDepot, activeRoute, previewData])

  const hasContent = !!activeRoute || previewData.length > 0

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom
      className="h-full w-full rounded-b-lg z-[1]"
      style={{ minHeight: 400 }}
    >
      <ResizeObserverHook />
      <TileLayer
        attribution={tile.attribution}
        url={tile.url}
        maxZoom={tile.maxZoom}
        {...(tile.subdomains ? { subdomains: tile.subdomains } : {})}
      />

      {routeDepot && activeRoute && (
        <Marker position={routeDepot} icon={depotIcon}>
          <Popup>
            <div className="text-sm">
              <strong>Depot / Skladište</strong>
              <p className="text-muted-foreground">Početna lokacija rute</p>
            </div>
          </Popup>
        </Marker>
      )}

      {routeMarkers.map((marker) => (
        <Marker
          key={marker.stopId}
          position={marker.position}
          icon={createNumberedIcon(marker.number, marker.isHighlighted)}
          eventHandlers={{ click: () => setHighlightedStop(marker.stopId) }}
        >
          <Popup>
            <div className="text-sm">
              <strong>Stop {marker.number}</strong>
              <p>{marker.label}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {previewData.map((marker, idx) => (
        <Marker
          key={`preview-${idx}`}
          position={marker.position}
          icon={createPreviewIcon(marker.number)}
        >
          <Popup>
            <div className="text-sm">
              <strong>{marker.nalogProdaje || `Nalog ${marker.number}`}</strong>
              <p>{marker.label}</p>
              {marker.address && (
                <p className="text-xs text-muted-foreground">{marker.address}</p>
              )}
              <p className="text-xs">
                {marker.demandKg.toFixed(1)} kg / {marker.demandM3.toFixed(3)} m³
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {(routePolyline || routePositions).length > 1 && (
        <Polyline
          positions={routePolyline || routePositions}
          color="#3b82f6"
          weight={routePolyline ? 5 : 4}
          opacity={0.8}
          dashArray={routePolyline ? undefined : "10, 10"}
        />
      )}

      {allPositions.length > 0 && <FitBounds positions={allPositions} />}

      {!hasContent && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-secondary/60 rounded-b-lg">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Odaberite naloge za prikaz na mapi</p>
          </div>
        </div>
      )}
    </MapContainer>
  )
}
