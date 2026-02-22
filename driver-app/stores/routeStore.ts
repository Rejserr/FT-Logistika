import { create } from 'zustand';
import type { DriverRoute, RouteStop } from '@/types';

interface RouteState {
  routes: DriverRoute[];
  selectedRoute: DriverRoute | null;
  isLoading: boolean;
  error: string | null;

  setRoutes: (routes: DriverRoute[]) => void;
  setSelectedRoute: (route: DriverRoute | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateStopStatus: (stopId: number, status: RouteStop['status']) => void;
  reset: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  selectedRoute: null,
  isLoading: false,
  error: null,

  setRoutes: (routes) => set({ routes, isLoading: false, error: null }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  updateStopStatus: (stopId, status) => {
    const { routes, selectedRoute } = get();

    const updatedRoutes = routes.map((r) => ({
      ...r,
      stops: r.stops.map((s) =>
        s.id === stopId ? { ...s, status } : s,
      ),
    }));

    let updatedSelected = selectedRoute;
    if (selectedRoute) {
      updatedSelected = {
        ...selectedRoute,
        stops: selectedRoute.stops.map((s) =>
          s.id === stopId ? { ...s, status } : s,
        ),
      };
    }

    set({ routes: updatedRoutes, selectedRoute: updatedSelected });
  },

  reset: () =>
    set({
      routes: [],
      selectedRoute: null,
      isLoading: false,
      error: null,
    }),
}));
