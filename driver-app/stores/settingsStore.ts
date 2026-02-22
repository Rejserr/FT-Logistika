import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { NavApp, AppTheme, AppLanguage } from '@/types';

interface SettingsState {
  navApp: NavApp;
  theme: AppTheme;
  language: AppLanguage;
  locationTrackingInterval: number; // seconds

  setNavApp: (app: NavApp) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setLocationTrackingInterval: (interval: number) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  navApp: 'google',
  theme: 'light',
  language: 'hr',
  locationTrackingInterval: 60,

  setNavApp: async (navApp) => {
    set({ navApp });
    await SecureStore.setItemAsync('setting_navApp', navApp);
  },

  setTheme: async (theme) => {
    set({ theme });
    await SecureStore.setItemAsync('setting_theme', theme);
  },

  setLanguage: async (language) => {
    set({ language });
    await SecureStore.setItemAsync('setting_language', language);
  },

  setLocationTrackingInterval: async (locationTrackingInterval) => {
    set({ locationTrackingInterval });
    await SecureStore.setItemAsync('setting_trackingInterval', locationTrackingInterval.toString());
  },

  loadSettings: async () => {
    const navApp = (await SecureStore.getItemAsync('setting_navApp')) as NavApp | null;
    const theme = (await SecureStore.getItemAsync('setting_theme')) as AppTheme | null;
    const language = (await SecureStore.getItemAsync('setting_language')) as AppLanguage | null;
    const interval = await SecureStore.getItemAsync('setting_trackingInterval');

    set({
      navApp: navApp || 'google',
      theme: theme || 'light',
      language: language || 'hr',
      locationTrackingInterval: interval ? parseInt(interval, 10) : 60,
    });
  },
}));
