"use client"

import { useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { useRoutingStore } from "@/store/routingStore"
import { settingsApi, mapsApi } from "@/services/api"
import type { Setting, ProviderInfo } from "@/types"
import type { LatLngExpression } from "leaflet"

const DEFAULT_CENTER: LatLngExpression = [45.815, 15.9819]
const DEFAULT_ZOOM = 8

interface TileConfig {
  url: string
  attribution: string
  maxZoom: number
  subdomains?: string
}

function getTileConfig(provider: string, tomtomKey?: string): TileConfig {
  switch (provider) {
    case "tomtom":
      return {
        url: `https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey || ""}&tileSize=256&language=NGT-Latn`,
        attribution: "&copy; <a href='https://www.tomtom.com'>TomTom</a>",
        maxZoom: 22,
        subdomains: "abcd",
      }
    case "tomtom-night":
      return {
        url: `https://{s}.api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${tomtomKey || ""}&tileSize=256&language=NGT-Latn`,
        attribution: "&copy; <a href='https://www.tomtom.com'>TomTom</a>",
        maxZoom: 22,
        subdomains: "abcd",
      }
    case "carto-light":
      return {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          "&copy; <a href='https://carto.com'>CARTO</a> &copy; <a href='https://www.openstreetmap.org/copyright'>OSM</a>",
        maxZoom: 20,
      }
    case "carto-dark":
      return {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          "&copy; <a href='https://carto.com'>CARTO</a> &copy; <a href='https://www.openstreetmap.org/copyright'>OSM</a>",
        maxZoom: 20,
      }
    default:
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
        maxZoom: 19,
      }
  }
}

const MapViewInner = dynamic(
  () => import("./MapViewInner").then((m) => m.MapViewInner),
  { ssr: false }
)

export default function MapView() {
  const { activeRoute } = useRoutingStore()
  const { data: allSettings = [] } = useQuery<Setting[]>({
    queryKey: ["settings"],
    queryFn: settingsApi.list,
    staleTime: 5 * 60 * 1000,
  })
  const { data: providerInfo } = useQuery<ProviderInfo>({
    queryKey: ["provider-info"],
    queryFn: mapsApi.getProvider,
    staleTime: 5 * 60 * 1000,
  })
  const mapProvider = useMemo(() => {
    const s = allSettings.find((st) => st.key.toUpperCase() === "MAP_PROVIDER")
    return s?.value?.toLowerCase() || "osm"
  }, [allSettings])
  const tile = useMemo(
    () => getTileConfig(mapProvider, providerInfo?.tomtom_map_key),
    [mapProvider, providerInfo?.tomtom_map_key]
  )
  const depotCenter = useMemo<LatLngExpression>(() => {
    const latSetting = allSettings.find((s) => s.key.toUpperCase() === "DEPOT_LAT")
    const lngSetting = allSettings.find((s) => s.key.toUpperCase() === "DEPOT_LNG")
    const lat = latSetting?.value ? parseFloat(latSetting.value) : NaN
    const lng = lngSetting?.value ? parseFloat(lngSetting.value) : NaN
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng]
    return DEFAULT_CENTER
  }, [allSettings])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mapa
        </span>
        {activeRoute && (
          <span className="text-[11px] text-muted-foreground">
            {activeRoute.distance_km?.toFixed(1) || "—"} km &middot; {activeRoute.duration_min || "—"} min
          </span>
        )}
      </div>
      <div className="relative flex-1 bg-secondary/20">
        <MapViewInner
          activeRoute={activeRoute}
          depotCenter={depotCenter}
          tile={tile}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
        />
      </div>
      {activeRoute && (
        <div className="flex flex-wrap gap-4 border-t border-border/50 bg-secondary/30 px-4 py-2 text-xs">
          <div>
            <span className="text-muted-foreground">Udaljenost: </span>
            <span className="font-medium text-foreground">
              {activeRoute.distance_km?.toFixed(1) || "—"} km
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Trajanje: </span>
            <span className="font-medium text-foreground">
              {activeRoute.duration_min || "—"} min
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Stopovi: </span>
            <span className="font-medium text-foreground">
              {activeRoute.stops.length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Algoritam: </span>
            <span className="font-medium text-foreground">
              {activeRoute.algoritam || "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
