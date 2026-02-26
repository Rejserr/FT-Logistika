import { useMemo } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { lightColors, darkColors } from '@/constants/theme';

export function useColors() {
  const theme = useSettingsStore((s) => s.theme);
  return useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
}

export type AppColors = typeof lightColors;
