/**
 * Theme constants for FT Driver app.
 * Glossy transparent modern design with light & dark support.
 */

// ---- Light palette ----
export const lightColors = {
  background: '#EEF2FA',
  card: 'rgba(255, 255, 255, 0.65)',
  cardSolid: '#FFFFFF',
  cardHover: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(255, 255, 255, 0.5)',
  borderSubtle: 'rgba(226, 232, 240, 0.4)',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#FF7E67',
  primaryDark: '#E8634D',
  primaryLight: '#FF9A87',
  primaryBg: 'rgba(255, 126, 103, 0.1)',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
  statusBar: 'dark' as const,
} as const;

// ---- Dark palette ----
export const darkColors = {
  background: '#09090B',
  card: 'rgba(24, 24, 27, 0.8)',
  cardSolid: '#18181B',
  cardHover: '#27272A',
  border: 'rgba(63, 63, 70, 0.6)',
  borderSubtle: '#27272A',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  primary: '#FF7E67',
  primaryDark: '#E8634D',
  primaryLight: '#FF9A87',
  primaryBg: 'rgba(255, 126, 103, 0.12)',
  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.12)',
  statusBar: 'light' as const,
} as const;

// Default export (dark for backward compat with existing screens)
export const colors = darkColors;

// ---- Spacing ----
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ---- Border radius ----
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// ---- Font sizes ----
export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
} as const;

// ---- Delivery status colors ----
export type DeliveryStatus = 'PENDING' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export const statusColors: Record<
  DeliveryStatus,
  { color: string; bg: string; label: string }
> = {
  PENDING: { color: colors.warning, bg: colors.warningBg, label: 'Čeka dostavu' },
  ARRIVED: { color: colors.primary, bg: colors.primaryBg, label: 'Na lokaciji' },
  DELIVERED: { color: colors.success, bg: colors.successBg, label: 'Dostavljeno' },
  FAILED: { color: colors.danger, bg: colors.dangerBg, label: 'Neuspjelo' },
  SKIPPED: { color: colors.textMuted, bg: colors.borderSubtle, label: 'Preskočeno' },
};

export const statusLabelsShort: Record<DeliveryStatus, string> = {
  PENDING: 'Čeka',
  ARRIVED: 'Na lokaciji',
  DELIVERED: 'Dostavljeno',
  FAILED: 'Neuspjelo',
  SKIPPED: 'Preskočeno',
};
