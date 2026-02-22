/**
 * Zustand store za routing planner state.
 *
 * NOVI FLOW:
 *   OrdersPage -> API prebaci-u-rutiranje -> navigate('/routing')
 *   RoutingPage -> API rutiranje-nalozi (čita iz baze, prezivljava refresh)
 *
 * Store drži samo UI state (checked, vehicle, route, markers).
 * Nalozi za rutiranje se dohvaćaju iz baze (ne iz store-a).
 */
import { create } from 'zustand'
import type { Vozilo, Route, GeocodeOrderResult } from '../types'
import type { RutiranjeNalog } from '../services/api'

interface RoutingState {
  /** Nalozi u rutiranju (dohvaćeni iz baze) */
  rutiranjeNalozi: RutiranjeNalog[]

  /** Loading state za dohvat naloga */
  loadingNalozi: boolean

  /** Nalozi označeni checkboxom na RoutingPage */
  checkedOrderUids: Set<string>

  /** Odabrano vozilo za rutu */
  selectedVehicle: Vozilo | null

  /** Kreirana ruta (za prikaz na mapi) */
  activeRoute: Route | null

  /** Geocodirani nalozi za preview na karti */
  previewMarkers: GeocodeOrderResult[]

  /** Highlight stop na mapi */
  highlightedStopId: number | null

  // Actions
  setRutiranjeNalozi: (nalozi: RutiranjeNalog[]) => void
  setLoadingNalozi: (loading: boolean) => void
  removeRutiranjeNalog: (uid: string) => void

  toggleCheckedOrder: (uid: string) => void
  setCheckedOrderUids: (uids: Set<string>) => void
  checkAllOrders: () => void
  uncheckAllOrders: () => void

  setSelectedVehicle: (vehicle: Vozilo | null) => void
  setActiveRoute: (route: Route | null) => void
  setPreviewMarkers: (markers: GeocodeOrderResult[]) => void
  setHighlightedStop: (stopId: number | null) => void
}

export const useRoutingStore = create<RoutingState>((set) => ({
  rutiranjeNalozi: [],
  loadingNalozi: false,
  checkedOrderUids: new Set(),
  selectedVehicle: null,
  activeRoute: null,
  previewMarkers: [],
  highlightedStopId: null,

  setRutiranjeNalozi: (nalozi) =>
    set({ rutiranjeNalozi: nalozi }),

  setLoadingNalozi: (loading) =>
    set({ loadingNalozi: loading }),

  removeRutiranjeNalog: (uid) =>
    set((state) => {
      const next = state.rutiranjeNalozi.filter((o) => o.nalog_prodaje_uid !== uid)
      const nextChecked = new Set(state.checkedOrderUids)
      nextChecked.delete(uid)
      return { rutiranjeNalozi: next, checkedOrderUids: nextChecked }
    }),

  toggleCheckedOrder: (uid) =>
    set((state) => {
      const next = new Set(state.checkedOrderUids)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return { checkedOrderUids: next }
    }),

  setCheckedOrderUids: (uids) => set({ checkedOrderUids: uids }),

  checkAllOrders: () =>
    set((state) => ({
      checkedOrderUids: new Set(state.rutiranjeNalozi.map((o) => o.nalog_prodaje_uid)),
    })),

  uncheckAllOrders: () => set({ checkedOrderUids: new Set() }),

  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
  setActiveRoute: (route) => set({ activeRoute: route }),
  setPreviewMarkers: (markers) => set({ previewMarkers: markers }),
  setHighlightedStop: (stopId) => set({ highlightedStopId: stopId }),
}))
