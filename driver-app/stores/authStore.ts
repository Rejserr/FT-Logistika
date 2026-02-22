import { create } from 'zustand';
import type { UserInfo, RouteSummary } from '@/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  sessionId: number | null;
  voziloId: number | null;
  registrationPlate: string | null;
  summary: RouteSummary | null;
  onDuty: boolean;

  setAuthenticated: (
    user: UserInfo,
    sessionId: number,
    voziloId: number | null,
    summary: RouteSummary | null,
  ) => void;
  setOnDuty: (onDuty: boolean) => void;
  setLoading: (loading: boolean) => void;
  setRegistrationPlate: (plate: string) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  sessionId: null,
  voziloId: null,
  registrationPlate: null,
  summary: null,
  onDuty: false,

  setAuthenticated: (user, sessionId, voziloId, summary) =>
    set({
      isAuthenticated: true,
      isLoading: false,
      user,
      sessionId,
      voziloId,
      summary,
      onDuty: true,
    }),

  setOnDuty: (onDuty) => set({ onDuty }),
  setLoading: (isLoading) => set({ isLoading }),
  setRegistrationPlate: (registrationPlate) => set({ registrationPlate }),

  reset: () =>
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      sessionId: null,
      voziloId: null,
      registrationPlate: null,
      summary: null,
      onDuty: false,
    }),
}));
