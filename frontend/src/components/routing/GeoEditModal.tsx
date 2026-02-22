import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { mapsApi } from '../../services/api'
import { Button, toast } from '../common'
import './GeoEditModal.css'

interface GeoEditModalProps {
  address: string
  currentLat: number | null
  currentLng: number | null
  partnerName: string
  onClose: () => void
  onUpdated?: () => void
}

interface CacheEntry {
  id: number
  address: string
  lat: number | null
  lng: number | null
  provider: string | null
  updated_at: string | null
}

export default function GeoEditModal({
  address,
  currentLat,
  currentLng,
  partnerName,
  onClose,
  onUpdated,
}: GeoEditModalProps) {
  const [coords, setCoords] = useState('')
  const [cacheEntry, setCacheEntry] = useState<CacheEntry | null>(null)

  // Pretraži geocoding cache za ovu adresu
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['geo-edit-search', address],
    queryFn: () => mapsApi.searchGeocodingCache(address, 10),
    enabled: !!address,
  })

  // Postavi prvi rezultat kao cacheEntry
  useEffect(() => {
    if (searchResults.length > 0) {
      const match = searchResults[0]
      setCacheEntry(match)
      if (match.lat && match.lng) {
        setCoords(`${match.lat.toFixed(6)}, ${match.lng.toFixed(6)}`)
      }
    }
  }, [searchResults])

  // Ako nema rezultata, koristi trenutne koordinate
  useEffect(() => {
    if (!isLoading && searchResults.length === 0 && currentLat && currentLng) {
      setCoords(`${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`)
    }
  }, [isLoading, searchResults, currentLat, currentLng])

  const updateMutation = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      const oldInfo = data.old_lat && data.old_lng
        ? `\nStare: ${data.old_lat.toFixed(6)}, ${data.old_lng.toFixed(6)}`
        : ''
      toast.success(`Koordinate ažurirane!${oldInfo}\nNove: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`)
      if (cacheEntry) {
        setCacheEntry({ ...cacheEntry, lat: data.lat, lng: data.lng, provider: 'manual' })
      }
      onUpdated?.()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: mapsApi.deleteGeocodingCache,
    onSuccess: (data) => {
      toast.success(`Cache obrisan za: ${data.address.substring(0, 40)}...\nSljedeće rutiranje će ponovo geocodirati.`)
      setCacheEntry(null)
      setCoords('')
      onUpdated?.()
    },
    onError: (err) => toast.error(`Greška: ${(err as Error).message}`),
  })

  const handleSave = useCallback(() => {
    if (!cacheEntry) {
      toast.error('Nema geocoding zapisa za ovu adresu')
      return
    }
    const parts = coords.split(',').map((s) => s.trim())
    if (parts.length !== 2) {
      toast.error('Format: lat, lng (npr. 45.82466, 15.70094)')
      return
    }
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Neispravne koordinate. Lat: -90 do 90, Lng: -180 do 180')
      return
    }
    updateMutation.mutate({ id: cacheEntry.id, lat, lng })
  }, [cacheEntry, coords, updateMutation])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
    }
  }, [])

  const displayLat = cacheEntry?.lat ?? currentLat
  const displayLng = cacheEntry?.lng ?? currentLng

  return (
    <div className="geo-modal-overlay" onClick={(e) => e.target === e.currentTarget && undefined} onKeyDown={handleKeyDown}>
      <div className="geo-modal">
        {/* Header */}
        <div className="geo-modal-header">
          <div className="geo-modal-title">
            <span className="geo-modal-icon">📍</span>
            Korekcija lokacije
          </div>
        </div>

        {/* Partner info */}
        <div className="geo-modal-partner">
          <div className="geo-modal-partner-name">{partnerName}</div>
          <div className="geo-modal-partner-address">{address}</div>
        </div>

        {/* Current coordinates */}
        <div className="geo-modal-section">
          <div className="geo-modal-section-title">Trenutne koordinate</div>
          {isLoading ? (
            <div className="geo-modal-loading">Učitavanje...</div>
          ) : (
            <div className="geo-modal-coords-display">
              <div className="geo-modal-coord-row">
                <span className="geo-modal-coord-label">Lat:</span>
                <span className={`geo-modal-coord-value ${!displayLat ? 'null' : ''}`}>
                  {displayLat ? displayLat.toFixed(6) : 'NULL'}
                </span>
              </div>
              <div className="geo-modal-coord-row">
                <span className="geo-modal-coord-label">Lng:</span>
                <span className={`geo-modal-coord-value ${!displayLng ? 'null' : ''}`}>
                  {displayLng ? displayLng.toFixed(6) : 'NULL'}
                </span>
              </div>
              {cacheEntry && (
                <div className="geo-modal-coord-row">
                  <span className="geo-modal-coord-label">Provider:</span>
                  <span className={`geo-modal-provider-badge provider-${cacheEntry.provider || 'unknown'}`}>
                    {cacheEntry.provider || '—'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="geo-modal-section">
          <div className="geo-modal-section-title">Brze akcije</div>
          <div className="geo-modal-actions-grid">
            <button
              className="geo-modal-action-btn"
              onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`, '_blank')}
              title="Pretraži adresu na Google Maps"
            >
              <span className="geo-action-icon">🗺️</span>
              <span>Otvori u Maps</span>
            </button>
            {displayLat && displayLng && (
              <button
                className="geo-modal-action-btn"
                onClick={() => window.open(`https://www.google.com/maps?q=${displayLat},${displayLng}`, '_blank')}
                title="Prikaži trenutnu poziciju na Google Maps"
              >
                <span className="geo-action-icon">📌</span>
                <span>Vidi poziciju</span>
              </button>
            )}
            {cacheEntry && (
              <button
                className="geo-modal-action-btn danger"
                onClick={() => {
                  if (confirm(`Obrisati cache za ovu adresu?\nSljedeće rutiranje će ponovo geocodirati.`)) {
                    deleteMutation.mutate(cacheEntry.id)
                  }
                }}
                title="Obriši cache - sljedeći put će se ponovo geocodirati"
              >
                <span className="geo-action-icon">🔄</span>
                <span>Ponovi geocoding</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual coordinate input */}
        {cacheEntry && (
          <div className="geo-modal-section">
            <div className="geo-modal-section-title">Ručni unos koordinata</div>
            <div className="geo-modal-hint">
              Kopirajte koordinate iz Google Maps (desni klik → kopiraj koordinate) i zalijepite ovdje
            </div>
            <div className="geo-modal-input-row">
              <input
                type="text"
                className="geo-modal-input"
                placeholder="45.82466, 15.70094"
                value={coords}
                onChange={(e) => setCoords(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                }}
              />
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={updateMutation.isPending}
              >
                Spremi
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="geo-modal-footer">
          <Button onClick={onClose}>
            Zatvori
          </Button>
        </div>
      </div>
    </div>
  )
}
