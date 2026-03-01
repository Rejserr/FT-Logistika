import { create } from 'zustand';
import type { ParsedDocument } from '@/services/erp';

interface DocumentState {
  document: ParsedDocument | null;
  isLoading: boolean;
  error: string | null;

  setDocument: (doc: ParsedDocument) => void;
  updateStatus: (statusId: string, statusNaziv: string, statusUid: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  document: null,
  isLoading: false,
  error: null,

  setDocument: (document) => set({ document, isLoading: false, error: null }),
  updateStatus: (statusId, statusNaziv, statusUid) =>
    set((state) => ({
      document: state.document
        ? { ...state.document, status: statusId, statusNaziv, statusUid }
        : null,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ document: null, isLoading: false, error: null }),
}));
