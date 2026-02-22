import { create } from 'zustand'
import type { Vozilo, Route, GeocodeOrderResult, RutiranjeNalog } from '@/types'

interface RoutingState {
  rutiranjeNalozi: RutiranjeNalog[]
  loadingNalozi: boolean
  checkedOrderUids: Set<string>
  selectedVehicle: Vozilo | null
  activeRoute: Route | null
  previewMarkers: GeocodeOrderResult[]
  highlightedStopId: number | null

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

  setRutiranjeNalozi: (nalozi) => set({ rutiranjeNalozi: nalozi }),
  setLoadingNalozi: (loading) => set({ loadingNalozi: loading }),
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
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
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
