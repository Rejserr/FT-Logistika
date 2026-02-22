import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { useRoutingStore } from '../../store/routingStore'
import { settingsApi, mapsApi } from '../../services/api'
import type { Setting, ProviderInfo } from '../../types'
import { Card } from '../common'
import 'leaflet/dist/leaflet.css'
import './MapView.css'

// Fix za Leaflet marker ikone
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Custom ikone za markere
const createNumberedIcon = (number: number, isHighlighted: boolean) => {
  const color = isHighlighted ? '#ef4444' : '#3b82f6'
  const size = isHighlighted ? 32 : 28

  return L.divIcon({
    className: 'custom-marker',
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

// Preview ikona (zeleni pin za odabrane naloge)
const createPreviewIcon = (number: number) => {
  return L.divIcon({
    className: 'custom-marker',
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

// Depot ikona
const depotIcon = L.divIcon({
  className: 'depot-marker',
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
    ">&#x1F3ED;</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

// Tile provideri za prikaz mape
interface TileConfig {
  url: string
  attribution: string
  maxZoom: number
  subdomains?: string
}

function getTileConfig(provider: string, tomtomKey?: string): TileConfig {
  switch (provider) {
    case 'tomtom':
      return {
        url: `https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey || ''}&tileSize=256&language=NGT-Latn`,
        attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>',
        maxZoom: 22,
        subdomains: 'abcd',
      }
    case 'tomtom-night':
      return {
        url: `https://{s}.api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${tomtomKey || ''}&tileSize=256&language=NGT-Latn`,
        attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>',
        maxZoom: 22,
        subdomains: 'abcd',
      }
    case 'carto-light':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 20,
      }
    case 'carto-dark':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 20,
      }
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }
  }
}

// Zagreb kao default centar
const DEFAULT_CENTER: LatLngExpression = [45.815, 15.9819]
const DEFAULT_ZOOM = 8

// Komponenta za auto-fit bounds
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

export default function MapView() {
  const { activeRoute, previewMarkers, highlightedStopId, setHighlightedStop } = useRoutingStore()

  // Dohvati map_provider iz settings i TomTom API ključ
  const { data: allSettings = [] } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
    staleTime: 5 * 60 * 1000,
  })
  const { data: providerInfo } = useQuery<ProviderInfo>({
    queryKey: ['provider-info'],
    queryFn: mapsApi.getProvider,
    staleTime: 5 * 60 * 1000,
  })
  const mapProvider = useMemo(() => {
    const s = allSettings.find(
      (st) => st.key.toUpperCase() === 'MAP_PROVIDER',
    )
    return s?.value?.toLowerCase() || 'osm'
  }, [allSettings])
  const tile = useMemo(
    () => getTileConfig(mapProvider, providerInfo?.tomtom_map_key),
    [mapProvider, providerInfo?.tomtom_map_key],
  )

  // Depot koordinate iz settings
  const depotCenter = useMemo<LatLngExpression>(() => {
    const latSetting = allSettings.find((s) => s.key.toUpperCase() === 'DEPOT_LAT')
    const lngSetting = allSettings.find((s) => s.key.toUpperCase() === 'DEPOT_LNG')
    const lat = latSetting?.value ? parseFloat(latSetting.value) : NaN
    const lng = lngSetting?.value ? parseFloat(lngSetting.value) : NaN
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng]
    return DEFAULT_CENTER
  }, [allSettings])

  // Markeri iz aktivne rute (kreirana ruta)
  const { routeMarkers, routePositions, depotPosition: routeDepot, routePolyline } = useMemo(() => {
    const routeMarkers: Array<{
      position: LatLngExpression
      label: string
      stopId: number
      number: number
      isHighlighted: boolean
    }> = []
    const routePositions: LatLngExpression[] = []
    let depotPosition: LatLngExpression | null = null
    let polyline: LatLngExpression[] | null = null

    if (activeRoute && activeRoute.stops) {
      depotPosition = depotCenter

      activeRoute.stops.forEach((stop, index) => {
        if (stop.lat && stop.lng) {
          const position: LatLngExpression = [stop.lat, stop.lng]
          routeMarkers.push({
            position,
            label: stop.partner_naziv || `Stop ${index + 1}`,
            stopId: stop.id,
            number: index + 1,
            isHighlighted: highlightedStopId === stop.id,
          })
          routePositions.push(position)
        }
      })

      if (depotPosition && routePositions.length > 0) {
        routePositions.unshift(depotPosition)
      }

      // Polyline duž cesta (ORS/OSRM) – ako postoji, koristi umjesto ravnih linija
      if (activeRoute.polyline && activeRoute.polyline.length >= 2) {
        polyline = activeRoute.polyline as LatLngExpression[]
      }
    }

    return { routeMarkers, routePositions, depotPosition, routePolyline: polyline }
  }, [activeRoute, highlightedStopId])

  // Preview markeri (odabrani nalozi, geocodirani)
  const previewData = useMemo(() => {
    if (activeRoute || !previewMarkers || previewMarkers.length === 0) return []
    return previewMarkers
      .filter((m) => m.lat && m.lng)
      .map((m, i) => ({
        position: [m.lat!, m.lng!] as LatLngExpression,
        label: m.kupac || m.address || `Nalog ${i + 1}`,
        number: i + 1,
        nalogProdaje: m.nalog_prodaje,
        address: m.address,
        demandKg: m.demand_kg,
        demandM3: m.demand_m3,
      }))
  }, [previewMarkers, activeRoute])

  // Sve pozicije za bounds
  const allPositions = useMemo(() => {
    if (activeRoute) {
      const positions = routeMarkers.map((m) => m.position)
      if (routeDepot) positions.unshift(routeDepot)
      return positions
    }
    return previewData.map((m) => m.position)
  }, [routeMarkers, routeDepot, activeRoute, previewData])

  const hasContent = activeRoute || previewData.length > 0

  return (
    <Card title="Mapa" className="map-view-card">
      <div className="map-container">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className="leaflet-map"
        >
          <TileLayer
            key={mapProvider}
            attribution={tile.attribution}
            url={tile.url}
            maxZoom={tile.maxZoom}
            {...(tile.subdomains ? { subdomains: tile.subdomains } : {})}
          />

          {/* Depot marker (samo kad imamo aktivnu rutu) */}
          {routeDepot && activeRoute && (
            <Marker position={routeDepot} icon={depotIcon}>
              <Popup>
                <div className="marker-popup">
                  <strong>Depot / Skladiste</strong>
                  <p>Pocetna lokacija rute</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Stop markeri (aktivna ruta) */}
          {routeMarkers.map((marker) => (
            <Marker
              key={marker.stopId}
              position={marker.position}
              icon={createNumberedIcon(marker.number, marker.isHighlighted)}
              eventHandlers={{
                click: () => setHighlightedStop(marker.stopId),
              }}
            >
              <Popup>
                <div className="marker-popup">
                  <strong>Stop {marker.number}</strong>
                  <p>{marker.label}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Preview markeri (odabrani nalozi) */}
          {previewData.map((marker, idx) => (
            <Marker
              key={`preview-${idx}`}
              position={marker.position}
              icon={createPreviewIcon(marker.number)}
            >
              <Popup>
                <div className="marker-popup">
                  <strong>{marker.nalogProdaje || `Nalog ${marker.number}`}</strong>
                  <p>{marker.label}</p>
                  {marker.address && <p style={{ fontSize: '11px', color: '#666' }}>{marker.address}</p>}
                  <p style={{ fontSize: '11px' }}>
                    {marker.demandKg.toFixed(1)} kg / {marker.demandM3.toFixed(3)} m&sup3;
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Polyline za rutu – duž cesta (polyline) ili ravna linija (routePositions) */}
          {(routePolyline || routePositions).length > 1 && (
            <Polyline
              positions={routePolyline || routePositions}
              color="#3b82f6"
              weight={routePolyline ? 5 : 4}
              opacity={0.8}
              dashArray={routePolyline ? undefined : '10, 10'}
            />
          )}

          {/* Auto fit bounds */}
          {allPositions.length > 0 && <FitBounds positions={allPositions} />}
        </MapContainer>

        {/* Overlay kada nema sadrzaja */}
        {!hasContent && (
          <div className="map-overlay">
            <div className="map-overlay-content">
              <span className="map-overlay-icon">&#x1F5FA;&#xFE0F;</span>
              <p>Odaberite naloge za prikaz na mapi</p>
            </div>
          </div>
        )}

        {/* Legenda */}
        {hasContent && (
          <div className="map-legend">
            {activeRoute && (
              <>
                <div className="legend-item">
                  <span className="legend-icon depot" style={{ background: '#10b981' }}>&#x1F3ED;</span>
                  <span>Depot</span>
                </div>
                <div className="legend-item">
                  <span className="legend-icon stop" style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>1</span>
                  <span>Stop</span>
                </div>
                <div className="legend-item">
                  <span className="legend-line"></span>
                  <span>Ruta</span>
                </div>
              </>
            )}
            {!activeRoute && previewData.length > 0 && (
              <div className="legend-item">
                <span className="legend-icon stop" style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>&#x25CF;</span>
                <span>Preview ({previewData.length} naloga)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sazatak rute */}
      {activeRoute && (
        <div className="route-summary">
          <div className="summary-item">
            <span className="summary-label">Udaljenost</span>
            <span className="summary-value">
              {activeRoute.distance_km?.toFixed(1) || '—'} km
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Trajanje</span>
            <span className="summary-value">
              {activeRoute.duration_min || '—'} min
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Stopovi</span>
            <span className="summary-value">{activeRoute.stops.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Algoritam</span>
            <span className="summary-value">{activeRoute.algoritam || '—'}</span>
          </div>
        </div>
      )}
    </Card>
  )
}
