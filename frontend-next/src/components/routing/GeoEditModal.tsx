"use client"

import { useState, useEffect, useCallback } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { mapsApi } from "@/services/api"
import { MapPin, Loader2, MapPinned, RefreshCw } from "lucide-react"

interface GeoEditModalProps {
  address: string
  currentLat: number | null
  currentLng: number | null
  partnerName: string
  onClose: () => void
  onUpdated?: () => void
  open: boolean
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
  open,
}: GeoEditModalProps) {
  const [coords, setCoords] = useState("")
  const [cacheEntry, setCacheEntry] = useState<CacheEntry | null>(null)

  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ["geo-edit-search", address],
    queryFn: () => mapsApi.searchGeocodingCache(address, 10),
    enabled: !!address && open,
  })

  useEffect(() => {
    if (searchResults.length > 0) {
      const match = searchResults[0] as CacheEntry
      setCacheEntry(match)
      if (match.lat && match.lng) {
        setCoords(`${match.lat.toFixed(6)}, ${match.lng.toFixed(6)}`)
      }
    }
  }, [searchResults])

  useEffect(() => {
    if (!isLoading && searchResults.length === 0 && currentLat && currentLng) {
      setCoords(`${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`)
    }
  }, [isLoading, searchResults, currentLat, currentLng])

  const updateMutation = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      mapsApi.setManualCoordinates(id, lat, lng),
    onSuccess: (data) => {
      const oldInfo =
        data.old_lat && data.old_lng
          ? ` Stare: ${data.old_lat.toFixed(6)}, ${data.old_lng.toFixed(6)}`
          : ""
      toast.success(
        "Koordinate ažurirane!",
        `${oldInfo} Nove: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`
      )
      if (cacheEntry) {
        setCacheEntry({ ...cacheEntry, lat: data.lat, lng: data.lng, provider: "manual" })
      }
      onUpdated?.()
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: mapsApi.deleteGeocodingCache,
    onSuccess: (data) => {
      toast.success(
        "Cache obrisan",
        `${data.address.substring(0, 40)}... — sljedeće rutiranje će ponovo geocodirati.`
      )
      setCacheEntry(null)
      setCoords("")
      onUpdated?.()
    },
    onError: (err: Error) => toast.error("Greška", err.message),
  })

  const handleSave = useCallback(() => {
    if (!cacheEntry) {
      toast.error("Greška", "Nema geocoding zapisa za ovu adresu")
      return
    }
    const parts = coords.split(",").map((s) => s.trim())
    if (parts.length !== 2) {
      toast.error("Greška", "Format: lat, lng (npr. 45.82466, 15.70094)")
      return
    }
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Greška", "Neispravne koordinate. Lat: -90 do 90, Lng: -180 do 180")
      return
    }
    updateMutation.mutate({ id: cacheEntry.id, lat, lng })
  }, [cacheEntry, coords, updateMutation])

  const displayLat = cacheEntry?.lat ?? currentLat
  const displayLng = cacheEntry?.lng ?? currentLng

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-popover border-border text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MapPin className="h-5 w-5 text-blue-400" />
            Korekcija lokacije
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-secondary/50 p-3 border border-border/50">
            <div className="font-medium text-foreground">{partnerName}</div>
            <div className="text-sm text-muted-foreground">{address}</div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Trenutne koordinate</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Učitavanje...
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Lat: </span>
                  <span className={displayLat ? "text-foreground" : "text-muted-foreground"}>
                    {displayLat ? displayLat.toFixed(6) : "NULL"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lng: </span>
                  <span className={displayLng ? "text-foreground" : "text-muted-foreground"}>
                    {displayLng ? displayLng.toFixed(6) : "NULL"}
                  </span>
                </div>
                {cacheEntry && (
                  <div>
                    <span className="text-muted-foreground">Provider: </span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                      {cacheEntry.provider || "—"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Brze akcije</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/${encodeURIComponent(address)}`,
                    "_blank"
                  )
                }
              >
                <MapPinned className="mr-1 h-3 w-3" />
                Otvori u Maps
              </Button>
              {displayLat && displayLng && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps?q=${displayLat},${displayLng}`,
                      "_blank"
                    )
                  }
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  Vidi poziciju
                </Button>
              )}
              {cacheEntry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    if (
                      confirm(
                        "Obrisati cache za ovu adresu? Sljedeće rutiranje će ponovo geocodirati."
                      )
                    ) {
                      deleteMutation.mutate(cacheEntry.id)
                    }
                  }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Ponovi geocoding
                </Button>
              )}
            </div>
          </div>

          {cacheEntry && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Ručni unos koordinata</Label>
              <p className="text-xs text-muted-foreground">
                Zalijepite koordinate (npr. iz Google Maps): lat, lng
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="45.82466, 15.70094"
                  value={coords}
                  onChange={(e) => setCoords(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="bg-secondary/50 border-border"
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  Spremi
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
